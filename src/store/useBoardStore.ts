import { create } from 'zustand';
import { normalizeNotebookPaperSize } from '../engine/notebookEngine';
import { getBoardTemplate, isDefaultBoardTitle } from '../engine/boardTemplates';
import { getAppLanguage, setAppLanguageState, tr } from '../i18n';
import { BoardState, uid } from './boardStoreTypes';
import { createElementsSlice } from './slices/elementsSlice';
import { createMathToolsSlice } from './slices/mathToolsSlice';
import { createPersistenceSlice } from './slices/persistenceSlice';

export type { BoardState, PinnedProblemState } from './boardStoreTypes';

export const useBoardStore = create<BoardState>()((set, get, api) => ({
  // Core board metadata, tools, camera, theme & toasts
  title: tr('Bảng trắng mới', 'Untitled board'),
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
  language: getAppLanguage(),
  boardType: 'basic',
  boardPattern: 'grid',
  notebookPaperSize: 'a4',
  toasts: [],

  setTitle: (title) => {
    set({ title, hasUserEditedCurrentBoard: true });
    get().scheduleSave();
  },

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

  setLanguage: (language) => {
    setAppLanguageState(language);
    const state = get();
    const shouldSyncDefaultTitle =
      !state.hasUserEditedCurrentBoard &&
      state.elements.length === 0 &&
      !state.activeLocalBoardId &&
      !state.activeDriveFileId &&
      isDefaultBoardTitle(state.title);
    set({
      language,
      ...(shouldSyncDefaultTitle
        ? { title: getBoardTemplate(state.boardType, language).defaultTitle }
        : {}),
    });
  },

  setBoardType: (boardType) => {
    set({ boardType, hasUserEditedCurrentBoard: true });
    get().scheduleSave();
  },

  setBoardPattern: (boardPattern) => {
    set({ boardPattern, hasUserEditedCurrentBoard: true });
    get().scheduleSave();
  },

  setNotebookPaperSize: (notebookPaperSize) => {
    const safeSize = normalizeNotebookPaperSize(notebookPaperSize);
    set({ notebookPaperSize: safeSize, hasUserEditedCurrentBoard: true });
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

  // Composed domain slices
  ...createElementsSlice(set, get, api),
  ...createMathToolsSlice(set, get, api),
  ...createPersistenceSlice(set, get, api),
}));
