import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
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
  ToastMessage,
  ToolType,
} from '../types/board';
import { RenderedPageAsset } from '../engine/documentProcessor';
import { translateElement } from '../engine/geometry';
import {
  cleanupOrphanGroups,
  duplicateElementsPreservingGroups,
  groupElements,
  ungroupElements,
} from '../engine/groupUtils';
import {
  buildStarterElementsForTemplate,
  getBoardTemplate,
  normalizeBoardPattern,
  normalizeBoardType,
  normalizeMathGradeMode,
} from '../engine/boardTemplates';
import { VirtualGeometryToolsState } from '../engine/mathCurriculum';
import { computeVirtualToolSafePoses, getSafeMathViewport } from '../engine/mathViewport';
import {
  getNotebookConfig,
  getNotebookFitCamera,
  normalizeNotebookPaperSize,
} from '../engine/notebookEngine';

export interface PinnedProblemState {
  text: string;
  imageUrl?: string;
  collapsed: boolean;
}

const DEFAULT_VIRTUAL_TOOLS: VirtualGeometryToolsState = {
  ruler: { active: false, x: -160, y: 30, angle: 0, length: 320, height: 48 },
  setSquare: { active: false, x: -110, y: 110, angle: 0, legA: 190, legB: 135 },
  protractor: { active: false, x: 0, y: 50, angle: 0, radius: 110, measureDeg: 60 },
  compass: { active: false, cx: 0, cy: 0, radius: 88, angle: -Math.PI / 6 },
};

const STORAGE_KEY = 'smart_whiteboard_data_v2';
const LEGACY_STORAGE_KEY = 'smart_whiteboard_data';
const MAX_HISTORY = 80;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

interface BoardState {
  title: string;
  elements: BoardElement[];
  selectedIds: string[];
  editingGroupId: string | null;
  editingElementId: string | null;
  previewFileCardId: string | null;
  currentTool: ToolType;
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
    resetHistory?: boolean;
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

  // Persistence
  loadFromStorage: () => Promise<void>;
  scheduleSave: () => void;
  saveToStorageNow: () => Promise<void>;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  title: 'Bảng Trắng Mới',
  elements: [],
  selectedIds: [],
  editingGroupId: null,
  editingElementId: null,
  previewFileCardId: null,
  currentTool: 'pen',
  color: '#1e293b',
  highlighterColor: '#fde047',
  fillColor: 'transparent',
  strokeWidth: 4,
  fontSize: 18,
  stickyColor: '#fef08a',
  eraserMode: 'stroke',
  eraserSize: 24,
  camera: { x: 0, y: 0, zoom: 1 },
  theme: 'light',
  isDarkMode: false,
  boardType: 'basic',
  boardPattern: 'grid',
  notebookPaperSize: 'a4',
  mathGradeMode: 'high',
  virtualTools: DEFAULT_VIRTUAL_TOOLS,
  isCalculatorOpen: false,
  isCalculatorMinimized: false,
  isMathPanelCollapsed: false,
  pinnedProblem: null,
  assets: {},
  hasLoaded: false,
  history: [[]],
  historyIndex: 0,
  toasts: [],

  setTitle: (title) => {
    set({ title });
    get().scheduleSave();
  },

  setElements: (elementsOrUpdater, recordHistory = true) => {
    const prev = get().elements;
    const next = typeof elementsOrUpdater === 'function' ? elementsOrUpdater(prev) : elementsOrUpdater;
    set({ elements: next });
    if (recordHistory) {
      get().commitHistory();
    }
  },

  commitHistory: () => {
    const { elements, history, historyIndex } = get();
    const sliced = history.slice(0, historyIndex + 1);
    sliced.push(elements);
    const trimmed = sliced.length > MAX_HISTORY ? sliced.slice(sliced.length - MAX_HISTORY) : sliced;
    set({
      history: trimmed,
      historyIndex: trimmed.length - 1,
    });
    get().scheduleSave();
  },

