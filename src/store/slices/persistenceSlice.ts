import { StateCreator } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import {
  LocalBoardPayload,
  deleteLocalBoard,
  duplicateLocalBoard,
  findLocalBoardByDriveFileId,
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
  MAX_HISTORY,
  STORAGE_ASSETS_KEY,
  STORAGE_KEY,
  areAssetsEqual,
  isDesktopRuntime,
  pruneUnusedAssets,
  resolveBoardInitialCamera,
  uid,
} from '../boardStoreTypes';

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let boardSessionEpoch = 0;
let lastSavedActiveAssets: Record<string, string> | null = null;

async function persistActiveBoardSnapshot(
  snapshot: {
    activeLocalBoardId: string | null;
    activeDriveFileId: string | null;
    driveSyncedSignature: string | null;
    elements: BoardElement[];
    title: string;
    theme: 'light' | 'dark';
    boardType: BoardType;
    boardPattern: BoardPattern;
    notebookPaperSize: NotebookPaperSize;
    mathGradeMode: string;
  },
  prunedAssets: Record<string, string>
): Promise<void> {
  if (!lastSavedActiveAssets || !areAssetsEqual(prunedAssets, lastSavedActiveAssets)) {
    await idbSet(STORAGE_ASSETS_KEY, prunedAssets);
    lastSavedActiveAssets = prunedAssets;
  }
  await idbSet(STORAGE_KEY, {
    ...snapshot,
    hasSeparateAssets: true,
  });
}

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
  const alreadyInLibrary = prevState.activeLocalBoardId
    ? prevState.localBoards.some((b) => b.id === prevState.activeLocalBoardId)
    : false;
  if (
    !alreadyInLibrary &&
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
    driveFileId: prevState.activeDriveFileId,
    driveSyncedSignature: prevState.driveSyncedSignature,
  };
  void saveLocalBoard(prevSnapshot).then(({ list }) => {
    onSaved(list);
  });
}

