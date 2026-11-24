import { clearGoogleAccessToken, getGoogleAccessToken } from './googleAuth';
import {
  APP_DRIVE_FOLDER_NAME,
  buildDriveFileName,
  buildMultipartRelatedBody,
  DRIVE_FOLDER_MIME_TYPE,
  DriveAppFolder,
  DriveWhiteboardFile,
  filterOutDriveFolders,
  parseWhiteboardPayload,
  WhiteboardPayload,
} from './googleDriveUtils';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';
const FILE_FIELDS =
  'id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,parents,appProperties';
const FOLDER_FIELDS = 'id,name,webViewLink';

let cachedAppFolder: DriveAppFolder | null = null;
let folderResolutionPromise: Promise<DriveAppFolder> | null = null;

export function clearCachedDriveFolder(): void {
  cachedAppFolder = null;
  folderResolutionPromise = null;
}

export class DriveAuthError extends Error {
  constructor(message = 'Phiên kết nối Google Drive đã hết hạn. Vui lòng đăng nhập lại.') {
    super(message);
    this.name = 'DriveAuthError';
  }
}

function requireToken(): string {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new DriveAuthError('Vui lòng đăng nhập bằng Google để sử dụng Google Drive.');
  }
  return token;
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = requireToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    clearGoogleAccessToken();
    clearCachedDriveFolder();
    throw new DriveAuthError();
  }
  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || '';
    } catch {
      // ignore non-json error body
    }
    throw new Error(detail || `Lỗi Google Drive (HTTP ${res.status})`);
  }
  return res;
}

/**
 * Finds or creates the dedicated "fzINK" folder in the user's Google Drive
 * so all saved boards and PNG exports stay neatly organized in one place.
 */
export async function ensureAppDriveFolder(): Promise<DriveAppFolder> {
  if (cachedAppFolder) {
    return cachedAppFolder;
  }
  if (folderResolutionPromise) {
    return folderResolutionPromise;
  }

  folderResolutionPromise = (async () => {
    const query = [
      `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
      'trashed = false',
      `appProperties has { key='app' and value='smart-whiteboard' }`,
    ].join(' and ');

    const searchParams = new URLSearchParams({
      q: query,
      fields: `files(${FOLDER_FIELDS})`,
      orderBy: 'createdTime asc',
      pageSize: '5',
    });

    const searchRes = await driveFetch(`${DRIVE_API_BASE}?${searchParams.toString()}`);
    const searchData = await searchRes.json();
    const existing = Array.isArray(searchData.files)
      ? (searchData.files[0] as DriveAppFolder | undefined)
      : undefined;

    if (existing?.id) {
      cachedAppFolder = existing;
      return existing;
    }

    const createParams = new URLSearchParams({
      fields: FOLDER_FIELDS,
    });
    const createRes = await driveFetch(`${DRIVE_API_BASE}?${createParams.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        name: APP_DRIVE_FOLDER_NAME,
        mimeType: DRIVE_FOLDER_MIME_TYPE,
        appProperties: {
          app: 'smart-whiteboard',
          kind: 'folder',
        },
      }),
    });

    const created = (await createRes.json()) as DriveAppFolder;
    cachedAppFolder = created;
    return created;
  })();

  try {
    return await folderResolutionPromise;
  } finally {
    folderResolutionPromise = null;
  }
}

/**
 * Lists files created/managed by this app on the user's Google Drive (scoped by drive.file),
 * excluding folders, and ensures the dedicated app folder is available.
 */
export async function listDriveWhiteboardFiles(): Promise<DriveWhiteboardFile[]> {
  const params = new URLSearchParams({
    q: `trashed = false and mimeType != '${DRIVE_FOLDER_MIME_TYPE}'`,
    fields: `files(${FILE_FIELDS})`,
    orderBy: 'modifiedTime desc',
    pageSize: '100',
  });

  const res = await driveFetch(`${DRIVE_API_BASE}?${params.toString()}`);
  const data = await res.json();
  const rawFiles = Array.isArray(data.files) ? (data.files as DriveWhiteboardFile[]) : [];
  return filterOutDriveFolders(rawFiles);
}

export async function listDriveWorkspace(): Promise<{
  folder: DriveAppFolder;
  files: DriveWhiteboardFile[];
}> {
  const [folder, files] = await Promise.all([ensureAppDriveFolder(), listDriveWhiteboardFiles()]);
  return { folder, files };
}

/**
 * Moves an older app-created file into the dedicated "fzINK" folder.
 */