  setSelectedIds: (selectedIds) =>
    set((state) => ({
      selectedIds,
      editingGroupId: selectedIds.length === 0 ? null : state.editingGroupId,
    })),
  setEditingGroupId: (editingGroupId) => set({ editingGroupId }),
  setEditingElementId: (editingElementId) => set({ editingElementId }),
  setPreviewFileCardId: (previewFileCardId) => set({ previewFileCardId }),

  setCurrentTool: (currentTool) =>
    set((state) => ({
      currentTool,
      editingElementId: null,
      editingGroupId: currentTool === 'select' ? state.editingGroupId : null,
      selectedIds: currentTool === 'select' ? state.selectedIds : [],
    })),

  setColor: (color) => set({ color }),
  setHighlighterColor: (highlighterColor) => set({ highlighterColor }),
  setFillColor: (fillColor) => set({ fillColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  setStickyColor: (stickyColor) => set({ stickyColor }),
  setEraserMode: (eraserMode) => set({ eraserMode }),
  setEraserSize: (eraserSize) => set({ eraserSize }),

  setCamera: (cameraOrUpdater) =>
    set((state) => ({
      camera: typeof cameraOrUpdater === 'function' ? cameraOrUpdater(state.camera) : cameraOrUpdater,
    })),

  setTheme: (theme) => {
    const isDark = theme === 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
    }
    set({ theme, isDarkMode: isDark });
    get().scheduleSave();
  },

  setBoardType: (boardType) => {
    set({ boardType });
    get().scheduleSave();
  },

  setBoardPattern: (boardPattern) => {
    set({ boardPattern });
    get().scheduleSave();
  },

  setNotebookPaperSize: (notebookPaperSize) => {
    const safeSize = normalizeNotebookPaperSize(notebookPaperSize);
    set({ notebookPaperSize: safeSize });
    get().scheduleSave();
  },

  setMathGradeMode: (mathGradeMode) => {
    set({ mathGradeMode });
    get().scheduleSave();
  },

  toggleVirtualTool: (tool) => {
    const {
      virtualTools,
      camera,
      isCalculatorOpen,
      isCalculatorMinimized,
      isMathPanelCollapsed,
      pinnedProblem,
    } = get();
    const currentlyActive = virtualTools[tool].active;

    if (currentlyActive) {
      set({
        virtualTools: {
          ...virtualTools,
          [tool]: { ...virtualTools[tool], active: false },
        },
      });
      return;
    }

    const viewW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const safeRect = getSafeMathViewport({
      viewW,
      viewH,
      isMathPanelOpen: true,
      isMathPanelCollapsed,
      isCalculatorOpen,
      isCalculatorMinimized,
      hasPinnedProblem: Boolean(pinnedProblem),
      isPinnedProblemCollapsed: Boolean(pinnedProblem?.collapsed),
    });

    const nextActiveTools: VirtualGeometryToolsState = {
      ...virtualTools,
      [tool]: { ...virtualTools[tool], active: true },
    };
    const posed = computeVirtualToolSafePoses(nextActiveTools, camera, safeRect);
    set({ virtualTools: posed });
  },

  updateVirtualTool: (tool, patch) => {
    set((state) => ({
      virtualTools: {
        ...state.virtualTools,
        [tool]: { ...state.virtualTools[tool], ...patch },
      },
    }));
  },

  arrangeVirtualTools: () => {
    const {
      virtualTools,
      camera,
      isCalculatorOpen,
      isCalculatorMinimized,
      isMathPanelCollapsed,
      pinnedProblem,
    } = get();
    const viewW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const safeRect = getSafeMathViewport({
      viewW,
      viewH,
      isMathPanelOpen: true,
      isMathPanelCollapsed,
      isCalculatorOpen,
      isCalculatorMinimized,
      hasPinnedProblem: Boolean(pinnedProblem),
      isPinnedProblemCollapsed: Boolean(pinnedProblem?.collapsed),
    });
    set({
      virtualTools: computeVirtualToolSafePoses(virtualTools, camera, safeRect),
    });
  },

  hideAllVirtualTools: () => {
    set((state) => ({
      virtualTools: {
        ruler: { ...state.virtualTools.ruler, active: false },
        setSquare: { ...state.virtualTools.setSquare, active: false },
        protractor: { ...state.virtualTools.protractor, active: false },
        compass: { ...state.virtualTools.compass, active: false },
      },
    }));
  },

  setIsCalculatorOpen: (isCalculatorOpen) =>
    set((state) => {
      const viewW = typeof window !== 'undefined' ? window.innerWidth : 1440;
      // Auto-collapse right MathPanel to compact rail on smaller screens when calculator opens so canvas is never squeezed
      const autoCollapsePanel =
        isCalculatorOpen && viewW < 1180 ? true : state.isMathPanelCollapsed;
      return {
        isCalculatorOpen,
        isCalculatorMinimized: isCalculatorOpen ? false : state.isCalculatorMinimized,
        isMathPanelCollapsed: autoCollapsePanel,
      };
    }),
  setIsCalculatorMinimized: (isCalculatorMinimized) => set({ isCalculatorMinimized }),
  setIsMathPanelCollapsed: (isMathPanelCollapsed) => set({ isMathPanelCollapsed }),
  setPinnedProblem: (pinnedProblem) => set({ pinnedProblem }),

  addAsset: (id, dataUrl) => {
    set((state) => ({
      assets: { ...state.assets, [id]: dataUrl },
    }));
    get().scheduleSave();
  },

  addToast: (text, variant = 'info') => {
    const id = uid('toast');
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { id, text, variant }],
    }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 2800);
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      set({
        elements: history[nextIndex],
        historyIndex: nextIndex,
        selectedIds: [],
        editingGroupId: null,
        editingElementId: null,
      });
      get().scheduleSave();
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      set({
        elements: history[nextIndex],
        historyIndex: nextIndex,
        selectedIds: [],
        editingGroupId: null,
        editingElementId: null,
      });
      get().scheduleSave();
    }
  },

  addElement: (element, selectAfter = false) => {
    const elements = [...get().elements, element];
    set({
      elements,
      selectedIds: selectAfter ? [element.id] : get().selectedIds,
    });
    get().commitHistory();
  },

  addElementsBatch: (newElements, selectAfter = false) => {
    if (newElements.length === 0) return;
    const elements = [...get().elements, ...newElements];
    set({
      elements,
      selectedIds: selectAfter ? newElements.map((el) => el.id) : get().selectedIds,
      editingGroupId: null,
      currentTool: selectAfter ? 'select' : get().currentTool,
    });
    get().commitHistory();
  },

  updateElement: (id, updates, recordHistory = true) => {
    const elements = get().elements.map((el) =>
      el.id === id ? ({ ...el, ...updates } as BoardElement) : el
    );
    set({ elements });
    if (recordHistory) {
      get().commitHistory();
    }
  },

  updateSelectedElements: (updater, recordHistory = true) => {
    const selectedSet = new Set(get().selectedIds);
    if (selectedSet.size === 0) return;
    const elements = get().elements.map((el) => (selectedSet.has(el.id) ? updater(el) : el));
    set({ elements });
    if (recordHistory) {
      get().commitHistory();
    }
  },

  deleteElementsByIds: (ids) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const filtered = get().elements.filter((el) => !idSet.has(el.id) || el.isLocked);
    if (filtered.length === get().elements.length) return;
    const nextElements = cleanupOrphanGroups(filtered);
    const nextSelected = get().selectedIds.filter((id) => !idSet.has(id));
    set({
      elements: nextElements,
      selectedIds: nextSelected,
      editingGroupId: nextSelected.length === 0 ? null : get().editingGroupId,
      editingElementId: idSet.has(get().editingElementId || '') ? null : get().editingElementId,
    });
    get().commitHistory();
  },

  deleteSelected: () => {
    const { selectedIds, elements } = get();
    if (selectedIds.length === 0) return;
    const removableIds = selectedIds.filter((id) => {
      const el = elements.find((item) => item.id === id);
      return el && !el.isLocked;
    });
    if (removableIds.length === 0) {
      get().addToast('Đối tượng đang bị khóa. Mở khóa trước khi xóa.', 'info');
      return;
    }
    get().deleteElementsByIds(removableIds);
  },

  duplicateSelected: () => {
    const { elements, selectedIds } = get();
    if (selectedIds.length === 0) return;

    const { duplicated, newSelectedIds } = duplicateElementsPreservingGroups(
      elements,
      selectedIds,
      uid,
      24,
      24
    );
    if (duplicated.length === 0) return;

    set({
      elements: [...elements, ...duplicated],
      selectedIds: newSelectedIds,
      editingGroupId: null,
    });
    get().commitHistory();
    get().addToast('Đã nhân bản đối tượng', 'success');
  },

  groupSelected: () => {
    const { elements, selectedIds, editingGroupId } = get();
    const res = groupElements(elements, selectedIds, uid('grp'), editingGroupId);
    if (!res.changed) return;

    set({
      elements: res.elements,
      selectedIds: res.selectedIds,
    });
    get().commitHistory();
    get().addToast(`Đã nhóm ${res.selectedIds.length} đối tượng`, 'success');
  },

  ungroupSelected: () => {
    const { elements, selectedIds, editingGroupId } = get();
    const res = ungroupElements(elements, selectedIds, editingGroupId);
    if (!res.changed) return;

    set({
      elements: res.elements,
      selectedIds: res.selectedIds,
      editingGroupId: null,
    });
    get().commitHistory();
    get().addToast('Đã bỏ nhóm đối tượng', 'info');
  },

  nudgeSelected: (dx, dy) => {
    const { selectedIds, elements } = get();
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    let moved = false;
    const next = elements.map((el) => {
      if (!selectedSet.has(el.id) || el.isLocked) return el;
      moved = true;
      return translateElement(el, dx, dy);
    });
    if (!moved) return;
    set({ elements: next });
    get().commitHistory();
  },

  bringSelectedForward: () => {
    const { elements, selectedIds } = get();
    if (selectedIds.length === 0) return;
    let maxZ = elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0);
    const selectedSet = new Set(selectedIds);
    const next = elements.map((el) => {
      if (!selectedSet.has(el.id)) return el;
      maxZ += 1;
      return { ...el, zIndex: maxZ };
    });
    set({ elements: next });
    get().commitHistory();
  },

  sendSelectedBackward: () => {
    const { elements, selectedIds } = get();
    if (selectedIds.length === 0) return;
    let minZ = elements.reduce((min, el) => Math.min(min, el.zIndex || 0), 0);
    const selectedSet = new Set(selectedIds);
    const next = elements.map((el) => {
      if (!selectedSet.has(el.id)) return el;
      minZ -= 1;
      return { ...el, zIndex: minZ };
    });
    set({ elements: next });
    get().commitHistory();
  },

  toggleLockSelected: () => {
    const { elements, selectedIds } = get();
    if (selectedIds.length === 0) return;
    const selectedEls = elements.filter((el) => selectedIds.includes(el.id));
    const allLocked = selectedEls.every((el) => el.isLocked);
    const nextLocked = !allLocked;
    get().updateSelectedElements((el) => ({ ...el, isLocked: nextLocked }), true);
    get().addToast(nextLocked ? 'Đã khóa đối tượng' : 'Đã mở khóa đối tượng', 'info');
  },

  insertImageFromDataUrl: async (dataUrl, fileName, worldDropPoint) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const { camera, elements } = get();
        const assetId = uid('asset');
        get().addAsset(assetId, dataUrl);

        const maxDisplayW = 460;
        const maxDisplayH = 380;
        let width = img.naturalWidth || 320;
        let height = img.naturalHeight || 240;
        const scale = Math.min(1, maxDisplayW / width, maxDisplayH / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const worldCenter = worldDropPoint ?? {
          x: (window.innerWidth / 2 - camera.x) / camera.zoom,
          y: (window.innerHeight / 2 - camera.y) / camera.zoom,
        };

        const maxZ = elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0);
        const imageEl: ImageElement = {
          id: uid('el'),
          type: 'image',
          x: worldCenter.x - width / 2,
          y: worldCenter.y - height / 2,
          width,
          height,
          assetId,
          fileName: fileName || 'image.png',
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          zIndex: maxZ + 1,
        };

        set({
          elements: [...get().elements, imageEl],
          selectedIds: [imageEl.id],
          currentTool: 'select',
        });
        get().commitHistory();
        get().addToast('Đã chèn hình ảnh vào bảng', 'success');
        resolve();
      };
      img.onerror = () => {
        get().addToast('Không thể đọc tệp hình ảnh này.', 'error');
        resolve();
      };
      img.src = dataUrl;
    });
  },

  insertDocumentPages: (pages, fileName, options) => {
    if (pages.length === 0) return;
    const { camera, elements, assets } = get();
    const { layout, lockPages, worldOrigin } = options;

    const origin = worldOrigin ?? {
      x: (window.innerWidth / 2 - camera.x) / camera.zoom - 260,
      y: (window.innerHeight / 2 - camera.y) / camera.zoom - 260,
    };

    const nextAssets = { ...assets };
    const newElements: ImageElement[] = [];
    let maxZ = elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0);

    const targetWidth = 480;
    const gap = 36;
    const cols = layout === 'grid' ? 2 : pages.length;

    let cursorX = origin.x;
    let cursorY = origin.y;
    let rowMaxH = 0;

    pages.forEach((page, idx) => {
      const assetId = uid('docpage');
      nextAssets[assetId] = page.dataUrl;

      const aspect = page.height > 0 ? page.width / page.height : 0.707;
      const w = targetWidth;
      const h = Math.round(w / aspect);

      if (layout === 'grid' && idx > 0 && idx % cols === 0) {
        cursorX = origin.x;
        cursorY += rowMaxH + gap;
        rowMaxH = 0;
      }

      maxZ += 1;
      newElements.push({
        id: uid('el'),
        type: 'image',
        x: cursorX,
        y: cursorY,
        width: w,
        height: h,
        assetId,
        fileName: `${fileName} (Trang ${page.pageNumber})`,
        naturalWidth: page.width,
        naturalHeight: page.height,
        isLocked: lockPages,
        zIndex: maxZ,
      });

      cursorX += w + gap;
      rowMaxH = Math.max(rowMaxH, h);
    });

    set({
      assets: nextAssets,
      elements: [...elements, ...newElements],
      selectedIds: lockPages ? [] : newElements.map((el) => el.id),
      currentTool: lockPages ? 'pen' : 'select',
    });
    get().commitHistory();
    get().addToast(
      `Đã trải ${pages.length} trang từ "${fileName}" lên bảng`,
      'success'
    );
  },

  insertFileCard: (payload) => {
    const { camera, elements } = get();
    const assetId = uid('file');
    get().addAsset(assetId, payload.dataUrl);

    const cardW = 300;
    const cardH = 116;
    const center = payload.worldDropPoint ?? {
      x: (window.innerWidth / 2 - camera.x) / camera.zoom,
      y: (window.innerHeight / 2 - camera.y) / camera.zoom,
    };

    const maxZ = elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0);
    const cardEl: FileCardElement = {
      id: uid('el'),
      type: 'file-card',
      x: center.x - cardW / 2,
      y: center.y - cardH / 2,
      width: cardW,
      height: cardH,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      mimeType: payload.mimeType,
      fileCategory: payload.fileCategory,
      assetId,
      pageCount: payload.pageCount,
      previewText: payload.previewText,
      zIndex: maxZ + 1,
    };

    set({
      elements: [...get().elements, cardEl],
      selectedIds: [cardEl.id],
      currentTool: 'select',
    });
    get().commitHistory();
    get().addToast(`Đã đính kèm thẻ tài liệu "${payload.fileName}"`, 'success');
  },

  importBoardData: ({
    title,
    elements,
    assets,
    boardType,
    boardPattern,
    notebookPaperSize,
    resetHistory = false,
  }) => {
    const safeElements = Array.isArray(elements) ? elements : [];
    const resolvedType = boardType ? normalizeBoardType(boardType) : 'basic';
    const template = getBoardTemplate(resolvedType);
    const resolvedPattern = boardPattern
      ? normalizeBoardPattern(boardPattern)
      : boardType
      ? template.pattern
      : get().boardPattern;
    const resolvedPaperSize = notebookPaperSize
      ? normalizeNotebookPaperSize(notebookPaperSize)
      : get().notebookPaperSize;

    const viewW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;
    let centeredCamera: Camera;
    if (resolvedType === 'notebook') {
      const config = getNotebookConfig(resolvedPaperSize);
      centeredCamera = getNotebookFitCamera({ width: viewW, height: viewH }, config);
    } else if (template.centerOriginCamera && typeof window !== 'undefined') {
      centeredCamera = {
        x: Math.round(window.innerWidth / 2),
        y: Math.round(window.innerHeight / 2),
        zoom: 1,
      };
    } else {
      centeredCamera = { x: 0, y: 0, zoom: 1 };
    }

    if (resetHistory) {
      set({
        title: title || template.defaultTitle,
        boardType: resolvedType,
        boardPattern: resolvedPattern,
        notebookPaperSize: resolvedPaperSize,
        elements: safeElements,
        assets: assets || {},
        selectedIds: [],
        editingGroupId: null,
        editingElementId: null,
        previewFileCardId: null,
        camera: centeredCamera,
        history: [safeElements],
        historyIndex: 0,
      });
      get().scheduleSave();
    } else {
      set({
        title: title || get().title,
        boardType: boardType ? resolvedType : get().boardType,
        boardPattern: boardPattern ? resolvedPattern : get().boardPattern,
        notebookPaperSize: notebookPaperSize ? resolvedPaperSize : get().notebookPaperSize,
        elements: safeElements,
        assets: { ...get().assets, ...(assets || {}) },
        selectedIds: [],
        editingGroupId: null,
        editingElementId: null,
      });
      get().commitHistory();
    }
    get().addToast('Đã mở bảng trắng thành công', 'success');
  },

  startNewBoard: (options) => {
    const resolvedType: BoardType =
      typeof options === 'object' && options?.boardType
        ? normalizeBoardType(options.boardType)
        : 'basic';
    const resolvedPaperSize: NotebookPaperSize =
      typeof options === 'object' && options?.notebookPaperSize
        ? normalizeNotebookPaperSize(options.notebookPaperSize)
        : 'a4';
    const template = getBoardTemplate(resolvedType);
    const resolvedPattern: BoardPattern =
      typeof options === 'object' && options?.boardPattern
        ? normalizeBoardPattern(options.boardPattern)
        : template.pattern;
    const resolvedTitle =
      typeof options === 'string'
        ? options.trim() || template.defaultTitle
        : options?.title?.trim() || template.defaultTitle;

    const starterElements = buildStarterElementsForTemplate(resolvedType, uid);
    const viewW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const safeMathRect = getSafeMathViewport({
      viewW,
      viewH,
      isMathPanelOpen: resolvedType === 'math',
      isMathPanelCollapsed: false,
      isCalculatorOpen: false,
    });
    let initialCamera: Camera;
    if (resolvedType === 'notebook') {
      const config = getNotebookConfig(resolvedPaperSize);
      initialCamera = getNotebookFitCamera({ width: viewW, height: viewH }, config);
    } else if (template.centerOriginCamera) {
      initialCamera = {
        x: resolvedType === 'math' ? safeMathRect.centerX : Math.round(viewW / 2),
        y: resolvedType === 'math' ? safeMathRect.centerY : Math.round(viewH / 2),
        zoom: 1,
      };
    } else {
      initialCamera = { x: 0, y: 0, zoom: 1 };
    }

    set({
      title: resolvedTitle,
      boardType: resolvedType,
      boardPattern: resolvedPattern,
      notebookPaperSize: resolvedPaperSize,
      elements: starterElements,
      assets: {},
      selectedIds: [],
      editingGroupId: null,
      editingElementId: null,
      previewFileCardId: null,
      camera: initialCamera,
      history: [starterElements],
      historyIndex: 0,
      currentTool: template.defaultTool,
      virtualTools: DEFAULT_VIRTUAL_TOOLS,
      isMathPanelCollapsed: false,
    });
    get().scheduleSave();
  },

  clearBoard: () => {
    set({ elements: [], selectedIds: [], editingGroupId: null, editingElementId: null });
    get().commitHistory();
    get().addToast('Đã xóa toàn bộ nội dung bảng', 'info');
  },

  loadFromStorage: async () => {
    try {
      const savedData =
        (await idbGet<any>(STORAGE_KEY)) || (await idbGet<any>(LEGACY_STORAGE_KEY));
      if (savedData) {
        const {
          elements,
          title,
          theme,
          boardType,
          boardPattern,
          notebookPaperSize,
          mathGradeMode,
          assets,
        } = savedData;
        const safeElements: BoardElement[] = Array.isArray(elements) ? elements : [];
        const safeTheme: 'light' | 'dark' = theme === 'dark' ? 'dark' : 'light';
        const safeType = normalizeBoardType(boardType);
        const safePattern = normalizeBoardPattern(boardPattern || getBoardTemplate(safeType).pattern);
        const safePaperSize = normalizeNotebookPaperSize(notebookPaperSize);
        const safeGradeMode = normalizeMathGradeMode(mathGradeMode);
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', safeTheme === 'dark');
        }
        let initialCamera: Camera;
        if (safeType === 'notebook' && typeof window !== 'undefined') {
          const config = getNotebookConfig(safePaperSize);
          initialCamera = getNotebookFitCamera(
            { width: window.innerWidth, height: window.innerHeight },
            config
          );
        } else if (safeType === 'math' && typeof window !== 'undefined') {
          initialCamera = {
            x: Math.round(window.innerWidth / 2),
            y: Math.round(window.innerHeight / 2),
            zoom: 1,
          };
        } else {
          initialCamera = { x: 0, y: 0, zoom: 1 };
        }
        set({
          elements: safeElements,
          history: [safeElements],
          historyIndex: 0,
          title: title || 'Bảng Trắng Mới',
          theme: safeTheme,
          isDarkMode: safeTheme === 'dark',
          boardType: safeType,
          boardPattern: safePattern,
          notebookPaperSize: safePaperSize,
          mathGradeMode: safeGradeMode,
          camera: initialCamera,
          assets: assets || {},
          hasLoaded: true,
        });
      } else {
        set({ hasLoaded: true });
      }
    } catch (e) {
      console.error('Failed to load from IndexedDB', e);
      set({ hasLoaded: true });
    }
  },

  scheduleSave: () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      void get().saveToStorageNow();
    }, 300);
  },

  saveToStorageNow: async () => {
    try {
      const {
        elements,
        title,
        theme,
        boardType,
        boardPattern,
        notebookPaperSize,
        mathGradeMode,
        assets,
      } = get();
      // Prune unreferenced assets to keep IndexedDB lean
      const usedAssetIds = new Set(
        elements
          .filter(
            (el): el is ImageElement | FileCardElement =>
              el.type === 'image' || el.type === 'file-card'
          )
          .map((el) => el.assetId)
      );
      const prunedAssets: Record<string, string> = {};
      for (const id of usedAssetIds) {
        if (assets[id]) prunedAssets[id] = assets[id];
      }

      await idbSet(STORAGE_KEY, {
        elements,
        title,
        theme,
        boardType,
        boardPattern,
        notebookPaperSize,
        mathGradeMode,
        assets: prunedAssets,
      });
    } catch (e) {
      console.error('Failed to save to IndexedDB', e);
    }
  },
}));
