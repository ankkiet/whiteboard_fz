import React, { useEffect, useRef } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  computeResizedRect,
  getArrowEndpoints,
  getElementBounds,
  getSelectionRect,
  resizeElementToRect,
  screenToWorld,
} from '../../engine/geometry';
import {
  getGroupMembers,
  getSelectedGroupRects,
  getSelectedGroupSummary,
} from '../../engine/groupUtils';
import { BoardElement, Point, Rect, ResizeHandle, ShapeElement } from '../../types/board';
import { Group, Lock } from 'lucide-react';

const HANDLE_CONFIGS: { id: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
  { id: 'nw', style: { top: -5, left: -5 }, cursor: 'nwse-resize' },
  { id: 'n', style: { top: -5, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
  { id: 'ne', style: { top: -5, right: -5 }, cursor: 'nesw-resize' },
  { id: 'e', style: { top: '50%', right: -5, transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
  { id: 'se', style: { bottom: -5, right: -5 }, cursor: 'nwse-resize' },
  { id: 's', style: { bottom: -5, left: '50%', transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
  { id: 'sw', style: { bottom: -5, left: -5 }, cursor: 'nesw-resize' },
  { id: 'w', style: { top: '50%', left: -5, transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
];

export const SelectionOverlay: React.FC = () => {
  const elements = useBoardStore((s) => s.elements);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const editingGroupId = useBoardStore((s) => s.editingGroupId);
  const editingElementId = useBoardStore((s) => s.editingElementId);
  const camera = useBoardStore((s) => s.camera);
  const isDarkMode = useBoardStore((s) => s.isDarkMode);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorMountedAtRef = useRef<number>(0);

  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));
  const singleElement = selectedElements.length === 1 ? selectedElements[0] : null;
  const editingElement = editingElementId
    ? elements.find((el) => el.id === editingElementId) || null
    : null;

  const isLockedSelection =
    selectedElements.length > 0 && selectedElements.every((el) => el.isLocked);

  const selectionRect = getSelectionRect(elements, selectedIds);
  const groupSummary = getSelectedGroupSummary(elements, selectedIds, editingGroupId);
  const selectedGroupRects = getSelectedGroupRects(elements, selectedIds, editingGroupId);
  const editingGroupRect = editingGroupId
    ? getSelectionRect(
        elements,
        getGroupMembers(elements, editingGroupId).map((el) => el.id)
      )
    : null;

  useEffect(() => {
    if (!editingElement) return;
    editorMountedAtRef.current = Date.now();
    const raf = requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [editingElement?.id]);

  // Resize handle drag session
  const startResize = (handle: ResizeHandle, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!selectionRect || isLockedSelection) return;

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const store = useBoardStore.getState();
    const startWorld = screenToWorld(e.clientX, e.clientY, store.camera, { left: 0, top: 0 });
    const initialRect: Rect = { ...selectionRect };
    const initialMap = new Map<string, BoardElement>();
    for (const el of store.elements) {
      if (store.selectedIds.includes(el.id)) {
        initialMap.set(el.id, el);
      }
    }
    const defaultAspectLock = singleElement?.type === 'image';
    let didResize = false;

    const onMove = (moveEvent: PointerEvent) => {
      const currentCam = useBoardStore.getState().camera;
      const currWorld = screenToWorld(moveEvent.clientX, moveEvent.clientY, currentCam, {
        left: 0,
        top: 0,
      });
      const dx = currWorld.x - startWorld.x;
      const dy = currWorld.y - startWorld.y;
      const preserveAspect = defaultAspectLock ? !moveEvent.shiftKey : moveEvent.shiftKey;
      const nextRect = computeResizedRect(initialRect, handle, dx, dy, preserveAspect);
      didResize = true;

      useBoardStore.getState().setElements(
        (prev) =>
          prev.map((el) => {
            const orig = initialMap.get(el.id);
            if (!orig || orig.isLocked) return el;
            return resizeElementToRect(orig, initialRect, nextRect);
          }),
        false
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (didResize) {
        useBoardStore.getState().commitHistory();
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Endpoint drag session for single arrow
  const startArrowEndpointDrag = (
    endpoint: 'start' | 'end',
    arrowEl: ShapeElement,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    if (arrowEl.isLocked) return;

    const { start: origStart, end: origEnd } = getArrowEndpoints(arrowEl);
    let didMove = false;

    const onMove = (moveEvent: PointerEvent) => {
      const currentCam = useBoardStore.getState().camera;
      const worldPt: Point = screenToWorld(moveEvent.clientX, moveEvent.clientY, currentCam, {
        left: 0,
        top: 0,
      });
      const nextStart = endpoint === 'start' ? worldPt : origStart;
      const nextEnd = endpoint === 'end' ? worldPt : origEnd;
      didMove = true;

      useBoardStore.getState().updateElement(
        arrowEl.id,
        {
          x: Math.min(nextStart.x, nextEnd.x),
          y: Math.min(nextStart.y, nextEnd.y),
          width: Math.abs(nextEnd.x - nextStart.x),
          height: Math.abs(nextEnd.y - nextStart.y),
          startPoint: nextStart,
          endPoint: nextEnd,
        },
        false
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (didMove) {
        useBoardStore.getState().commitHistory();
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const commitTextEdit = () => {
    const store = useBoardStore.getState();
    if (store.editingElementId) {
      store.setEditingElementId(null);
      store.commitHistory();
    }
  };

  const handleTextChange = (el: BoardElement, value: string) => {
    if (el.type === 'text') {
      const lines = value.split('\n');
      const longest = Math.max(...lines.map((l) => l.length), 6);
      const estimatedW = Math.max(el.width, Math.min(longest * el.fontSize * 0.62 + 24, 680));
      const estimatedH = Math.max(44, lines.length * el.fontSize * 1.45 + 16);
      useBoardStore.getState().updateElement(
        el.id,
        { text: value, width: estimatedW, height: estimatedH },
        false
      );
    } else if (el.type === 'sticky') {
      useBoardStore.getState().updateElement(el.id, { text: value }, false);
    }
  };

  const isSingleArrow =
    singleElement && (singleElement.type === 'arrow' || singleElement.type === 'line');

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {/* Arrow endpoint handles */}
      {isSingleArrow && !editingElement && (
        (() => {
          const { start, end } = getArrowEndpoints(singleElement);
          const sX = start.x * camera.zoom + camera.x;
          const sY = start.y * camera.zoom + camera.y;
          const eX = end.x * camera.zoom + camera.x;
          const eY = end.y * camera.zoom + camera.y;
          return (
            <>
              <div
                data-testid="arrow-handle-start"
                onPointerDown={(e) => startArrowEndpointDrag('start', singleElement, e)}
                className="pointer-events-auto absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-indigo-600 shadow-sm cursor-grab active:cursor-grabbing"
                style={{ left: sX, top: sY }}
              />
              <div
                data-testid="arrow-handle-end"
                onPointerDown={(e) => startArrowEndpointDrag('end', singleElement, e)}
                className="pointer-events-auto absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-indigo-600 shadow-sm cursor-grab active:cursor-grabbing"
                style={{ left: eX, top: eY }}
              />
            </>
          );
        })()
      )}

      {/* Parent group isolation frame when double-clicking inside a group */}
      {editingGroupRect && (
        <div
          data-testid="editing-group-frame"
          className="absolute border border-dashed border-indigo-400/80 dark:border-indigo-400/70 rounded-lg bg-indigo-500/[0.02]"
          style={{
            left: editingGroupRect.x * camera.zoom + camera.x - 6,
            top: editingGroupRect.y * camera.zoom + camera.y - 6,
            width: Math.max(editingGroupRect.width * camera.zoom + 12, 24),
            height: Math.max(editingGroupRect.height * camera.zoom + 12, 24),
          }}
        >
          <div className="absolute -top-6 left-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/90 dark:bg-slate-200/90 text-white dark:text-slate-900 text-[10px] font-medium whitespace-nowrap shadow-xs">
            <Group className="w-3 h-3" />
            <span>Đang sửa trong nhóm · Esc để thoát</span>
          </div>
        </div>
      )}

      {/* Subtle inner outlines for grouped members or sub-groups inside a multi-selection */}
      {!editingElement && groupSummary.isSingleGroup && selectedElements.length > 1 && (
        <>
          {selectedElements.map((member) => {
            const b = getElementBounds(member);
            return (
              <div
                key={`member-${member.id}`}
                className="absolute border border-dashed border-indigo-400/55 dark:border-indigo-400/45 rounded-[4px]"
                style={{
                  left: b.minX * camera.zoom + camera.x,
                  top: b.minY * camera.zoom + camera.y,
                  width: Math.max((b.maxX - b.minX) * camera.zoom, 8),
                  height: Math.max((b.maxY - b.minY) * camera.zoom, 8),
                }}
              />
            );
          })}
        </>
      )}

      {!editingElement && !groupSummary.isSingleGroup && selectedGroupRects.length > 0 && (
        <>
          {selectedGroupRects.map(({ groupId, rect }) => (
            <div
              key={`subgrp-${groupId}`}
              className="absolute border border-dashed border-indigo-400/70 dark:border-indigo-400/60 rounded-md"
              style={{
                left: rect.x * camera.zoom + camera.x - 2,
                top: rect.y * camera.zoom + camera.y - 2,
                width: Math.max(rect.width * camera.zoom + 4, 14),
                height: Math.max(rect.height * camera.zoom + 4, 14),
              }}
            />
          ))}
        </>
      )}

      {/* Standard bounding box + 8 resize handles */}
      {selectionRect && !isSingleArrow && !editingElement && (
        <div
          data-testid="selection-box"
          data-grouped={groupSummary.isSingleGroup ? 'true' : 'false'}
          data-member-count={selectedElements.length}
          className={`absolute border-[1.5px] rounded-md ${
            isLockedSelection
              ? 'border-amber-500 border-dashed'
              : groupSummary.isSingleGroup
              ? 'border-indigo-600 dark:border-indigo-400'
              : 'border-indigo-500'
          }`}
          style={{
            left: selectionRect.x * camera.zoom + camera.x,
            top: selectionRect.y * camera.zoom + camera.y,
            width: Math.max(selectionRect.width * camera.zoom, 12),
            height: Math.max(selectionRect.height * camera.zoom, 12),
          }}
        >
          {isLockedSelection ? (
            <div className="absolute -top-7 left-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[11px] font-medium shadow-sm whitespace-nowrap">
              <Lock className="w-3 h-3" />
              <span>{groupSummary.isSingleGroup ? `Đã khóa · Nhóm (${selectedElements.length})` : 'Đã khóa'}</span>
            </div>
          ) : (
            <>
              {groupSummary.isSingleGroup && !editingGroupRect && (
                <div
                  data-testid="group-selection-badge"
                  className="absolute -top-7 left-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[11px] font-medium shadow-sm whitespace-nowrap tabular-nums"
                >
                  <Group className="w-3 h-3" />
                  <span>Nhóm · {selectedElements.length} mục</span>
                </div>
              )}
              {HANDLE_CONFIGS.map((h) => (
                <div
                  key={h.id}
                  data-testid={`resize-handle-${h.id}`}
                  onPointerDown={(e) => startResize(h.id, e)}
                  className="pointer-events-auto absolute w-2.5 h-2.5 bg-white border-[1.5px] border-indigo-600 rounded-[3px] shadow-xs hover:scale-125 transition-transform"
                  style={{ ...h.style, cursor: h.cursor }}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Inline Editor for Text & Sticky Notes */}
      {editingElement && (editingElement.type === 'text' || editingElement.type === 'sticky') && (
        <div
          className="pointer-events-auto absolute z-30"
          style={{
            left: editingElement.x * camera.zoom + camera.x,
            top: editingElement.y * camera.zoom + camera.y,
            width: Math.max(editingElement.width * camera.zoom, 160),
            height: Math.max(editingElement.height * camera.zoom, 48),
          }}
        >
          <textarea
            ref={textareaRef}
            data-testid="inline-text-editor"
            aria-label={editingElement.type === 'sticky' ? 'Nội dung ghi chú dán' : 'Nội dung văn bản'}
            value={editingElement.text}
            placeholder={
              editingElement.type === 'sticky' ? 'Nhập ghi chú...' : 'Nhập văn bản...'
            }
            onChange={(e) => handleTextChange(editingElement, e.target.value)}
            onBlur={() => {
              if (Date.now() - editorMountedAtRef.current < 120) {
                textareaRef.current?.focus();
                return;
              }
              commitTextEdit();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
                e.preventDefault();
                commitTextEdit();
              }
            }}
            className={`w-full h-full resize-none outline-none rounded-xl border-2 border-indigo-500 font-medium leading-[1.45] ${
              editingElement.type === 'sticky'
                ? 'p-4 text-slate-900 shadow-lg'
                : 'px-2 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs shadow-sm'
            }`}
            style={{
              backgroundColor:
                editingElement.type === 'sticky' ? editingElement.color : undefined,
              color:
                editingElement.type === 'text'
                  ? isDarkMode && editingElement.color === '#1e293b'
                    ? '#f1f5f9'
                    : editingElement.color
                  : '#1e293b',
              fontSize: `${Math.max(editingElement.fontSize * camera.zoom, 12)}px`,
            }}
          />
          <div className="pointer-events-none mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap select-none">
            Nhấn Esc hoặc Ctrl+Enter để xong
          </div>
        </div>
      )}
    </div>
  );
};