export type PersistenceSlice = Pick<
  BoardState,
  | 'activeLocalBoardId'
  | 'activeDriveFileId'
  | 'driveSyncedSignature'
  | 'hasUserEditedCurrentBoard'
  | 'localBoards'
  | 'isLoadingLocalBoards'
  | 'hasLoaded'
  | 'importBoardData'
  | 'setDriveSyncMeta'
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
  activeDriveFileId: null,
  driveSyncedSignature: null,
  hasUserEditedCurrentBoard: false,
  localBoards: [],
  isLoadingLocalBoards: false,
  hasLoaded: false,

  setDriveSyncMeta: ({ driveFileId, driveSyncedSignature }) => {
    set({
      activeDriveFileId: driveFileId,
      driveSyncedSignature,
    });
    void get().saveToStorageNow();
  },

  importBoardData: ({
    title,
    elements,
    assets,
    boardType,
    boardPattern,
    notebookPaperSize,
    mathGradeMode,
    resetHistory = false,
    localBoardId,
    driveFileId,
    driveSyncedSignature,
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
    const resolvedGradeMode = mathGradeMode
      ? normalizeMathGradeMode(mathGradeMode)
      : get().mathGradeMode;

    const centeredCamera = resolveBoardInitialCamera(resolvedType, resolvedPaperSize);

    if (resetHistory) {
      boardSessionEpoch += 1;
      preserveCurrentBoardInLibrary(get(), (list) => set({ localBoards: list }));

      const existingDriveMatch = driveFileId
        ? findLocalBoardByDriveFileId(get().localBoards, driveFileId)
        : undefined;
      const hasImportedContent = safeElements.length > 0;
      const matchedId = localBoardId || existingDriveMatch?.id || null;
      const nextLocalId = matchedId || (hasImportedContent ? generateLocalBoardId() : null);

      set({
        activeLocalBoardId: nextLocalId,
        activeDriveFileId: driveFileId ?? null,
        driveSyncedSignature: driveSyncedSignature ?? null,
        hasUserEditedCurrentBoard: driveFileId ? false : hasImportedContent,
        title: title || template.defaultTitle,
        boardType: resolvedType,
        boardPattern: resolvedPattern,
        notebookPaperSize: resolvedPaperSize,
        mathGradeMode: resolvedGradeMode,
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
    } else if (driveFileId) {
      // Opening another Drive board from inside EditorModal: preserve the previous local board
      // instead of overwriting it, while keeping undo history so Ctrl+Z still works.
      boardSessionEpoch += 1;
      preserveCurrentBoardInLibrary(get(), (list) => set({ localBoards: list }));

      const prev = get();
      const existingDriveMatch = findLocalBoardByDriveFileId(prev.localBoards, driveFileId);
      const hasImportedContent = safeElements.length > 0;
      const matchedId = localBoardId || existingDriveMatch?.id || null;
      const nextLocalId = matchedId || (hasImportedContent ? generateLocalBoardId() : null);

      const sliced = prev.history.slice(0, prev.historyIndex + 1);
      sliced.push(safeElements);
      const trimmed =
        sliced.length > MAX_HISTORY ? sliced.slice(sliced.length - MAX_HISTORY) : sliced;

      set({
        activeLocalBoardId: nextLocalId,
        activeDriveFileId: driveFileId,
        driveSyncedSignature: driveSyncedSignature ?? null,
        hasUserEditedCurrentBoard: false,
        title: title || prev.title,
        boardType: boardType ? resolvedType : prev.boardType,
        boardPattern: boardPattern ? resolvedPattern : prev.boardPattern,
        notebookPaperSize: notebookPaperSize ? resolvedPaperSize : prev.notebookPaperSize,
        mathGradeMode: mathGradeMode ? resolvedGradeMode : prev.mathGradeMode,
        elements: safeElements,
        assets: { ...prev.assets, ...(assets || {}) },
        selectedIds: [],
        editingGroupId: null,
        editingElementId: null,
        history: trimmed,
        historyIndex: trimmed.length - 1,
      });
      void get().saveToStorageNow();
    } else {
      set({
        title: title || get().title,
        boardType: boardType ? resolvedType : get().boardType,
        boardPattern: boardPattern ? resolvedPattern : get().boardPattern,
        notebookPaperSize: notebookPaperSize ? resolvedPaperSize : get().notebookPaperSize,
        mathGradeMode: mathGradeMode ? resolvedGradeMode : get().mathGradeMode,
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
    boardSessionEpoch += 1;
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
      activeDriveFileId: null,
      driveSyncedSignature: null,
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
      clearScheduledSave();
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

      boardSessionEpoch += 1;
      const safeType = normalizeBoardType(payload.boardType);
      const template = getBoardTemplate(safeType);
      const safePattern = normalizeBoardPattern(payload.boardPattern || template.pattern);
      const safePaperSize = normalizeNotebookPaperSize(payload.notebookPaperSize);
      const safeGradeMode = normalizeMathGradeMode(payload.mathGradeMode);
      const initialCamera = resolveBoardInitialCamera(safeType, safePaperSize);
      const resolvedDriveFileId = payload.driveFileId ?? null;
      const resolvedDriveSig = payload.driveSyncedSignature ?? null;

      set({
        activeLocalBoardId: id,
        activeDriveFileId: resolvedDriveFileId,
        driveSyncedSignature: resolvedDriveSig,
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

      await persistActiveBoardSnapshot(
        {
          activeLocalBoardId: id,
          activeDriveFileId: resolvedDriveFileId,
          driveSyncedSignature: resolvedDriveSig,
          elements: payload.elements,
          title: payload.title,
          theme: get().theme,
          boardType: safeType,
          boardPattern: safePattern,
          notebookPaperSize: safePaperSize,
          mathGradeMode: safeGradeMode,
        },
        pruneUnusedAssets(payload.elements, payload.assets)
      );

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
      clearScheduledSave();
      boardSessionEpoch += 1;
      if (nextList.length > 0) {
        await get().openLocalBoard(nextList[0].id);
      } else {
        set({
          activeLocalBoardId: null,
          activeDriveFileId: null,
          driveSyncedSignature: null,
          hasUserEditedCurrentBoard: false,
          title: 'Bảng trắng mới',
          boardType: 'basic',
          boardPattern: 'grid',
          notebookPaperSize: 'a4',
          mathGradeMode: 'high',
          elements: [],
          assets: {},
          selectedIds: [],
          editingGroupId: null,
          editingElementId: null,
          previewFileCardId: null,
          history: [[]],
          historyIndex: 0,
        });
        await persistActiveBoardSnapshot(
          {
            activeLocalBoardId: null,
            activeDriveFileId: null,
            driveSyncedSignature: null,
            elements: [],
            title: 'Bảng trắng mới',
            theme: get().theme,
            boardType: 'basic',
            boardPattern: 'grid',
            notebookPaperSize: 'a4',
            mathGradeMode: 'high',
          },
          {}
        );
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
          activeDriveFileId,
          driveSyncedSignature,
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
        let safeAssets: Record<string, string> = {};
        if (savedData.hasSeparateAssets) {
          const separateAssets = await idbGet<Record<string, string>>(STORAGE_ASSETS_KEY);
          if (separateAssets && typeof separateAssets === 'object') {
            safeAssets = separateAssets;
          } else if (assets && typeof assets === 'object') {
            safeAssets = assets;
          }
        } else if (assets && typeof assets === 'object') {
          safeAssets = assets;
        }
        lastSavedActiveAssets = safeAssets;

        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', safeTheme === 'dark');
        }
        const initialCamera = resolveBoardInitialCamera(safeType, safePaperSize);

        let resolvedLocalId: string | null =
          typeof activeLocalBoardId === 'string' && activeLocalBoardId ? activeLocalBoardId : null;

        const existingMeta = resolvedLocalId
          ? localList.find((item) => item.id === resolvedLocalId)
          : undefined;
        const existsInIndex = Boolean(existingMeta);
        const resolvedDriveFileId: string | null =
          typeof activeDriveFileId === 'string' && activeDriveFileId
            ? activeDriveFileId
            : existingMeta?.driveFileId ?? null;
        const resolvedDriveSig: string | null =
          typeof driveSyncedSignature === 'string' && driveSyncedSignature
            ? driveSyncedSignature
            : existingMeta?.driveSyncedSignature ?? null;

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
            driveFileId: resolvedDriveFileId,
            driveSyncedSignature: resolvedDriveSig,
          });
          localList = migrated.list;
          await persistActiveBoardSnapshot(
            {
              activeLocalBoardId: resolvedLocalId,
              activeDriveFileId: resolvedDriveFileId,
              driveSyncedSignature: resolvedDriveSig,
              elements: safeElements,
              title: safeTitle,
              theme: safeTheme,
              boardType: safeType,
              boardPattern: safePattern,
              notebookPaperSize: safePaperSize,
              mathGradeMode: safeGradeMode,
            },
            pruneUnusedAssets(safeElements, safeAssets)
          );
        } else if (!existsInIndex && safeElements.length === 0) {
          resolvedLocalId = null;
        }

        set({
          activeLocalBoardId: resolvedLocalId,
          activeDriveFileId: resolvedDriveFileId,
          driveSyncedSignature: resolvedDriveSig,
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
    }, 750);
  },

  saveToStorageNow: async () => {
    const epoch = boardSessionEpoch;
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
        activeDriveFileId,
        driveSyncedSignature,
      } = state;

      const prunedAssets = pruneUnusedAssets(elements, assets);
      const alreadyInLibrary = state.activeLocalBoardId
        ? state.localBoards.some((b) => b.id === state.activeLocalBoardId)
        : false;
      const shouldPersist =
        alreadyInLibrary ||
        shouldPersistBoardToLibrary({
          elementCount: elements.length,
          activeLocalBoardId: state.activeLocalBoardId,
          hasUserEditedCurrentBoard: state.hasUserEditedCurrentBoard,
        });

      let activeId = state.activeLocalBoardId;
      if (shouldPersist && !activeId) {
        activeId = generateLocalBoardId();
        set({ activeLocalBoardId: activeId });
      }

      if (epoch !== boardSessionEpoch) return;

      await persistActiveBoardSnapshot(
        {
          activeLocalBoardId: activeId,
          activeDriveFileId,
          driveSyncedSignature,
          elements,
          title,
          theme,
          boardType,
          boardPattern,
          notebookPaperSize,
          mathGradeMode,
        },
        prunedAssets
      );

      if (epoch !== boardSessionEpoch) return;

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
          driveFileId: activeDriveFileId,
          driveSyncedSignature,
        });
        if (epoch === boardSessionEpoch) {
          set({ localBoards: saved.list });
        }
      }
    } catch (e) {
      console.error('Failed to save to IndexedDB', e);
    }
  },
});
