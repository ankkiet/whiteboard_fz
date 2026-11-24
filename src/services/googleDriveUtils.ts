import { BoardElement, BoardPattern, BoardType } from '../types/board';
import { normalizeBoardPattern, normalizeBoardType } from '../engine/boardTemplates';

export const APP_DRIVE_FOLDER_NAME = 'fzINK';
export const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export interface DriveAppFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveWhiteboardFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
}

export interface WhiteboardPayload {
  title: string;
  elements: BoardElement[];
  assets: Record<string, string>;
  boardType?: BoardType;
  boardPattern?: BoardPattern;
  version: number;
  exportedAt: string;
}

export type DriveFileFilter = 'all' | 'boards' | 'images';
export type DriveFileSort = 'modifiedDesc' | 'nameAsc' | 'sizeDesc';

export interface FormattedDriveError {
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

export function buildDriveFileName(title: string, extension: '.whiteboard.json' | '.png'): string {
  const cleaned = (title || 'Bang-Trang-Moi')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  const base = cleaned || 'Bang-Trang-Moi';
  if (base.toLowerCase().endsWith(extension)) {
    return base;
  }
  return `${base}${extension}`;
}

export function getDisplayBoardTitle(file: Pick<DriveWhiteboardFile, 'name'>): string {
  const stripped = file.name
    .replace(/\.whiteboard\.json$/i, '')
    .replace(/\.json$/i, '')
    .replace(/\.png$/i, '')
    .trim();
  return stripped || file.name;
}

export function isDriveFolder(file: Pick<DriveWhiteboardFile, 'mimeType'>): boolean {
  return file.mimeType === DRIVE_FOLDER_MIME_TYPE;
}

export function filterOutDriveFolders<T extends Pick<DriveWhiteboardFile, 'mimeType'>>(
  files: T[]
): T[] {
  return files.filter((file) => !isDriveFolder(file));
}

export function findUnorganizedDriveFiles(
  files: DriveWhiteboardFile[],
  folderId: string
): DriveWhiteboardFile[] {
  if (!folderId) return [];
  return files.filter(
    (file) => !isDriveFolder(file) && (!Array.isArray(file.parents) || !file.parents.includes(folderId))
  );
}

export function isWhiteboardProjectFile(
  file: Pick<DriveWhiteboardFile, 'name' | 'mimeType' | 'appProperties'>
): boolean {
  if (isDriveFolder(file)) return false;
  if (file.appProperties?.kind === 'board') return true;
  if (file.name.toLowerCase().endsWith('.whiteboard.json')) return true;
  if (file.name.toLowerCase().endsWith('.json') && file.mimeType === 'application/json') return true;
  return false;
}

export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

export function filterAndSortDriveFiles(
  files: DriveWhiteboardFile[],
  options: {
    filter: DriveFileFilter;
    query: string;
    sort: DriveFileSort;
  }
): DriveWhiteboardFile[] {
  const normalizedQuery = normalizeSearchText(options.query);

  const filtered = files.filter((file) => {
    const isBoard = isWhiteboardProjectFile(file);
    if (options.filter === 'boards' && !isBoard) return false;
    if (options.filter === 'images' && isBoard) return false;

    if (normalizedQuery) {
      const hay = normalizeSearchText(`${getDisplayBoardTitle(file)} ${file.name}`);
      if (!hay.includes(normalizedQuery)) return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (options.sort === 'nameAsc') {
      return getDisplayBoardTitle(a).localeCompare(getDisplayBoardTitle(b), 'vi', {
        sensitivity: 'base',
      });
    }
    if (options.sort === 'sizeDesc') {
      const sizeA = Number(a.size || 0);
      const sizeB = Number(b.size || 0);
      return sizeB - sizeA;
    }
    const timeA = a.modifiedTime ? Date.parse(a.modifiedTime) : 0;
    const timeB = b.modifiedTime ? Date.parse(b.modifiedTime) : 0;
    return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
  });
}

export function formatDriveErrorMessage(rawMessage: string): FormattedDriveError {
  const trimmed = (rawMessage || '').trim();
  const disabledApiMatch = trimmed.match(
    /Google Drive API has not been used in project (\d+) before or it is disabled/i
  );
  if (disabledApiMatch) {
    const projectNumber = disabledApiMatch[1];
    const urlMatch = trimmed.match(/https:\/\/console\.[^\s]+/);
    const actionUrl =
      urlMatch?.[0] ||
      `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${projectNumber}`;
    return {
      message: `Google Drive API chưa được bật trong dự án Google Cloud (${projectNumber}). Hãy bấm nút bên dưới để bật miễn phí rồi chờ 1 phút và thử lại.`,
      actionUrl,
      actionLabel: 'Bật Google Drive API',
    };
  }

  return {
    message: trimmed || 'Không thể kết nối Google Drive. Vui lòng thử lại.',
  };
}

export function getGoogleAuthErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (
    code === 'auth/operation-not-supported-in-this-environment' ||
    (typeof window !== 'undefined' && window.location.protocol === 'file:')
  ) {
    return 'Bản cài đặt chạy từ tệp cục bộ (file://) không hỗ trợ đăng nhập Google do chính sách bảo mật của Google OAuth. Dữ liệu bảng của bạn vẫn được lưu tự động và an toàn trên máy tính. Để đồng bộ Google Drive, vui lòng mở bản web hoặc cài đặt qua tính năng PWA trên trình duyệt.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Bạn đã đóng cửa sổ đăng nhập Google.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Trình duyệt đang chặn cửa sổ bật lên. Hãy cho phép popup và thử lại.';
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    if (!host) {
      return 'Bản cài đặt tệp cục bộ không có tên miền web hợp lệ để đăng nhập Google OAuth. Hãy mở bản web trên trình duyệt hoặc cài đặt qua PWA để đồng bộ Google Drive.';
    }
    return `Tên miền "${host}" chưa được cấp phép trong Firebase Console (Authentication → Settings → Authorized domains). Hãy thêm tên miền này rồi thử lại.`;
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Phương thức đăng nhập Google chưa được bật trong Firebase Console (Authentication → Sign-in method → Google).';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Đăng nhập Google không thành công. Vui lòng thử lại.';
}

export function parseWhiteboardPayload(raw: unknown): {
  title?: string;
  elements: BoardElement[];
  assets: Record<string, string>;
  boardType?: BoardType;
  boardPattern?: BoardPattern;
} {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Nội dung tệp bảng trắng không hợp lệ.');
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.elements)) {
    throw new Error('Tệp không đúng định dạng bảng trắng (.whiteboard.json).');
  }
  return {
    title: typeof obj.title === 'string' ? obj.title : undefined,
    elements: obj.elements as BoardElement[],
    assets:
      obj.assets && typeof obj.assets === 'object' && !Array.isArray(obj.assets)
        ? (obj.assets as Record<string, string>)
        : {},
    boardType: typeof obj.boardType === 'string' ? normalizeBoardType(obj.boardType) : undefined,
    boardPattern:
      typeof obj.boardPattern === 'string' ? normalizeBoardPattern(obj.boardPattern) : undefined,
  };
}

export function buildMultipartRelatedBody(
  metadata: Record<string, unknown>,
  content: Blob | string,
  contentType: string,
  boundary = 'smart_whiteboard_drive_boundary'
): { body: Blob; contentTypeHeader: string } {
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}` +
    delimiter +
    `Content-Type: ${contentType}\r\n\r\n`;

  const body = new Blob([metadataPart, content, closeDelimiter], {
    type: `multipart/related; boundary=${boundary}`,
  });

  return {
    body,
    contentTypeHeader: `multipart/related; boundary=${boundary}`,
  };
}

export function formatDriveModifiedTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