export async function moveDriveFileToFolder(
  file: DriveWhiteboardFile,
  folderId: string
): Promise<DriveWhiteboardFile> {
  const params = new URLSearchParams({
    addParents: folderId,
    fields: FILE_FIELDS,
  });

  const previousParents = Array.isArray(file.parents)
    ? file.parents.filter((p) => p && p !== folderId)
    : [];
  if (previousParents.length > 0) {
    params.set('removeParents', previousParents.join(','));
  }

  const res = await driveFetch(
    `${DRIVE_API_BASE}/${encodeURIComponent(file.id)}?${params.toString()}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({}),
    }
  );

  return (await res.json()) as DriveWhiteboardFile;
}

/**
 * Creates a new .whiteboard.json project file inside the dedicated app folder on Google Drive.
 */
export async function createDriveWhiteboardFile(
  title: string,
  payload: WhiteboardPayload
): Promise<DriveWhiteboardFile> {
  const folder = await ensureAppDriveFolder();
  const fileName = buildDriveFileName(title, '.whiteboard.json');
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folder.id],
    appProperties: {
      app: 'smart-whiteboard',
      kind: 'board',
    },
  };

  const { body, contentTypeHeader } = buildMultipartRelatedBody(
    metadata,
    JSON.stringify(payload),
    'application/json'
  );

  const params = new URLSearchParams({
    uploadType: 'multipart',
    fields: FILE_FIELDS,
  });

  const res = await driveFetch(`${DRIVE_UPLOAD_BASE}?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': contentTypeHeader },
    body,
  });

  return (await res.json()) as DriveWhiteboardFile;
}

/**
 * Updates/overwrites an existing .whiteboard.json file on Google Drive.
 */
export async function updateDriveWhiteboardFile(
  fileId: string,
  title: string,
  payload: WhiteboardPayload
): Promise<DriveWhiteboardFile> {
  const fileName = buildDriveFileName(title, '.whiteboard.json');
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    appProperties: {
      app: 'smart-whiteboard',
      kind: 'board',
    },
  };

  const { body, contentTypeHeader } = buildMultipartRelatedBody(
    metadata,
    JSON.stringify(payload),
    'application/json'
  );

  const params = new URLSearchParams({
    uploadType: 'multipart',
    fields: FILE_FIELDS,
  });

  const res = await driveFetch(
    `${DRIVE_UPLOAD_BASE}/${encodeURIComponent(fileId)}?${params.toString()}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': contentTypeHeader },
      body,
    }
  );

  return (await res.json()) as DriveWhiteboardFile;
}

/**
 * Uploads a lossless high-resolution PNG snapshot directly into the dedicated app folder on Google Drive.
 */
export async function uploadDrivePngSnapshot(
  title: string,
  pngBlob: Blob
): Promise<DriveWhiteboardFile> {
  const folder = await ensureAppDriveFolder();
  const fileName = buildDriveFileName(title, '.png');
  const metadata = {
    name: fileName,
    mimeType: 'image/png',
    parents: [folder.id],
    appProperties: {
      app: 'smart-whiteboard',
      kind: 'png',
    },
  };

  const { body, contentTypeHeader } = buildMultipartRelatedBody(metadata, pngBlob, 'image/png');

  const params = new URLSearchParams({
    uploadType: 'multipart',
    fields: FILE_FIELDS,
  });

  const res = await driveFetch(`${DRIVE_UPLOAD_BASE}?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': contentTypeHeader },
    body,
  });

  return (await res.json()) as DriveWhiteboardFile;
}

/**
 * Downloads and parses a .whiteboard.json file from Google Drive.
 */
export async function downloadDriveWhiteboardFile(fileId: string) {
  const res = await driveFetch(`${DRIVE_API_BASE}/${encodeURIComponent(fileId)}?alt=media`);
  const raw = await res.json();
  return parseWhiteboardPayload(raw);
}

/**
 * Renames a file on Google Drive (updates metadata only).
 */
export async function renameDriveFile(
  fileId: string,
  newTitle: string,
  isBoard: boolean
): Promise<DriveWhiteboardFile> {
  const fileName = buildDriveFileName(newTitle, isBoard ? '.whiteboard.json' : '.png');
  const params = new URLSearchParams({
    fields: FILE_FIELDS,
  });

  const res = await driveFetch(
    `${DRIVE_API_BASE}/${encodeURIComponent(fileId)}?${params.toString()}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ name: fileName }),
    }
  );

  return (await res.json()) as DriveWhiteboardFile;
}

/**
 * Deletes a file from Google Drive.
 * Caller MUST obtain explicit user confirmation before calling this function.
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  await driveFetch(`${DRIVE_API_BASE}/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  });
}
