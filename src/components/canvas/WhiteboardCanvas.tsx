import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  constrainShapeEndPoint,
  doesRectIntersectElement,
  doesSegmentHitElement,
  getElementBounds,
  isPointInElement,
  screenToWorld,
  translateElement,
  worldToScreen,
  zoomCameraAtPoint,
} from '../../engine/geometry';
import {
  drawBoardElement,
  drawBrushCursor,
  drawEraserCursor,
  drawEraserTrail,
  drawFreehandPoints,
  drawLaserTrail,
  drawMarqueeRect,
  drawWorldBackgroundPattern,
  getCanvasBackgroundColor,
} from '../../engine/renderer';
import {
  buildStraightStrokePoints,
  computeBrushRadiusWorld,
  magneticSnapLineEnd,
  stepEraserSize,
  stepStrokeWidth,
} from '../../engine/drawingUtils';
import {
  createDynamicEraserState,
  DynamicEraserState,
  eraseElementsInArea,
  stepDynamicEraserState,
} from '../../engine/eraserUtils';
import {
  cleanupOrphanGroups,
  expandSelectionWithGroups,
  getEffectiveGroupId,
  getGroupMembers,
  isElementInGroup,
} from '../../engine/groupUtils';
import { subscribeImageCache } from '../../engine/imageCache';
import { snapPointToVirtualToolEdge } from '../../engine/mathCurriculum';
import { getSafeMathViewport } from '../../engine/mathViewport';
import { BoardElement, LaserPoint, Point, Rect, ShapeElement } from '../../types/board';
import { ImagePlus } from 'lucide-react';

interface WhiteboardCanvasProps {
  onTriggerImageUpload: () => void;
  onFilesDropped: (files: File[], worldDropPoint?: { x: number; y: number }) => void;
  onToggleFocusMode?: () => void;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  onTriggerImageUpload,
  onFilesDropped,
  onToggleFocusMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const elements = useBoardStore((s) => s.elements);
  const currentTool = useBoardStore((s) => s.currentTool);
  const color = useBoardStore((s) => s.color);
  const highlighterColor = useBoardStore((s) => s.highlighterColor);
  const fillColor = useBoardStore((s) => s.fillColor);
  const strokeWidth = useBoardStore((s) => s.strokeWidth);
  const fontSize = useBoardStore((s) => s.fontSize);
  const stickyColor = useBoardStore((s) => s.stickyColor);
  const eraserMode = useBoardStore((s) => s.eraserMode);
  const eraserSize = useBoardStore((s) => s.eraserSize);
  const camera = useBoardStore((s) => s.camera);
  const boardType = useBoardStore((s) => s.boardType);
  const boardPattern = useBoardStore((s) => s.boardPattern);
  const isDarkMode = useBoardStore((s) => s.isDarkMode);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const editingElementId = useBoardStore((s) => s.editingElementId);
  const assets = useBoardStore((s) => s.assets);
  const hasLoaded = useBoardStore((s) => s.hasLoaded);
  const virtualTools = useBoardStore((s) => s.virtualTools);
  const pinnedProblem = useBoardStore((s) => s.pinnedProblem);
  const isCalculatorOpen = useBoardStore((s) => s.isCalculatorOpen);
  const isCalculatorMinimized = useBoardStore((s) => s.isCalculatorMinimized);
  const isMathPanelCollapsed = useBoardStore((s) => s.isMathPanelCollapsed);

  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 800 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [renderTick, setRenderTick] = useState(0);

  // Ephemeral interaction refs for 60fps rendering without React state churn
  const modeRef = useRef<
    'idle' | 'pan' | 'draw' | 'shape' | 'eraser' | 'area-eraser' | 'drag-select' | 'marquee' | 'laser'
  >('idle');
  const panOriginRef = useRef<Point>({ x: 0, y: 0 });
  const interactionStartWorldRef = useRef<Point>({ x: 0, y: 0 });
  const dragInitialElementsRef = useRef<Map<string, BoardElement>>(new Map());
  const didDragMoveRef = useRef(false);

  const activeStrokeRef = useRef<[number, number, number][]>([]);
  const drawStartPointRef = useRef<[number, number, number] | null>(null);
  const brushCursorWorldRef = useRef<Point | null>(null);
  const activeShapeRef = useRef<ShapeElement | null>(null);
  const eraserTrailRef = useRef<Point[]>([]);
  const erasingIdsRef = useRef<Set<string>>(new Set());
  const eraserCursorWorldRef = useRef<Point | null>(null);
  const lastAreaEraserPosRef = useRef<Point | null>(null);
  const areaErasedDirtyRef = useRef(false);
  const dynamicEraserRef = useRef<DynamicEraserState>(createDynamicEraserState(24));
  const eraserDecayRafRef = useRef<number | null>(null);
  const marqueeRef = useRef<Rect | null>(null);

  // Laser animation state
  const laserPointsRef = useRef<LaserPoint[]>([]);
  const laserStrokeIdRef = useRef(0);
  const laserRafRef = useRef<number | null>(null);

