import { StateCreator } from 'zustand';
import { BoardElement, FileCardElement, ImageElement } from '../../types/board';
import { translateElement } from '../../engine/geometry';
import {
  cleanupOrphanGroups,
  duplicateElementsPreservingGroups,
  groupElements,
  ungroupElements,
} from '../../engine/groupUtils';
import { BoardState, MAX_HISTORY, uid } from '../boardStoreTypes';

export type ElementsSlice = Pick<
  BoardState,
  | 'elements'
  | 'selectedIds'
  | 'editingGroupId'
  | 'editingElementId'
  | 'previewFileCardId'
  | 'assets'
  | 'history'
  | 'historyIndex'
  | 'setElements'
  | 'commitHistory'
  | 'setSelectedIds'
  | 'setEditingGroupId'
  | 'setEditingElementId'
  | 'setPreviewFileCardId'
  | 'addAsset'
  | 'undo'
  | 'redo'
  | 'addElement'
  | 'addElementsBatch'
  | 'updateElement'
  | 'updateSelectedElements'
  | 'deleteElementsByIds'
  | 'deleteSelected'
  | 'duplicateSelected'
  | 'groupSelected'
  | 'ungroupSelected'
  | 'nudgeSelected'
  | 'bringSelectedForward'
  | 'sendSelectedBackward'
  | 'toggleLockSelected'
  | 'insertImageFromDataUrl'
  | 'insertDocumentPages'
  | 'insertFileCard'
  | 'clearBoard'
>;

export const createElementsSlice: StateCreator<BoardState, [], [], ElementsSlice> = (set, get) => ({
  elements: [],
  selectedIds: [],
  editingGroupId: null,
  editingElementId: null,
  previewFileCardId: null,
  assets: {},
  history: [[]],
  historyIndex: 0,

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
      hasUserEditedCurrentBoard: true,
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

  addAsset: (id, dataUrl) => {
    set((state) => ({
      assets: { ...state.assets, [id]: dataUrl },
    }));
    get().scheduleSave();
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
    get().addToast(`Đã trải ${pages.length} trang từ "${fileName}" lên bảng`, 'success');
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

  clearBoard: () => {
    set({ elements: [], selectedIds: [], editingGroupId: null, editingElementId: null });
    get().commitHistory();
    get().addToast('Đã xóa toàn bộ nội dung bảng', 'info');
  },
});
