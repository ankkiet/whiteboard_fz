import { useEffect, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { zoomCameraAtPoint } from '../../engine/geometry';
import {
  clampNotebookCamera,
  computeTotalNotebookPages,
  getNotebookConfig,
  getNotebookFitCamera,
} from '../../engine/notebookEngine';
import { stepEraserSize, stepStrokeWidth } from '../../engine/drawingUtils';
import { getGroupMembers } from '../../engine/groupUtils';

interface UseCanvasKeyboardOptions {
  viewportSize: { width: number; height: number };
  onTriggerImageUpload: () => void;
  onToggleFocusMode?: () => void;
}

export function useCanvasKeyboard({
  viewportSize,
  onTriggerImageUpload,
  onToggleFocusMode,
}: UseCanvasKeyboardOptions) {
  const [spacePressed, setSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.code === 'Space' && !isEditingInput) {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }

      if (isEditingInput) return;

      const store = useBoardStore.getState();
      const key = e.key.toLowerCase();

      if (e.ctrlKey || e.metaKey) {
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) store.redo();
          else store.undo();
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          store.redo();
          return;
        }
        if (key === 'd') {
          e.preventDefault();
          store.duplicateSelected();
          return;
        }
        if (key === 'g') {
          e.preventDefault();
          if (e.shiftKey) store.ungroupSelected();
          else store.groupSelected();
          return;
        }
        if (key === 'a') {
          e.preventDefault();
          store.setCurrentTool('select');
          store.setEditingGroupId(null);
          store.setSelectedIds(store.elements.map((el) => el.id));
          return;
        }
        if (key === '0') {
          e.preventDefault();
          if (store.boardType === 'notebook') {
            const config = getNotebookConfig(store.notebookPaperSize);
            store.setCamera(getNotebookFitCamera(viewportSize, config));
          } else {
            const cx = viewportSize.width / 2;
            const cy = viewportSize.height / 2;
            store.setCamera((prev) => zoomCameraAtPoint(prev, 1, cx, cy));
          }
          return;
        }
        if (key === '=' || key === '+') {
          e.preventDefault();
          const cx = viewportSize.width / 2;
          const cy = viewportSize.height / 2;
          store.setCamera((prev) => {
            const next = zoomCameraAtPoint(prev, prev.zoom * 1.2, cx, cy);
            if (store.boardType === 'notebook') {
              const config = getNotebookConfig(store.notebookPaperSize);
              const totalPages = computeTotalNotebookPages(store.elements, next, viewportSize.height, config);
              return clampNotebookCamera(next, viewportSize, config, totalPages);
            }
            return next;
          });
          return;
        }
        if (key === '-') {
          e.preventDefault();
          const cx = viewportSize.width / 2;
          const cy = viewportSize.height / 2;
          store.setCamera((prev) => {
            const next = zoomCameraAtPoint(prev, prev.zoom / 1.2, cx, cy);
            if (store.boardType === 'notebook') {
              const config = getNotebookConfig(store.notebookPaperSize);
              const totalPages = computeTotalNotebookPages(store.elements, next, viewportSize.height, config);
              return clampNotebookCamera(next, viewportSize, config, totalPages);
            }
            return next;
          });
          return;
        }
        return;
      }

      if (key === 'escape') {
        if (store.editingElementId) {
          store.setEditingElementId(null);
          return;
        }
        if (store.editingGroupId) {
          const parentIds = getGroupMembers(store.elements, store.editingGroupId).map((el) => el.id);
          store.setEditingGroupId(null);
          store.setSelectedIds(parentIds);
          return;
        }
        store.setSelectedIds([]);
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        if (store.selectedIds.length > 0) {
          e.preventDefault();
          store.deleteSelected();
        }
        return;
      }

      if (
        store.selectedIds.length > 0 &&
        (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright')
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
        const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
        store.nudgeSelected(dx, dy);
        return;
      }

      if (key === '[') {
        e.preventDefault();
        if (store.currentTool === 'eraser' && store.eraserMode === 'area') {
          store.setEraserSize(stepEraserSize(store.eraserSize, -1));
        } else {
          store.setStrokeWidth(stepStrokeWidth(store.strokeWidth, -1));
        }
        return;
      }

      if (key === ']') {
        e.preventDefault();
        if (store.currentTool === 'eraser' && store.eraserMode === 'area') {
          store.setEraserSize(stepEraserSize(store.eraserSize, 1));
        } else {
          store.setStrokeWidth(stepStrokeWidth(store.strokeWidth, 1));
        }
        return;
      }

      if (key === 'f' && onToggleFocusMode) {
        e.preventDefault();
        onToggleFocusMode();
        return;
      }

      const shortcutMap: Record<string, () => void> = {
        v: () => store.setCurrentTool('select'),
        h: () => store.setCurrentTool('hand'),
        p: () => store.setCurrentTool('pen'),
        m: () => store.setCurrentTool('highlighter'),
        e: () => store.setCurrentTool('eraser'),
        r: () => store.setCurrentTool('rectangle'),
        o: () => store.setCurrentTool('ellipse'),
        a: () => store.setCurrentTool('arrow'),
        t: () => store.setCurrentTool('text'),
        s: () => store.setCurrentTool('sticky'),
        i: () => onTriggerImageUpload(),
        l: () => store.setCurrentTool('laser'),
      };
      if (shortcutMap[key]) {
        shortcutMap[key]();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (dataUrl) {
              void useBoardStore.getState().insertImageFromDataUrl(dataUrl, file.name || 'clipboard.png');
            }
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('paste', handlePaste);
    };
  }, [onToggleFocusMode, onTriggerImageUpload, viewportSize]);

  return { spacePressed };
}
