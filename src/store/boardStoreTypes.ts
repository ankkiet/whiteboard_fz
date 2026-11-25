import { LocalBoardMeta } from '../services/localBoardLibrary';
import { AppLanguage } from '../i18n';
import {
  BoardElement,
  BoardPattern,
  BoardType,
  Camera,
  EraserMode,
  FileCardElement,
  FileCategory,
  ImageElement,
  MathGradeMode,
  NotebookPaperSize,
  PenStyle,
  ToastMessage,
  ToolType,
} from '../types/board';
import { RenderedPageAsset } from '../engine/documentProcessor';
import { getBoardTemplate } from '../engine/boardTemplates';
import { VirtualGeometryToolsState } from '../engine/mathCurriculum';
import { getSafeMathViewport } from '../engine/mathViewport';
import { getNotebookConfig, getNotebookFitCamera } from '../engine/notebookEngine';

export interface PinnedProblemState {
  text: string;
  imageUrl?: string;
  collapsed: boolean;
}

export const DEFAULT_VIRTUAL_TOOLS: VirtualGeometryToolsState = {
  ruler: { active: false, x: -160, y: 30, angle: 0, length: 320, height: 48 },
  setSquare: { active: false, x: -110, y: 110, angle: 0, legA: 190, legB: 135 },
  protractor: { active: false, x: 0, y: 50, angle: 0, radius: 110, measureDeg: 60 },
  compass: { active: false, cx: 0, cy: 0, radius: 88, angle: -Math.PI / 6 },
};

export const STORAGE_KEY = 'smart_whiteboard_data_v2';
export const STORAGE_ASSETS_KEY = 'smart_whiteboard_assets_v2';
export const LEGACY_STORAGE_KEY = 'smart_whiteboard_data';
export const MAX_HISTORY = 80;

export function areAssetsEqual(
  a: Record<string, string> | null | undefined,
  b: Record<string, string> | null | undefined
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

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function pruneUnusedAssets(
  elements: BoardElement[],
  assets: Record<string, string>
): Record<string, string> {
  const usedAssetIds = new Set(
    elements
      .filter(
        (el): el is ImageElement | FileCardElement =>
          el.type === 'image' || el.type === 'file-card'
      )
      .map((el) => el.assetId)
  );
  const pruned: Record<string, string> = {};
  for (const id of usedAssetIds) {
    if (assets[id]) pruned[id] = assets[id];
  }
  return pruned;
}

export function isDesktopRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' ||
      (typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)))
  );
}

export function resolveBoardInitialCamera(
  boardType: BoardType,
  notebookPaperSize: NotebookPaperSize,
  options?: { useSafeMathCenter?: boolean }
): Camera {
  const viewW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;

  if (boardType === 'notebook') {
    const config = getNotebookConfig(notebookPaperSize);
    return getNotebookFitCamera({ width: viewW, height: viewH }, config);
  }

  const template = getBoardTemplate(boardType);
  if (template.centerOriginCamera && typeof window !== 'undefined') {
    if (options?.useSafeMathCenter && boardType === 'math') {
      const safeMathRect = getSafeMathViewport({
        viewW,
        viewH,
        isMathPanelOpen: true,
        isMathPanelCollapsed: false,
        isCalculatorOpen: false,
      });
      return { x: safeMathRect.centerX, y: safeMathRect.centerY, zoom: 1 };
    }
    return { x: Math.round(viewW / 2), y: Math.round(viewH / 2), zoom: 1 };
  }

  return { x: 0, y: 0, zoom: 1 };
}

export interface BoardState {
  activeLocalBoardId: string | null;
  activeDriveFileId: string | null;
  driveSyncedSignature: string | null;
  hasUserEditedCurrentBoard: boolean;
  localBoards: LocalBoardMeta[];
  isLoadingLocalBoards: boolean;
  title: string;
  elements: BoardElement[];
  selectedIds: string[];
  editingGroupId: string | null;
  editingElementId: string | null;
  previewFileCardId: string | null;
  currentTool: ToolType;
  penStyle: PenStyle;
  penOnlyMode: boolean;
  color: string;
  highlighterColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  stickyColor: string;
  eraserMode: EraserMode;
  eraserSize: number;
  camera: Camera;
  theme: 'light' | 'dark';
  isDarkMode: boolean;
  language: AppLanguage;
  boardType: BoardType;
  boardPattern: BoardPattern;
  notebookPaperSize: NotebookPaperSize;
  mathGradeMode: MathGradeMode;
  virtualTools: VirtualGeometryToolsState;
  isCalculatorOpen: boolean;
  isCalculatorMinimized: boolean;
  isMathPanelCollapsed: boolean;
  pinnedProblem: PinnedProblemState | null;
  assets: Record<string, string>;
  hasLoaded: boolean;

  // History
  history: BoardElement[][];
  historyIndex: number;

