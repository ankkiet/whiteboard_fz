import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import { AppLanguage, getAppLanguage, tr } from '../i18n';
import {
  BoardElement,
  BoardPattern,
  BoardType,
  MathGradeMode,
  NotebookPaperSize,
} from '../types/board';
import {
  getBoardTemplate,
  normalizeBoardPattern,
  normalizeBoardType,
  normalizeMathGradeMode,
} from '../engine/boardTemplates';
import { normalizeNotebookPaperSize } from '../engine/notebookEngine';

export const LOCAL_BOARDS_INDEX_KEY = 'fzink_local_boards_index_v1';
export const LOCAL_BOARD_DATA_PREFIX = 'fzink_local_board_data_v1:';
export const LOCAL_BOARD_ASSETS_PREFIX = 'fzink_local_board_assets_v1:';

export type LocalBoardSort = 'updatedDesc' | 'nameAsc' | 'elementsDesc';
export type LocalBoardFilter = 'all' | BoardType;

export interface LocalBoardMeta {
  id: string;
  title: string;
  boardType: BoardType;
  boardPattern: BoardPattern;
  notebookPaperSize: NotebookPaperSize;
  mathGradeMode: MathGradeMode;
  elementCount: number;
  createdAt: string;
  updatedAt: string;
  driveFileId?: string | null;
  driveSyncedSignature?: string | null;
}

export interface LocalBoardPayload {
  id: string;
  title: string;
  elements: BoardElement[];
  assets: Record<string, string>;
  theme: 'light' | 'dark';
  boardType: BoardType;
  boardPattern: BoardPattern;
  notebookPaperSize: NotebookPaperSize;
  mathGradeMode: MathGradeMode;
  driveFileId?: string | null;
  driveSyncedSignature?: string | null;
}

export function findLocalBoardByDriveFileId(
  list: LocalBoardMeta[],
  driveFileId: string | null | undefined
): LocalBoardMeta | undefined {
  if (!driveFileId || typeof driveFileId !== 'string') return undefined;
  return list.find((item) => item.driveFileId === driveFileId);
}

export function generateLocalBoardId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `local_${ts}_${rand}`;
}

export function getLocalBoardDataKey(id: string): string {
  return `${LOCAL_BOARD_DATA_PREFIX}${id}`;
}

export function getLocalBoardAssetsKey(id: string): string {
  return `${LOCAL_BOARD_ASSETS_PREFIX}${id}`;
}

