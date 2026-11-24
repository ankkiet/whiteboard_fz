import React, { useCallback, useEffect, useRef } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { computeBrushRadiusWorld } from '../../engine/drawingUtils';
import { Point } from '../../types/board';

interface UseCanvasCursorOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isPanningMode: () => boolean;
  spacePressed: boolean;
}

export function useCanvasCursor({
  canvasRef,
  isPanningMode,
  spacePressed,
}: UseCanvasCursorOptions) {
  const currentTool = useBoardStore((s) => s.currentTool);
  const strokeWidth = useBoardStore((s) => s.strokeWidth);
  const eraserSize = useBoardStore((s) => s.eraserSize);
  const color = useBoardStore((s) => s.color);
  const highlighterColor = useBoardStore((s) => s.highlighterColor);
  const zoom = useBoardStore((s) => s.camera.zoom);
  const isDarkMode = useBoardStore((s) => s.isDarkMode);
  const eraserMode = useBoardStore((s) => s.eraserMode);

  // Hardware-accelerated cursor refs (zero canvas repaint on mouse move)
  const cursorOverlayRef = useRef<HTMLDivElement>(null);
  const cursorCircleRef = useRef<HTMLDivElement>(null);
  const cursorDotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cursorCircleRef.current || !cursorDotRef.current) return;
    const circle = cursorCircleRef.current;
    const dot = cursorDotRef.current;

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
    zoom,
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

      if (!isRingTool || isPanningMode() || spacePressed) {
        cursorOverlayRef.current.style.display = 'none';
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const sx = customScreenPos ? customScreenPos.x : clientX - rect.left;
      const sy = customScreenPos ? customScreenPos.y : clientY - rect.top;

      cursorOverlayRef.current.style.display = 'block';
      cursorOverlayRef.current.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`;
    },
    [canvasRef, currentTool, eraserMode, isPanningMode, spacePressed]
  );

  const hideCursorOverlay = useCallback(() => {
    if (cursorOverlayRef.current) {
      cursorOverlayRef.current.style.display = 'none';
    }
  }, []);

  return {
    cursorOverlayRef,
    cursorCircleRef,
    cursorDotRef,
    updateCursorOverlayPos,
    hideCursorOverlay,
  };
}
