import React, { useEffect } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { zoomCameraAtPoint } from '../../engine/geometry';
import {
  clampNotebookCamera,
  computeTotalNotebookPages,
  getNotebookConfig,
} from '../../engine/notebookEngine';

interface UseCanvasWheelOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isInteractionIdle: () => boolean;
}

export function useCanvasWheel({ canvasRef, isInteractionIdle }: UseCanvasWheelOptions) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Block accidental wheel zoom or pan while actively writing, erasing, or dragging
      if (!isInteractionIdle()) {
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

      const store = useBoardStore.getState();
      if (store.boardType === 'notebook') {
        const config = getNotebookConfig(store.notebookPaperSize);
        const vp = {
          width: canvas.clientWidth || window.innerWidth,
          height: canvas.clientHeight || window.innerHeight,
        };
        const totalPages = computeTotalNotebookPages(
          store.elements,
          store.camera,
          vp.height,
          config
        );

        if (e.ctrlKey || e.metaKey) {
          const sensitivity = 0.005;
          const factor = Math.exp(-normalizedDelta * sensitivity);
          const nextCam = zoomCameraAtPoint(store.camera, store.camera.zoom * factor, anchorX, anchorY);
          store.setCamera(clampNotebookCamera(nextCam, vp, config, totalPages));
        } else {
          const nextCam = {
            ...store.camera,
            y: store.camera.y - normalizedDelta,
          };
          store.setCamera(clampNotebookCamera(nextCam, vp, config, totalPages));
        }
        return;
      }

      // Pinch-to-zoom on trackpads fires ctrlKey with small deltas; regular mouse notches are ~100px
      const sensitivity = e.ctrlKey || e.metaKey ? 0.006 : 0.0014;
      const factor = Math.exp(-normalizedDelta * sensitivity);

      store.setCamera((prev) =>
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
  }, [canvasRef, isInteractionIdle]);
}