function areAssetMapsEqual(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

const savedBoardAssetsCache = new Map<string, Record<string, string>>();

/**
 * Only persist a board into the local library once it actually has content
 * (and for freshly created templates, only after the user has edited or imported it).
 * Blank 0-element boards are never added to the library.
 */
export function shouldPersistBoardToLibrary(params: {
  elementCount: number;
  activeLocalBoardId: string | null;
  hasUserEditedCurrentBoard: boolean;
}): boolean {
  if (params.elementCount <= 0) {
    return false;
  }
  return params.activeLocalBoardId !== null || params.hasUserEditedCurrentBoard;
}

function normalizeVietnameseForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function upsertLocalBoardMeta(
  list: LocalBoardMeta[],
  meta: LocalBoardMeta
): LocalBoardMeta[] {
  const next = list.filter((item) => item.id !== meta.id);
  next.unshift(meta);
  return next.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function removeLocalBoardMeta(
  list: LocalBoardMeta[],
  id: string
): LocalBoardMeta[] {
  return list.filter((item) => item.id !== id);
}

export function filterAndSortLocalBoards(
  boards: LocalBoardMeta[],
  options: {
    filter: LocalBoardFilter;
    query: string;
    sort: LocalBoardSort;
  }
): LocalBoardMeta[] {
  const normalizedQuery = normalizeVietnameseForSearch(options.query || '');

  const filtered = boards.filter((board) => {
    if (options.filter !== 'all' && board.boardType !== options.filter) {
      return false;
    }
    if (!normalizedQuery) return true;
    return normalizeVietnameseForSearch(board.title).includes(normalizedQuery);
  });

  return [...filtered].sort((a, b) => {
    if (options.sort === 'nameAsc') {
      return a.title.localeCompare(b.title, 'vi', { sensitivity: 'base' });
    }
    if (options.sort === 'elementsDesc') {
      if (b.elementCount !== a.elementCount) return b.elementCount - a.elementCount;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function formatLocalBoardTime(
  isoString: string,
  nowMs: number = Date.now(),
  lang: AppLanguage = getAppLanguage()
): string {
  const ts = new Date(isoString).getTime();
  if (!Number.isFinite(ts)) return '';

  const diffMs = Math.max(0, nowMs - ts);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return tr('Vừa xong', 'Just now', lang);
  if (diffMin < 60) return tr(`${diffMin} phút trước`, `${diffMin}m ago`, lang);

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return tr(`${diffHours} giờ trước`, `${diffHours}h ago`, lang);

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return tr(`${diffDays} ngày trước`, `${diffDays}d ago`, lang);

  const date = new Date(ts);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return lang === 'en' ? `${mm}/${dd}/${yyyy}` : `${dd}/${mm}/${yyyy}`;
}

export function normalizeLocalBoardMeta(raw: Partial<LocalBoardMeta>): LocalBoardMeta | null {
  if (!raw || typeof raw.id !== 'string' || !raw.id.trim()) return null;
  const boardType = normalizeBoardType(raw.boardType);
  const boardPattern = normalizeBoardPattern(raw.boardPattern || getBoardTemplate(boardType).pattern);
  const notebookPaperSize = normalizeNotebookPaperSize(raw.notebookPaperSize);
  const mathGradeMode = normalizeMathGradeMode(raw.mathGradeMode);
  const nowIso = new Date().toISOString();

  return {
    id: raw.id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Bảng trắng mới',
    boardType,
    boardPattern,
    notebookPaperSize,
    mathGradeMode,
    elementCount: typeof raw.elementCount === 'number' && raw.elementCount >= 0 ? raw.elementCount : 0,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso,
    driveFileId: typeof raw.driveFileId === 'string' && raw.driveFileId.trim() ? raw.driveFileId.trim() : null,
    driveSyncedSignature:
      typeof raw.driveSyncedSignature === 'string' && raw.driveSyncedSignature
        ? raw.driveSyncedSignature
        : null,
  };
}

export async function listLocalBoards(): Promise<LocalBoardMeta[]> {
  try {
    const raw = await idbGet<unknown>(LOCAL_BOARDS_INDEX_KEY);
    if (!Array.isArray(raw)) return [];
    const normalized = raw
      .map((item) => normalizeLocalBoardMeta(item as Partial<LocalBoardMeta>))
      .filter((item): item is LocalBoardMeta => item !== null);
    return normalized.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (err) {
    console.error('Failed to list local boards from IndexedDB', err);
    return [];
  }
}

type StoredLocalBoardRecord = Partial<LocalBoardPayload> & {
  hasSeparateAssets?: boolean;
};

export async function getLocalBoardPayload(id: string): Promise<LocalBoardPayload | null> {
  try {
    const raw = await idbGet<StoredLocalBoardRecord>(getLocalBoardDataKey(id));
    if (!raw || typeof raw !== 'object') return null;
    const boardType = normalizeBoardType(raw.boardType);
    let resolvedAssets: Record<string, string> = {};
    if (raw.hasSeparateAssets) {
      const separateAssets = await idbGet<Record<string, string>>(getLocalBoardAssetsKey(id));
      if (separateAssets && typeof separateAssets === 'object') {
        resolvedAssets = separateAssets;
      } else if (raw.assets && typeof raw.assets === 'object') {
        resolvedAssets = raw.assets;
      }
    } else if (raw.assets && typeof raw.assets === 'object') {
      resolvedAssets = raw.assets;
    }
    savedBoardAssetsCache.set(id, resolvedAssets);

    return {
      id,
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Bảng trắng mới',
      elements: Array.isArray(raw.elements) ? raw.elements : [],
      assets: resolvedAssets,
      theme: raw.theme === 'dark' ? 'dark' : 'light',
      boardType,
      boardPattern: normalizeBoardPattern(raw.boardPattern || getBoardTemplate(boardType).pattern),
      notebookPaperSize: normalizeNotebookPaperSize(raw.notebookPaperSize),
      mathGradeMode: normalizeMathGradeMode(raw.mathGradeMode),
      driveFileId: typeof raw.driveFileId === 'string' && raw.driveFileId.trim() ? raw.driveFileId.trim() : null,
      driveSyncedSignature:
        typeof raw.driveSyncedSignature === 'string' && raw.driveSyncedSignature
          ? raw.driveSyncedSignature
          : null,
    };
  } catch (err) {
    console.error('Failed to load local board payload from IndexedDB', err);
    return null;
  }
}

let libraryWriteQueue: Promise<unknown> = Promise.resolve();

function enqueueLibraryWrite<T>(task: () => Promise<T>): Promise<T> {
  const next = libraryWriteQueue.then(task, task);
  libraryWriteQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export async function saveLocalBoard(
  payload: LocalBoardPayload
): Promise<{ meta: LocalBoardMeta; list: LocalBoardMeta[] }> {
  return enqueueLibraryWrite(async () => {
    const existingList = await listLocalBoards();
    const prevMeta = existingList.find((item) => item.id === payload.id);
    const nowIso = new Date().toISOString();
    const resolvedDriveFileId =
      payload.driveFileId !== undefined ? payload.driveFileId : prevMeta?.driveFileId ?? null;
    const resolvedDriveSig =
      payload.driveSyncedSignature !== undefined
        ? payload.driveSyncedSignature
        : prevMeta?.driveSyncedSignature ?? null;

    const meta: LocalBoardMeta = {
      id: payload.id,
      title: payload.title.trim() || 'Bảng trắng mới',
      boardType: payload.boardType,
      boardPattern: payload.boardPattern,
      notebookPaperSize: payload.notebookPaperSize,
      mathGradeMode: payload.mathGradeMode,
      elementCount: payload.elements.length,
      createdAt: prevMeta?.createdAt || nowIso,
      updatedAt: nowIso,
      driveFileId: resolvedDriveFileId,
      driveSyncedSignature: resolvedDriveSig,
    };

    const { assets: payloadAssets, ...boardWithoutAssets } = payload;
    const safeAssets = payloadAssets && typeof payloadAssets === 'object' ? payloadAssets : {};
    const cachedAssets = savedBoardAssetsCache.get(payload.id);
    if (!cachedAssets || !areAssetMapsEqual(cachedAssets, safeAssets)) {
      await idbSet(getLocalBoardAssetsKey(payload.id), safeAssets);
      savedBoardAssetsCache.set(payload.id, safeAssets);
    }

    await idbSet(getLocalBoardDataKey(payload.id), {
      ...boardWithoutAssets,
      hasSeparateAssets: true,
      driveFileId: resolvedDriveFileId,
      driveSyncedSignature: resolvedDriveSig,
    });
    const nextList = upsertLocalBoardMeta(existingList, meta);
    await idbSet(LOCAL_BOARDS_INDEX_KEY, nextList);

    return { meta, list: nextList };
  });
}

export async function renameLocalBoard(
  id: string,
  newTitle: string
): Promise<{ meta: LocalBoardMeta; list: LocalBoardMeta[] } | null> {
  return enqueueLibraryWrite(async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return null;

    const existingList = await listLocalBoards();
    const targetMeta = existingList.find((item) => item.id === id);
    if (!targetMeta) return null;

    const nowIso = new Date().toISOString();
    const updatedMeta: LocalBoardMeta = {
      ...targetMeta,
      title: trimmed,
      updatedAt: nowIso,
    };

    const raw = await idbGet<StoredLocalBoardRecord>(getLocalBoardDataKey(id));
    if (raw && typeof raw === 'object') {
      await idbSet(getLocalBoardDataKey(id), { ...raw, title: trimmed });
    }

    const nextList = upsertLocalBoardMeta(existingList, updatedMeta);
    await idbSet(LOCAL_BOARDS_INDEX_KEY, nextList);

    return { meta: updatedMeta, list: nextList };
  });
}

export async function duplicateLocalBoard(
  id: string
): Promise<{ meta: LocalBoardMeta; list: LocalBoardMeta[] } | null> {
  const payload = await getLocalBoardPayload(id);
  if (!payload) return null;

  const copyId = generateLocalBoardId();
  const copyTitle = `${payload.title.trim() || tr('Bảng trắng mới', 'Untitled board')} ${tr('(bản sao)', '(copy)')}`;

  return saveLocalBoard({
    ...payload,
    id: copyId,
    title: copyTitle,
    driveFileId: null,
    driveSyncedSignature: null,
  });
}

export async function deleteLocalBoard(id: string): Promise<LocalBoardMeta[]> {
  return enqueueLibraryWrite(async () => {
    const existingList = await listLocalBoards();
    const nextList = removeLocalBoardMeta(existingList, id);
    await idbDel(getLocalBoardDataKey(id));
    await idbDel(getLocalBoardAssetsKey(id));
    savedBoardAssetsCache.delete(id);
    await idbSet(LOCAL_BOARDS_INDEX_KEY, nextList);
    return nextList;
  });
}