  // Toasts
  toasts: ToastMessage[];

  // Actions
  setTitle: (title: string) => void;
  setElements: (
    elements: BoardElement[] | ((prev: BoardElement[]) => BoardElement[]),
    recordHistory?: boolean
  ) => void;
  commitHistory: () => void;
  setSelectedIds: (ids: string[]) => void;
  setEditingGroupId: (id: string | null) => void;
  setEditingElementId: (id: string | null) => void;
  setPreviewFileCardId: (id: string | null) => void;
  setCurrentTool: (tool: ToolType) => void;
  setPenStyle: (penStyle: PenStyle) => void;
  setPenOnlyMode: (penOnlyMode: boolean) => void;
  setColor: (color: string) => void;
  setHighlighterColor: (color: string) => void;
  setFillColor: (fillColor: string) => void;
  setStrokeWidth: (width: number) => void;
  setFontSize: (size: number) => void;
  setStickyColor: (color: string) => void;
  setEraserMode: (mode: EraserMode) => void;
  setEraserSize: (size: number) => void;
  setCamera: (camera: Camera | ((prev: Camera) => Camera)) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: AppLanguage) => void;
  setBoardType: (boardType: BoardType) => void;
  setBoardPattern: (pattern: BoardPattern) => void;
  setNotebookPaperSize: (size: NotebookPaperSize) => void;
  setMathGradeMode: (mode: MathGradeMode) => void;
  toggleVirtualTool: (tool: keyof VirtualGeometryToolsState) => void;
  updateVirtualTool: <K extends keyof VirtualGeometryToolsState>(
    tool: K,
    patch: Partial<VirtualGeometryToolsState[K]>
  ) => void;
  arrangeVirtualTools: () => void;
  hideAllVirtualTools: () => void;
  setIsCalculatorOpen: (open: boolean) => void;
  setIsCalculatorMinimized: (minimized: boolean) => void;
  setIsMathPanelCollapsed: (collapsed: boolean) => void;
  setPinnedProblem: (problem: PinnedProblemState | null) => void;
  addAsset: (id: string, dataUrl: string) => void;
  addToast: (text: string, variant?: 'info' | 'success' | 'error') => void;
  dismissToast: (id: string) => void;

  // History actions
  undo: () => void;
  redo: () => void;

  // Element actions
  addElement: (element: BoardElement, selectAfter?: boolean) => void;
  addElementsBatch: (elements: BoardElement[], selectAfter?: boolean) => void;
  updateElement: (id: string, updates: Partial<BoardElement>, recordHistory?: boolean) => void;
  updateSelectedElements: (updater: (el: BoardElement) => BoardElement, recordHistory?: boolean) => void;
  deleteElementsByIds: (ids: string[]) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  bringSelectedForward: () => void;
  sendSelectedBackward: () => void;
  toggleLockSelected: () => void;
  insertImageFromDataUrl: (
    dataUrl: string,
    fileName?: string,
    worldDropPoint?: { x: number; y: number }
  ) => Promise<void>;
  insertDocumentPages: (
    pages: RenderedPageAsset[],
    fileName: string,
    options: {
      layout: 'row' | 'grid';
      lockPages: boolean;
      worldOrigin?: { x: number; y: number };
    }
  ) => void;
  insertFileCard: (payload: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileCategory: FileCategory;
    dataUrl: string;
    pageCount?: number;
    previewText?: string;
    worldDropPoint?: { x: number; y: number };
  }) => void;
  importBoardData: (payload: {
    title?: string;
    elements: BoardElement[];
    assets?: Record<string, string>;
    boardType?: BoardType;
    boardPattern?: BoardPattern;
    notebookPaperSize?: NotebookPaperSize;
    mathGradeMode?: MathGradeMode;
    resetHistory?: boolean;
    localBoardId?: string;
    driveFileId?: string | null;
    driveSyncedSignature?: string | null;
  }) => void;
  setDriveSyncMeta: (meta: {
    driveFileId: string | null;
    driveSyncedSignature: string | null;
  }) => void;
  startNewBoard: (
    options?:
      | string
      | {
          title?: string;
          boardType?: BoardType;
          boardPattern?: BoardPattern;
          notebookPaperSize?: NotebookPaperSize;
        }
  ) => void;
  clearBoard: () => void;

  // Multi-board local library (IndexedDB)
  refreshLocalBoards: () => Promise<void>;
  openLocalBoard: (id: string) => Promise<boolean>;
  renameLocalBoardById: (id: string, newTitle: string) => Promise<boolean>;
  duplicateLocalBoardById: (id: string) => Promise<LocalBoardMeta | null>;
  deleteLocalBoardById: (id: string) => Promise<void>;

  // Persistence
  loadFromStorage: () => Promise<void>;
  scheduleSave: () => void;
  saveToStorageNow: () => Promise<void>;
}
