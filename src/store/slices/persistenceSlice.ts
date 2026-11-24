import { StateCreator } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import {
  LocalBoardPayload,
  deleteLocalBoard,
  duplicateLocalBoard,
  generateLocalBoardId,
  getLocalBoardPayload,
  listLocalBoards,
  renameLocalBoard,
  saveLocalBoard,
  shouldPersistBoardToLibrary,
} from '../../services/localBoardLibrary';
import { BoardElement, BoardPattern, BoardType, NotebookPaperSize } from '../../types/board';
import {
  buildStarterElementsForTemplate,
  getBoardTemplate,
  normalizeBoardPattern,
  normalizeBoardType,
  normalizeMathGradeMode,
} from '../../engine/boardTemplates';
import { normalizeNotebookPaperSize } from '../../engine/notebookEngine';
import {
  BoardState,
  DEFAULT_VIRTUAL_TOOLS,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  isDesktopRuntime,
  pruneUnusedAssets,
  resolveBoardInitialCamera,
  uid,
} from '../boardStoreTypes';

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function clearScheduledSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}

function preserveCurrentBoardInLibrary(
  prevState: BoardState,
  onSaved: (list: BoardState['localBoards']) => void
): void {
  clearScheduledSave();
  if (
    !shouldPersistBoardToLibrary({
      elementCount: prevState.elements.length,
      activeLocalBoardId: prevState.activeLocalBoardId,
      hasUserEditedCurrentBoard: prevState.hasUserEditedCurrentBoard,
    })
  ) {
    return;
  }

  const prevId = prevState.activeLocalBoardId || generateLocalBoardId();
  const prevSnapshot: LocalBoardPayload = {
    id: prevId,
    title: prevState.title,
    elements: prevState.elements,
    assets: pruneUnusedAssets(prevState.elements, prevState.assets),
    theme: prevState.theme,
    boardType: prevState.boardType,
    boardPattern: prevState.boardPattern,
    notebookPaperSize: prevState.notebookPaperSize,
    mathGradeMode: prevState.mathGradeMode,
  };
  void saveLocalBoard(prevSnapshot).then(({ list }) => {
    onSaved(list);
  });
}

export type PersistenceSlice = Pick<
  BoardState,
  | 'activeLocalBoardId'
  | 'hasUserEditedCurrentBoard'
  | 'localBoards'
  | 'isLoadingLocalBoards'
  | 'hasLoaded'
  | 'importBoardData'
  | 'startNewBoard'
  | 'refreshLocalBoards'
  | 'openLocalBoard'
  | 'renameLocalBoardById'
  | 'duplicateLocalBoardById'
  | 'deleteLocalBoardById'
  | 'loadFromStorage'
  | 'scheduleSave'
  | 'saveToStorageNow'
>;