  // Hardware-accelerated cursor refs (zero canvas repaint on mouse move)
  const cursorOverlayRef = useRef<HTMLDivElement>(null);
  const cursorCircleRef = useRef<HTMLDivElement>(null);
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

  // Palm rejection & pointer lock refs (prevents jumping or zooming while writing)
  const activePointerIdRef = useRef<number | null>(null);
  const lastPenActiveTimeRef = useRef<number>(0);

  // Trigger redraw when cached images finish decoding
  useEffect(() => {
    return subscribeImageCache(() => {
      setRenderTick((t) => t + 1);
    });
  }, []);

  // Track container dimensions accurately via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setViewportSize({
        width: container.clientWidth || window.innerWidth,
        height: container.clientHeight || window.innerHeight,
      });
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = viewportSize;
    const targetW = Math.max(1, Math.round(width * dpr));
    const targetH = Math.max(1, Math.round(height * dpr));

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const state = useBoardStore.getState();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = getCanvasBackgroundColor(state.isDarkMode);
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(state.camera.x, state.camera.y);
    ctx.scale(state.camera.zoom, state.camera.zoom);

    drawWorldBackgroundPattern(
      ctx,
      state.camera,
      width,
      height,
      state.boardPattern,
      state.isDarkMode
    );

    const sorted = [...state.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const erasingIds = erasingIdsRef.current;

    for (const el of sorted) {
      drawBoardElement(ctx, el, {
        isDarkMode: state.isDarkMode,
        assets: state.assets,
        dimmed: erasingIds.has(el.id),
        editingId: state.editingElementId,
      });
    }

    if (
      activeStrokeRef.current.length > 0 &&
      (state.currentTool === 'pen' || state.currentTool === 'highlighter')
    ) {
      drawFreehandPoints(
        ctx,
        activeStrokeRef.current,
        state.currentTool === 'highlighter' ? state.highlighterColor : state.color,
        state.strokeWidth,
        state.currentTool === 'highlighter',
        state.isDarkMode
      );
    }

    if (activeShapeRef.current) {
      drawBoardElement(ctx, activeShapeRef.current, {
        isDarkMode: state.isDarkMode,
        assets: state.assets,
      });
    }

    if (eraserTrailRef.current.length > 1) {
      drawEraserTrail(ctx, eraserTrailRef.current, state.camera.zoom);
    }

    if (marqueeRef.current) {
      drawMarqueeRect(ctx, marqueeRef.current, state.camera.zoom);
    }

    if (laserPointsRef.current.length > 0) {
      drawLaserTrail(ctx, laserPointsRef.current, Date.now(), state.camera.zoom);
    }

    ctx.restore();
  }, [viewportSize]);

  // Redraw whenever reactive state changes
  useEffect(() => {
    drawFrame();
  }, [
    drawFrame,
    elements,
    camera,
    boardPattern,
    isDarkMode,
    selectedIds,
    editingElementId,
    assets,
    color,
    highlighterColor,
    fillColor,
    strokeWidth,
    currentTool,
    eraserMode,
    eraserSize,
    renderTick,
  ]);

  const requestRedraw = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      drawFrame();
    });
  }, [drawFrame]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Synchronize cursor ring size, color and contrast styling whenever tool settings change
  useEffect(() => {
    if (!cursorCircleRef.current || !cursorDotRef.current) return;
    const circle = cursorCircleRef.current;
    const dot = cursorDotRef.current;
    const zoom = camera.zoom;

    if (currentTool === 'pen') {
      const worldRadius = computeBrushRadiusWorld(strokeWidth, false);
      const screenRadius = Math.max(worldRadius * zoom, 3);
      const size = Math.round(screenRadius * 2);
      circle.style.width = `${size}px`;
      circle.style.height = `${size}px`;
      circle.style.border = `1.5px solid ${color}`;
      circle.style.backgroundColor = `${color}30`;
      circle.style.boxShadow = isDarkMode
        ? '0 0 0 1px rgba(255, 255, 255, 0.4)'
        : '0 0 0 1px rgba(0, 0, 0, 0.25)';
      dot.style.display = 'block';
      dot.style.backgroundColor = color;
    } else if (currentTool === 'highlighter') {
      const worldRadius = computeBrushRadiusWorld(strokeWidth, true);
      const screenRadius = Math.max(worldRadius * zoom, 6);
      const size = Math.round(screenRadius * 2);
      circle.style.width = `${size}px`;
      circle.style.height = `${size}px`;
      circle.style.border = `1.5px solid ${highlighterColor}`;
      circle.style.backgroundColor = `${highlighterColor}45`;
      circle.style.boxShadow = isDarkMode
        ? '0 0 0 1px rgba(255, 255, 255, 0.4)'
        : '0 0 0 1px rgba(0, 0, 0, 0.25)';
      dot.style.display = 'none';
    } else if (currentTool === 'eraser' && eraserMode === 'area') {
      const size = Math.max(14, Math.round(eraserSize * zoom));
      circle.style.width = `${size}px`;
      circle.style.height = `${size}px`;
      circle.style.border = '2px dashed rgba(239, 68, 68, 0.9)';
      circle.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      circle.style.boxShadow = isDarkMode
        ? '0 0 0 1px rgba(255, 255, 255, 0.25)'
        : '0 0 0 1px rgba(0, 0, 0, 0.25)';
      dot.style.display = 'block';
      dot.style.backgroundColor = '#ef4444';
    }
  }, [
    currentTool,
    strokeWidth,
    eraserSize,
    color,
    highlighterColor,
    camera.zoom,
    isDarkMode,
    eraserMode,
  ]);

  const updateCursorOverlayPos = useCallback(
    (clientX: number, clientY: number, customScreenPos?: Point) => {
      if (!cursorOverlayRef.current || !canvasRef.current) return;
      const isRingTool =
        currentTool === 'pen' ||
        currentTool === 'highlighter' ||
        (currentTool === 'eraser' && eraserMode === 'area');

      if (!isRingTool || modeRef.current === 'pan' || spacePressed) {
        cursorOverlayRef.current.style.display = 'none';
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const sx = customScreenPos ? customScreenPos.x : clientX - rect.left;
      const sy = customScreenPos ? customScreenPos.y : clientY - rect.top;

      cursorOverlayRef.current.style.display = 'block';
      cursorOverlayRef.current.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`;
    },
    [currentTool, eraserMode, spacePressed]
  );

  const ensureLaserLoop = useCallback(() => {
    if (laserRafRef.current !== null) return;
    const step = () => {
      const now = Date.now();
      laserPointsRef.current = laserPointsRef.current.filter((p) => now - p.timestamp < 1500);
      drawFrame();
      if (laserPointsRef.current.length > 0) {
        laserRafRef.current = requestAnimationFrame(step);
      } else {
        laserRafRef.current = null;
      }
    };
    laserRafRef.current = requestAnimationFrame(step);
  }, [drawFrame]);

  const ensureEraserDecayLoop = useCallback(() => {
    if (eraserDecayRafRef.current !== null) return;
    const step = () => {
      if (modeRef.current !== 'area-eraser') {
        eraserDecayRafRef.current = null;
        return;
      }
      const store = useBoardStore.getState();
      const dyn = dynamicEraserRef.current;
      if (dyn.lastScreenPos && (dyn.energy > 0.01 || dyn.currentSize > store.eraserSize + 0.5)) {
        const now = performance.now();
        if (now - dyn.lastTimestamp >= 65) {
          dynamicEraserRef.current = stepDynamicEraserState(
            dyn,
            dyn.lastScreenPos,
            now,
            store.eraserSize
          );
          if (canvasRef.current) {
            canvasRef.current.setAttribute(
              'data-eraser-active-size',
              String(Math.round(dynamicEraserRef.current.currentSize))
            );
          }
          drawFrame();
        }
        eraserDecayRafRef.current = requestAnimationFrame(step);
      } else {
        eraserDecayRafRef.current = null;
      }
    };
    eraserDecayRafRef.current = requestAnimationFrame(step);
  }, [drawFrame]);

  useEffect(() => {
    return () => {
      if (laserRafRef.current !== null) {
        cancelAnimationFrame(laserRafRef.current);
      }
      if (eraserDecayRafRef.current !== null) {
        cancelAnimationFrame(eraserDecayRafRef.current);
      }
    };
  }, []);

  // Global keyboard shortcuts & clipboard paste (Ctrl+V)
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
          const cx = viewportSize.width / 2;
          const cy = viewportSize.height / 2;
          store.setCamera((prev) => zoomCameraAtPoint(prev, 1, cx, cy));
          return;
        }
        if (key === '=' || key === '+') {
          e.preventDefault();
          const cx = viewportSize.width / 2;
          const cy = viewportSize.height / 2;
          store.setCamera((prev) => zoomCameraAtPoint(prev, prev.zoom * 1.2, cx, cy));
          return;
        }
        if (key === '-') {
          e.preventDefault();
          const cx = viewportSize.width / 2;
          const cy = viewportSize.height / 2;
          store.setCamera((prev) => zoomCameraAtPoint(prev, prev.zoom / 1.2, cx, cy));
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
  }, [onToggleFocusMode, onTriggerImageUpload, viewportSize.height, viewportSize.width]);

  // Smooth Wheel: scroll wheel zooms in/out anchored directly at the mouse cursor
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Block accidental wheel zoom or pan while actively writing, erasing, or dragging!
      if (modeRef.current !== 'idle') {
        return;
      }
      if (e.deltaY === 0) return;

      const rect = canvas.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const anchorY = e.clientY - rect.top;

      // Normalize deltaY across pixel, line (Firefox), and page wheel modes
      let normalizedDelta = e.deltaY;
      if (e.deltaMode === 1) {
        normalizedDelta *= 32;
      } else if (e.deltaMode === 2) {
        normalizedDelta *= 400;
      }
      normalizedDelta = Math.max(-300, Math.min(300, normalizedDelta));

      // Pinch-to-zoom on trackpads fires ctrlKey with small deltas; regular mouse notches are ~100px
      const sensitivity = e.ctrlKey || e.metaKey ? 0.006 : 0.0014;
      const factor = Math.exp(-normalizedDelta * sensitivity);

      useBoardStore.getState().setCamera((prev) =>
        zoomCameraAtPoint(prev, prev.zoom * factor, anchorX, anchorY)
      );
    };

    // Prevent Safari / macOS gesture-zoom from unexpectedly zooming the page
    const preventGesture = (e: Event) => e.preventDefault();
    canvas.addEventListener('gesturestart', preventGesture, { passive: false });
    canvas.addEventListener('gesturechange', preventGesture, { passive: false });

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('gesturestart', preventGesture);
      canvas.removeEventListener('gesturechange', preventGesture);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Palm rejection & multi-touch isolation:
    // If a stroke is already in progress, reject any secondary touch or palm contact!
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
      return;
    }

    // Stylus priority palm rejection: if a pen was actively used recently, reject touch down
    if (e.pointerType === 'pen') {
      lastPenActiveTimeRef.current = Date.now();
    } else if (e.pointerType === 'touch' && Date.now() - lastPenActiveTimeRef.current < 600) {
      return;
    }

    activePointerIdRef.current = e.pointerId;

    const store = useBoardStore.getState();
    const rect = canvas.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX, e.clientY, store.camera, rect);

    canvas.setPointerCapture(e.pointerId);

    // Right mouse button, Middle mouse button, Space+Drag, or Hand tool => Pan
    if (e.button === 2 || e.button === 1 || spacePressed || store.currentTool === 'hand') {
      modeRef.current = 'pan';
      setIsPanning(true);
      panOriginRef.current = { x: e.clientX - store.camera.x, y: e.clientY - store.camera.y };
      return;
    }

    if (e.button !== 0) return;

    if (store.editingElementId) {
      store.setEditingElementId(null);
    }

    if (store.currentTool === 'laser') {
      modeRef.current = 'laser';
      laserStrokeIdRef.current += 1;
      laserPointsRef.current.push({
        x: worldPos.x,
        y: worldPos.y,
        timestamp: Date.now(),
        strokeId: laserStrokeIdRef.current,
      });
      ensureLaserLoop();
      return;
    }

    if (store.currentTool === 'pen' || store.currentTool === 'highlighter') {
      modeRef.current = 'draw';
      const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
      const snappedStart =
        store.currentTool === 'pen' && (store.virtualTools.ruler.active || store.virtualTools.setSquare.active)
          ? snapPointToVirtualToolEdge(worldPos, store.virtualTools, 16 / store.camera.zoom).point
          : worldPos;
      const startPt: [number, number, number] = [snappedStart.x, snappedStart.y, pressure];
      drawStartPointRef.current = startPt;
      brushCursorWorldRef.current = snappedStart;
      activeStrokeRef.current = [startPt];
      updateCursorOverlayPos(e.clientX, e.clientY);
      drawFrame();
      return;
    }

    if (store.currentTool === 'eraser') {
      if (store.eraserMode === 'area') {
        modeRef.current = 'area-eraser';
        lastAreaEraserPosRef.current = worldPos;
        eraserCursorWorldRef.current = worldPos;
        areaErasedDirtyRef.current = false;
        dynamicEraserRef.current = stepDynamicEraserState(
          createDynamicEraserState(store.eraserSize),
          { x: e.clientX, y: e.clientY },
          performance.now(),
          store.eraserSize
        );
        canvas.setAttribute('data-eraser-active-size', String(Math.round(store.eraserSize)));
        const res = eraseElementsInArea(
          store.elements,
          worldPos,
          worldPos,
          dynamicEraserRef.current.currentSize / 2,
          () => `el_${Math.random().toString(36).slice(2, 10)}`
        );
        if (res.changed) {
          store.setElements(res.elements, false);
          areaErasedDirtyRef.current = true;
        }
        drawFrame();
        return;
      }

      modeRef.current = 'eraser';
      eraserTrailRef.current = [worldPos];
      erasingIdsRef.current = new Set();
      for (const el of store.elements) {
        if (!el.isLocked && isPointInElement(worldPos, el, 10 / store.camera.zoom)) {
          erasingIdsRef.current.add(el.id);
        }
      }
      drawFrame();
      return;
    }

    if (
      store.currentTool === 'rectangle' ||
      store.currentTool === 'ellipse' ||
      store.currentTool === 'arrow'
    ) {
      modeRef.current = 'shape';
      interactionStartWorldRef.current = worldPos;
      const maxZ = store.elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0);
      activeShapeRef.current = {
        id: `el_${Math.random().toString(36).slice(2, 10)}`,
        type: store.currentTool,
        x: worldPos.x,
        y: worldPos.y,
        width: 0,
        height: 0,
        color: store.color,
        fillColor: store.currentTool === 'arrow' ? 'transparent' : store.fillColor,
        strokeWidth: store.strokeWidth,
        startPoint: store.currentTool === 'arrow' ? worldPos : undefined,
        endPoint: store.currentTool === 'arrow' ? worldPos : undefined,
        zIndex: maxZ + 1,
      };
      drawFrame();
      return;
    }

    if (store.currentTool === 'text') {
      e.preventDefault();
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      const maxZ = store.elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0);
      const id = `el_${Math.random().toString(36).slice(2, 10)}`;
      store.addElement(
        {
          id,
          type: 'text',
          x: worldPos.x,
          y: worldPos.y,
          width: 240,
          height: 44,
          text: '',
          color: store.color,
          fontSize: store.fontSize,
          zIndex: maxZ + 1,
        },
        true
      );
      store.setCurrentTool('select');
      store.setSelectedIds([id]);
      store.setEditingElementId(id);
      return;
    }

    if (store.currentTool === 'sticky') {
      e.preventDefault();
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      const maxZ = store.elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0);
      const id = `el_${Math.random().toString(36).slice(2, 10)}`;
      const w = 210;
      const h = 210;
      store.addElement(
        {
          id,
          type: 'sticky',
          x: worldPos.x - w / 2,
          y: worldPos.y - h / 2,
          width: w,
          height: h,
          text: '',
          color: store.stickyColor,
          fontSize: 16,
          zIndex: maxZ + 1,
        },
        true
      );
      store.setCurrentTool('select');
      store.setSelectedIds([id]);
      store.setEditingElementId(id);
      return;
    }

    if (store.currentTool === 'select') {
      const sortedTopDown = [...store.elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
      const hit = sortedTopDown.find((el) =>
        isPointInElement(worldPos, el, 8 / store.camera.zoom)
      );

      if (hit) {
        let activeEditingGroupId = store.editingGroupId;
        if (activeEditingGroupId && !isElementInGroup(hit, activeEditingGroupId)) {
          activeEditingGroupId = null;
          store.setEditingGroupId(null);
        }

        const hitUnitIds = expandSelectionWithGroups(
          store.elements,
          [hit.id],
          activeEditingGroupId
        );
        const hitUnitSet = new Set(hitUnitIds);

        let nextSelected: string[];
        if (e.shiftKey) {
          const allAlreadySelected = hitUnitIds.every((id) => store.selectedIds.includes(id));
          nextSelected = allAlreadySelected
            ? store.selectedIds.filter((id) => !hitUnitSet.has(id))
            : Array.from(new Set([...store.selectedIds, ...hitUnitIds]));
        } else if (store.selectedIds.includes(hit.id)) {
          nextSelected = expandSelectionWithGroups(
            store.elements,
            store.selectedIds,
            activeEditingGroupId
          );
        } else {
          nextSelected = hitUnitIds;
        }

        store.setSelectedIds(nextSelected);
        modeRef.current = 'drag-select';
        interactionStartWorldRef.current = worldPos;
        didDragMoveRef.current = false;

        const snapshot = new Map<string, BoardElement>();
        for (const el of store.elements) {
          if (nextSelected.includes(el.id)) {
            snapshot.set(el.id, el);
          }
        }
        dragInitialElementsRef.current = snapshot;
      } else {
        if (!e.shiftKey) {
          store.setEditingGroupId(null);
          store.setSelectedIds([]);
        }
        modeRef.current = 'marquee';
        interactionStartWorldRef.current = worldPos;
        marqueeRef.current = { x: worldPos.x, y: worldPos.y, width: 0, height: 0 };
        drawFrame();
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ignore movements from any secondary pointer/touch when an active gesture is in progress
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
      return;
    }

    const mode = modeRef.current;
    const store = useBoardStore.getState();
    const rect = canvas.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX, e.clientY, store.camera, rect);

    if (mode === 'idle') {
      const hasVirtualEdge =
        store.currentTool === 'pen' &&
        (store.virtualTools.ruler.active || store.virtualTools.setSquare.active);
      if (hasVirtualEdge) {
        const snapThresh = 16 / store.camera.zoom;
        const snapped = snapPointToVirtualToolEdge(worldPos, store.virtualTools, snapThresh);
        if (snapped.snapped) {
          const screenPos = worldToScreen(snapped.point.x, snapped.point.y, store.camera, rect);
          updateCursorOverlayPos(e.clientX, e.clientY, screenPos);
          return;
        }
      }
      updateCursorOverlayPos(e.clientX, e.clientY);
      return;
    }

    if (mode === 'pan') {
      store.setCamera((prev) => ({
        ...prev,
        x: e.clientX - panOriginRef.current.x,
        y: e.clientY - panOriginRef.current.y,
      }));
      return;
    }

    if (mode === 'laser') {
      laserPointsRef.current.push({
        x: worldPos.x,
        y: worldPos.y,
        timestamp: Date.now(),
        strokeId: laserStrokeIdRef.current,
      });
      ensureLaserLoop();
      return;
    }

    if (mode === 'draw') {
      updateCursorOverlayPos(e.clientX, e.clientY);
      if (e.shiftKey && drawStartPointRef.current) {
        const startPt = drawStartPointRef.current;
        const snapped = magneticSnapLineEnd(
          { x: startPt[0], y: startPt[1] },
          worldPos
        );
        brushCursorWorldRef.current = snapped.point;
        activeStrokeRef.current = buildStraightStrokePoints(
          startPt,
          [snapped.point.x, snapped.point.y, 0.5],
          Math.max(3, 6 / store.camera.zoom)
        );
        requestRedraw();
        return;
      }

      const hasVirtualEdge =
        store.currentTool === 'pen' &&
        (store.virtualTools.ruler.active || store.virtualTools.setSquare.active);
      const snapThresh = 16 / store.camera.zoom;

      brushCursorWorldRef.current = hasVirtualEdge
        ? snapPointToVirtualToolEdge(worldPos, store.virtualTools, snapThresh).point
        : worldPos;
      const pts = activeStrokeRef.current;
      const minStep = 1.2 / store.camera.zoom;
      const coalesced = e.nativeEvent.getCoalescedEvents?.();
      const samples = coalesced && coalesced.length > 0 ? coalesced : [e.nativeEvent];
      let added = false;

      for (const sample of samples) {
        const rawWorld = screenToWorld(sample.clientX, sample.clientY, store.camera, rect);
        const sampleWorld = hasVirtualEdge
          ? snapPointToVirtualToolEdge(rawWorld, store.virtualTools, snapThresh).point
          : rawWorld;
        if (!Number.isFinite(sampleWorld.x) || !Number.isFinite(sampleWorld.y)) continue;
        const samplePressure = sample.pointerType === 'pen' ? sample.pressure : 0.5;
        const last = pts[pts.length - 1];
        if (!last || Math.hypot(sampleWorld.x - last[0], sampleWorld.y - last[1]) >= minStep) {
          pts.push([sampleWorld.x, sampleWorld.y, samplePressure]);
          brushCursorWorldRef.current = sampleWorld;
          added = true;
        }
      }
      if (added) {
        requestRedraw();
      }
      return;
    }

    if (mode === 'area-eraser') {
      updateCursorOverlayPos(e.clientX, e.clientY);
      const prevPos = lastAreaEraserPosRef.current ?? worldPos;
      lastAreaEraserPosRef.current = worldPos;
      eraserCursorWorldRef.current = worldPos;
      const now = performance.now();
      dynamicEraserRef.current = stepDynamicEraserState(
        dynamicEraserRef.current,
        { x: e.clientX, y: e.clientY },
        now,
        store.eraserSize
      );
      const activeSize = dynamicEraserRef.current.currentSize;
      canvas.setAttribute('data-eraser-active-size', String(Math.round(activeSize)));
      if (dynamicEraserRef.current.energy > 0.01) {
        ensureEraserDecayLoop();
      }
      const res = eraseElementsInArea(
        store.elements,
        prevPos,
        worldPos,
        activeSize / 2,
        () => `el_${Math.random().toString(36).slice(2, 10)}`
      );
      if (res.changed) {
        store.setElements(res.elements, false);
        areaErasedDirtyRef.current = true;
      }
      requestRedraw();
      return;
    }

    if (mode === 'eraser') {
      const trail = eraserTrailRef.current;
      const prevPt = trail[trail.length - 1] ?? worldPos;
      trail.push(worldPos);
      if (trail.length > 18) trail.shift();

      const tol = 10 / store.camera.zoom;
      for (const el of store.elements) {
        if (!el.isLocked && !erasingIdsRef.current.has(el.id)) {
          if (doesSegmentHitElement(prevPt, worldPos, el, tol)) {
            erasingIdsRef.current.add(el.id);
          }
        }
      }
      requestRedraw();
      return;
    }

    if (mode === 'shape' && activeShapeRef.current) {
      const start = interactionStartWorldRef.current;
      const shapeType = activeShapeRef.current.type;
      const end = constrainShapeEndPoint(start, worldPos, shapeType, e.shiftKey);

      if (shapeType === 'arrow' || shapeType === 'line') {
        activeShapeRef.current = {
          ...activeShapeRef.current,
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width: Math.abs(end.x - start.x),
          height: Math.abs(end.y - start.y),
          startPoint: start,
          endPoint: end,
        };
      } else {
        activeShapeRef.current = {
          ...activeShapeRef.current,
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width: Math.abs(end.x - start.x),
          height: Math.abs(end.y - start.y),
        };
      }
      requestRedraw();
      return;
    }

    if (mode === 'drag-select') {
      const dx = worldPos.x - interactionStartWorldRef.current.x;
      const dy = worldPos.y - interactionStartWorldRef.current.y;
      if (Math.hypot(dx, dy) > 1.5 / store.camera.zoom) {
        didDragMoveRef.current = true;
      }
      const initialMap = dragInitialElementsRef.current;
      if (initialMap.size === 0) return;

      store.setElements(
        (prev) =>
          prev.map((el) => {
            const orig = initialMap.get(el.id);
            if (!orig || orig.isLocked) return el;
            return translateElement(orig, dx, dy);
          }),
        false
      );
      return;
    }

    if (mode === 'marquee') {
      const start = interactionStartWorldRef.current;
      const nextRect: Rect = {
        x: Math.min(start.x, worldPos.x),
        y: Math.min(start.y, worldPos.y),
        width: Math.abs(worldPos.x - start.x),
        height: Math.abs(worldPos.y - start.y),
      };
      marqueeRef.current = nextRect;
      const rawHitIds = store.elements
        .filter((el) => doesRectIntersectElement(nextRect, el))
        .map((el) => el.id);
      const hitIds = expandSelectionWithGroups(store.elements, rawHitIds, store.editingGroupId);
      store.setSelectedIds(hitIds);
      requestRedraw();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Only release when the active drawing/interacting pointer lifts
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
      return;
    }
    activePointerIdRef.current = null;
    if (e.pointerType === 'pen') {
      lastPenActiveTimeRef.current = Date.now();
    }

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    const mode = modeRef.current;
    modeRef.current = 'idle';
    const store = useBoardStore.getState();

    if (mode === 'pan') {
      setIsPanning(false);
      return;
    }

    if (mode === 'draw') {
      const pts = activeStrokeRef.current;
      activeStrokeRef.current = [];
      drawStartPointRef.current = null;
      if (pts.length > 0 && (store.currentTool === 'pen' || store.currentTool === 'highlighter')) {
        const tempEl: BoardElement = {
          id: `el_${Math.random().toString(36).slice(2, 10)}`,
          type: store.currentTool === 'pen' ? 'stroke' : 'highlighter',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          points: pts,
          color: store.currentTool === 'highlighter' ? store.highlighterColor : store.color,
          strokeWidth: store.strokeWidth,
          zIndex: store.elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0) + 1,
        };
        const bounds = getElementBounds(tempEl);
        store.addElement({
          ...tempEl,
          x: bounds.minX,
          y: bounds.minY,
          width: bounds.maxX - bounds.minX,
          height: bounds.maxY - bounds.minY,
        });
      }
      drawFrame();
      return;
    }

    if (mode === 'area-eraser') {
      lastAreaEraserPosRef.current = null;
      dynamicEraserRef.current = createDynamicEraserState(store.eraserSize);
      if (canvas) {
        canvas.setAttribute('data-eraser-active-size', String(Math.round(store.eraserSize)));
      }
      if (eraserDecayRafRef.current !== null) {
        cancelAnimationFrame(eraserDecayRafRef.current);
        eraserDecayRafRef.current = null;
      }
      if (areaErasedDirtyRef.current) {
        areaErasedDirtyRef.current = false;
        const cleaned = cleanupOrphanGroups(useBoardStore.getState().elements);
        store.setElements(cleaned, true);
      }
      drawFrame();
      return;
    }

    if (mode === 'eraser') {
      const idsToDelete = Array.from(erasingIdsRef.current);
      erasingIdsRef.current = new Set();
      eraserTrailRef.current = [];
      if (idsToDelete.length > 0) {
        store.deleteElementsByIds(idsToDelete);
      }
      drawFrame();
      return;
    }

    if (mode === 'shape') {
      const shape = activeShapeRef.current;
      activeShapeRef.current = null;
      if (shape) {
        const hasSize =
          shape.type === 'arrow' && shape.startPoint && shape.endPoint
            ? Math.hypot(
                shape.endPoint.x - shape.startPoint.x,
                shape.endPoint.y - shape.startPoint.y
              ) > 6
            : shape.width > 6 || shape.height > 6;
        if (hasSize) {
          store.addElement(shape, true);
        }
      }
      drawFrame();
      return;
    }

    if (mode === 'drag-select') {
      dragInitialElementsRef.current.clear();
      if (didDragMoveRef.current) {
        store.commitHistory();
      }
      didDragMoveRef.current = false;
      return;
    }

    if (mode === 'marquee') {
      marqueeRef.current = null;
      drawFrame();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const store = useBoardStore.getState();
    const rect = canvas.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX, e.clientY, store.camera, rect);

    const sortedTopDown = [...store.elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    const hit = sortedTopDown.find((el) =>
      isPointInElement(worldPos, el, 8 / store.camera.zoom)
    );
    if (!hit) return;

    const effectiveGroupId = getEffectiveGroupId(hit, store.editingGroupId);

    if ((hit.type === 'text' || hit.type === 'sticky' || hit.type === 'formula') && !hit.isLocked) {
      store.setCurrentTool('select');
      if (effectiveGroupId) {
        store.setEditingGroupId(effectiveGroupId);
      }
      store.setSelectedIds([hit.id]);
      store.setEditingElementId(hit.id);
    } else if (hit.type === 'reveal' && !hit.isLocked) {
      store.setCurrentTool('select');
      store.setSelectedIds([hit.id]);
      store.updateElement(hit.id, { revealed: !hit.revealed }, true);
    } else if (effectiveGroupId) {
      // Enter group isolation mode to edit an individual member without ungrouping
      store.setCurrentTool('select');
      store.setEditingGroupId(effectiveGroupId);
      const innerSelection = expandSelectionWithGroups(store.elements, [hit.id], effectiveGroupId);
      store.setSelectedIds(innerSelection);
    } else if (hit.type === 'file-card') {
      store.setCurrentTool('select');
      store.setSelectedIds([hit.id]);
      store.setPreviewFileCardId(hit.id);
    }
  };

  // Drag & Drop image, PDF, Word, or document files directly onto the canvas
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDraggingFile) setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dropWorld = screenToWorld(
      e.clientX,
      e.clientY,
      useBoardStore.getState().camera,
      rect
    );

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    onFilesDropped(files, dropWorld);
  };

  const handlePointerLeave = () => {
    if (cursorOverlayRef.current) {
      cursorOverlayRef.current.style.display = 'none';
    }
  };

  const cursorClass = isPanning
    ? 'cursor-grabbing-custom'
    : spacePressed || currentTool === 'hand'
    ? 'cursor-grab-custom'
    : currentTool === 'eraser'
    ? eraserMode === 'area'
      ? 'cursor-none'
      : 'cursor-eraser'
    : currentTool === 'pen' || currentTool === 'highlighter'
    ? 'cursor-none'
    : currentTool === 'laser'
    ? 'cursor-laser'
    : currentTool === 'rectangle' ||
      currentTool === 'ellipse' ||
      currentTool === 'arrow'
    ? 'cursor-crosshair-custom'
    : currentTool === 'text'
    ? 'cursor-text'
    : 'cursor-default';

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-full h-full overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        data-testid="whiteboard-canvas"
        data-board-type={boardType}
        data-board-pattern={boardPattern}
        data-element-count={elements.length}
        data-selected-count={selectedIds.length}
        data-tool={currentTool}
        data-eraser-mode={eraserMode}
        data-eraser-active-size={eraserSize}
        data-stroke-width={strokeWidth}
        data-zoom={Math.round(camera.zoom * 100)}
        data-camera-x={Math.round(camera.x)}
        data-camera-y={Math.round(camera.y)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        className={`block w-full h-full touch-none ${cursorClass}`}
      />

      {/* Hardware-accelerated cursor ring overlay (zero canvas redraw, 0ms lag) */}
      <div
        ref={cursorOverlayRef}
        data-testid="cursor-ring-overlay"
        className="pointer-events-none absolute top-0 left-0 z-30 will-change-transform"
        style={{
          display: 'none',
          transform: 'translate3d(-9999px, -9999px, 0) translate(-50%, -50%)',
        }}
      >
        <div
          ref={cursorCircleRef}
          className="rounded-full flex items-center justify-center pointer-events-none"
          style={{
            width: 16,
            height: 16,
            border: '1.5px solid #4f46e5',
            backgroundColor: 'rgba(79, 70, 229, 0.2)',
            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div
            ref={cursorDotRef}
            className="w-1 h-1 rounded-full pointer-events-none"
            style={{ backgroundColor: '#4f46e5' }}
          />
        </div>
      </div>

      {/* Subtle empty-board onboarding cue (auto-hidden when virtual instruments or pinned problem are active) */}
      {hasLoaded &&
        elements.length === 0 &&
        !pinnedProblem &&
        !virtualTools.ruler.active &&
        !virtualTools.setSquare.active &&
        !virtualTools.protractor.active &&
        !virtualTools.compass.active &&
        (() => {
          const safe =
            boardType === 'math'
              ? getSafeMathViewport({
                  viewW: viewportSize.width,
                  viewH: viewportSize.height,
                  isCalculatorOpen,
                  isCalculatorMinimized,
                  isMathPanelOpen: true,
                  isMathPanelCollapsed,
                  hasPinnedProblem: false,
                  hasContextualToolbar: false,
                })
              : null;

          return (
            <div
              style={
                safe
                  ? {
                      left: safe.left,
                      top: safe.top,
                      width: safe.width,
                      height: safe.height,
                    }
                  : undefined
              }
              className={`pointer-events-none absolute ${
                safe ? '' : 'inset-0'
              } flex justify-center p-4 ${
                boardPattern === 'coordinate' ? 'items-end pb-8' : 'items-center'
              }`}
            >
              <div className="max-w-md text-center space-y-1.5 select-none opacity-65 dark:opacity-55">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {boardType === 'math'
                    ? boardPattern === 'coordinate'
                      ? 'Bảng Toán Học — Hệ trục tọa độ Oxy'
                      : 'Bảng Toán Học — Sẵn sàng viết vẽ & tính toán'
                    : 'Bắt đầu viết vẽ trên không gian vô tận'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {boardType === 'math'
                    ? 'Viết tay tự do, chèn công thức, dựng hình học hoặc vẽ đồ thị hàm số ở bảng bên phải'
                    : 'Giữ Shift khi vẽ để kẻ đường thẳng · Phím [ ] chỉnh cỡ nét · Phím F bật chế độ tập trung'}
                </p>
                {boardType !== 'math' && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Lăn chuột để thu phóng · Giữ chuột phải hoặc Space để kéo bảng · Kéo-thả ảnh, PDF, Word
                  </p>
                )}
              </div>
            </div>
          );
        })()}

      {/* Drag & drop overlay */}
      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-4 z-40 rounded-3xl border-2 border-dashed border-indigo-500 bg-indigo-500/10 backdrop-blur-[2px] flex items-center justify-center">
          <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 shadow-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold text-sm">
            <ImagePlus className="w-5 h-5" />
            <span>Thả ảnh, PDF hoặc Word (.docx) vào bảng</span>
          </div>
        </div>
      )}
    </div>
  );
};