export const createPersistenceSlice: StateCreator<BoardState, [], [], PersistenceSlice> = (
  set,
  get
) => ({
  activeLocalBoardId: null,
  hasUserEditedCurrentBoard: false,
  localBoards: [],
  isLoadingLocalBoards: false,
  hasLoaded: false,

  importBoardData: ({
    title,
    elements,
    assets,
    boardType,
    boardPattern,
    notebookPaperSize,
    resetHistory = false,
    localBoardId,
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

    const centeredCamera = resolveBoardInitialCamera(resolvedType, resolvedPaperSize);

    if (resetHistory) {
      preserveCurrentBoardInLibrary(get(), (list) => set({ localBoards: list }));

      const hasImportedContent = safeElements.length > 0;
      const nextLocalId = hasImportedContent ? localBoardId || generateLocalBoardId() : null;
      set({
        activeLocalBoardId: nextLocalId,
        hasUserEditedCurrentBoard: hasImportedContent,
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
      void get().saveToStorageNow();
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
    preserveCurrentBoardInLibrary(get(), (list) => set({ localBoards: list }));

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
    const initialCamera = resolveBoardInitialCamera(resolvedType, resolvedPaperSize, {
      useSafeMathCenter: true,
    });

    // Do NOT assign a library ID yet; board will only be added to the library once the user draws/writes.
    set({
      activeLocalBoardId: null,
      hasUserEditedCurrentBoard: false,
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
    void get().saveToStorageNow();
  },

  refreshLocalBoards: async () => {
    set({ isLoadingLocalBoards: true });
    try {
      const list = await listLocalBoards();
      set({ localBoards: list, isLoadingLocalBoards: false });
    } catch {
      set({ isLoadingLocalBoards: false });
    }
  },

  openLocalBoard: async (id) => {
    try {
      const curr = get();
      if (curr.activeLocalBoardId && curr.activeLocalBoardId !== id) {
        await curr.saveToStorageNow();
      }

      const payload = await getLocalBoardPayload(id);
      if (!payload) {
        get().addToast(
          isDesktopRuntime()
            ? 'Không tìm thấy dữ liệu bảng trên máy.'
            : 'Không tìm thấy dữ liệu bảng trên trình duyệt.',
          'error'
        );
        return false;
      }

      const safeType = normalizeBoardType(payload.boardType);
      const template = getBoardTemplate(safeType);
      const safePattern = normalizeBoardPattern(payload.boardPattern || template.pattern);
      const safePaperSize = normalizeNotebookPaperSize(payload.notebookPaperSize);
      const safeGradeMode = normalizeMathGradeMode(payload.mathGradeMode);
      const initialCamera = resolveBoardInitialCamera(safeType, safePaperSize);

      set({
        activeLocalBoardId: id,
        hasUserEditedCurrentBoard: false,
        title: payload.title,
        elements: payload.elements,
        assets: payload.assets,
        boardType: safeType,
        boardPattern: safePattern,
        notebookPaperSize: safePaperSize,
        mathGradeMode: safeGradeMode,
        selectedIds: [],
        editingGroupId: null,
        editingElementId: null,
        previewFileCardId: null,
        camera: initialCamera,
        history: [payload.elements],
        historyIndex: 0,
        currentTool: template.defaultTool,
        virtualTools: DEFAULT_VIRTUAL_TOOLS,
        isMathPanelCollapsed: false,
      });

      await idbSet(STORAGE_KEY, {
        activeLocalBoardId: id,
        elements: payload.elements,
        title: payload.title,
        theme: get().theme,
        boardType: safeType,
        boardPattern: safePattern,
        notebookPaperSize: safePaperSize,
        mathGradeMode: safeGradeMode,
        assets: pruneUnusedAssets(payload.elements, payload.assets),
      });

      return true;
    } catch (e) {
      console.error('Failed to open local board', e);
      get().addToast(
        isDesktopRuntime()
          ? 'Không thể mở bảng từ bộ nhớ máy.'
          : 'Không thể mở bảng từ bộ nhớ trình duyệt.',
        'error'
      );
      return false;
    }
  },

  renameLocalBoardById: async (id, newTitle) => {
    const res = await renameLocalBoard(id, newTitle);
    if (!res) return false;
    set((state) => ({
      localBoards: res.list,
      title: state.activeLocalBoardId === id ? res.meta.title : state.title,
    }));
    if (get().activeLocalBoardId === id) {
      await get().saveToStorageNow();
    }
    get().addToast(`Đã đổi tên thành "${res.meta.title}"`, 'success');
    return true;
  },

  duplicateLocalBoardById: async (id) => {
    if (get().activeLocalBoardId === id) {
      await get().saveToStorageNow();
    }
    const res = await duplicateLocalBoard(id);
    if (!res) {
      get().addToast('Không thể nhân bản bảng này.', 'error');
      return null;
    }
    set({ localBoards: res.list });
    get().addToast(`Đã tạo bản sao "${res.meta.title}"`, 'success');
    return res.meta;
  },

  deleteLocalBoardById: async (id) => {
    const nextList = await deleteLocalBoard(id);
    const wasActive = get().activeLocalBoardId === id;
    set({ localBoards: nextList });

    if (wasActive) {
      if (nextList.length > 0) {
        await get().openLocalBoard(nextList[0].id);
      } else {
        set({
          activeLocalBoardId: null,
          title: 'Bảng trắng mới',
          elements: [],
          assets: {},
          selectedIds: [],
          editingGroupId: null,
          editingElementId: null,
          previewFileCardId: null,
          history: [[]],
          historyIndex: 0,
        });
        await idbSet(STORAGE_KEY, {
          activeLocalBoardId: null,
          elements: [],
          title: 'Bảng trắng mới',
          theme: get().theme,
          boardType: get().boardType,
          boardPattern: get().boardPattern,
          notebookPaperSize: get().notebookPaperSize,
          mathGradeMode: get().mathGradeMode,
          assets: {},
        });
      }
    }
    get().addToast(
      isDesktopRuntime() ? 'Đã xóa bảng khỏi bộ nhớ máy' : 'Đã xóa bảng khỏi bộ nhớ trình duyệt',
      'info'
    );
  },

  loadFromStorage: async () => {
    set({ isLoadingLocalBoards: true });
    try {
      let localList = await listLocalBoards();
      const savedData =
        (await idbGet<any>(STORAGE_KEY)) || (await idbGet<any>(LEGACY_STORAGE_KEY));

      if (savedData) {
        const {
          activeLocalBoardId,
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
        const safeTitle = title || 'Bảng trắng mới';
        const safeAssets = assets || {};

        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', safeTheme === 'dark');
        }
        const initialCamera = resolveBoardInitialCamera(safeType, safePaperSize);

        let resolvedLocalId: string | null =
          typeof activeLocalBoardId === 'string' && activeLocalBoardId ? activeLocalBoardId : null;

        const existsInIndex = resolvedLocalId
          ? localList.some((item) => item.id === resolvedLocalId)
          : false;
        if (!existsInIndex && safeElements.length > 0) {
          resolvedLocalId = resolvedLocalId || generateLocalBoardId();
          const migrated = await saveLocalBoard({
            id: resolvedLocalId,
            title: safeTitle,
            elements: safeElements,
            assets: pruneUnusedAssets(safeElements, safeAssets),
            theme: safeTheme,
            boardType: safeType,
            boardPattern: safePattern,
            notebookPaperSize: safePaperSize,
            mathGradeMode: safeGradeMode,
          });
          localList = migrated.list;
          await idbSet(STORAGE_KEY, {
            ...savedData,
            activeLocalBoardId: resolvedLocalId,
          });
        } else if (!existsInIndex && safeElements.length === 0) {
          resolvedLocalId = null;
        }

        set({
          activeLocalBoardId: resolvedLocalId,
          hasUserEditedCurrentBoard: false,
          localBoards: localList,
          isLoadingLocalBoards: false,
          elements: safeElements,
          history: [safeElements],
          historyIndex: 0,
          title: safeTitle,
          theme: safeTheme,
          isDarkMode: safeTheme === 'dark',
          boardType: safeType,
          boardPattern: safePattern,
          notebookPaperSize: safePaperSize,
          mathGradeMode: safeGradeMode,
          camera: initialCamera,
          assets: safeAssets,
          hasLoaded: true,
        });
      } else if (localList.length > 0) {
        set({ localBoards: localList, isLoadingLocalBoards: false, hasLoaded: true });
        await get().openLocalBoard(localList[0].id);
      } else {
        set({ localBoards: localList, isLoadingLocalBoards: false, hasLoaded: true });
      }
    } catch (e) {
      console.error('Failed to load from IndexedDB', e);
      set({ isLoadingLocalBoards: false, hasLoaded: true });
    }
  },

  scheduleSave: () => {
    clearScheduledSave();
    saveTimeout = setTimeout(() => {
      void get().saveToStorageNow();
    }, 300);
  },

  saveToStorageNow: async () => {
    try {
      const state = get();
      const {
        elements,
        title,
        theme,
        boardType,
        boardPattern,
        notebookPaperSize,
        mathGradeMode,
        assets,
      } = state;

      const prunedAssets = pruneUnusedAssets(elements, assets);
      const shouldPersist = shouldPersistBoardToLibrary({
        elementCount: elements.length,
        activeLocalBoardId: state.activeLocalBoardId,
        hasUserEditedCurrentBoard: state.hasUserEditedCurrentBoard,
      });

      let activeId = state.activeLocalBoardId;
      if (shouldPersist && !activeId) {
        activeId = generateLocalBoardId();
        set({ activeLocalBoardId: activeId });
      }

      await idbSet(STORAGE_KEY, {
        activeLocalBoardId: activeId,
        elements,
        title,
        theme,
        boardType,
        boardPattern,
        notebookPaperSize,
        mathGradeMode,
        assets: prunedAssets,
      });

      if (shouldPersist && activeId) {
        const saved = await saveLocalBoard({
          id: activeId,
          title,
          elements,
          assets: prunedAssets,
          theme,
          boardType,
          boardPattern,
          notebookPaperSize,
          mathGradeMode,
        });
        set({ localBoards: saved.list });
      }
    } catch (e) {
      console.error('Failed to save to IndexedDB', e);
    }
  },
});
