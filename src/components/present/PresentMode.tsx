import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { computeFitCamera, screenToWorld } from '../../engine/geometry';
import {
  drawBoardElement,
  drawLaserTrail,
  drawWorldBackgroundPattern,
  getCanvasBackgroundColor,
} from '../../engine/renderer';
import { subscribeImageCache } from '../../engine/imageCache';
import { Camera, LaserPoint } from '../../types/board';
import { useI18n } from '../../i18n/useI18n';
import { X, Wand2, Maximize2 } from 'lucide-react';

interface PresentModeProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PresentMode: React.FC<PresentModeProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const elements = useBoardStore((s) => s.elements);
  const assets = useBoardStore((s) => s.assets);
  const isDarkMode = useBoardStore((s) => s.isDarkMode);
  const boardPattern = useBoardStore((s) => s.boardPattern);
  const title = useBoardStore((s) => s.title);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [laserEnabled, setLaserEnabled] = useState(true);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [imageTick, setImageTick] = useState(0);

  const laserPointsRef = useRef<LaserPoint[]>([]);
  const strokeIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const isPointerDownRef = useRef(false);

  const fitContent = useCallback(() => {
    setCamera(computeFitCamera(elements, window.innerWidth, window.innerHeight, 80));
  }, [elements]);

  useEffect(() => {
    if (!isOpen) return;
    fitContent();
    const unsub = subscribeImageCache(() => setImageTick((t) => t + 1));
    const onResize = () => fitContent();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key.toLowerCase() === 'l') setLaserEnabled((v) => !v);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      unsub();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, fitContent, onClose]);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = getCanvasBackgroundColor(isDarkMode);
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    drawWorldBackgroundPattern(ctx, camera, width, height, boardPattern, isDarkMode);

    const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    for (const el of sorted) {
      drawBoardElement(ctx, el, { isDarkMode, assets });
    }

    if (laserPointsRef.current.length > 0) {
      drawLaserTrail(ctx, laserPointsRef.current, Date.now(), camera.zoom);
    }

    ctx.restore();
  }, [assets, boardPattern, camera, elements, isDarkMode]);

  useEffect(() => {
    if (!isOpen) return;
    renderFrame();
  }, [isOpen, renderFrame, imageTick]);

  const ensureLaserLoop = useCallback(() => {
    if (rafRef.current !== null) return;
    const tick = () => {
      const now = Date.now();
      laserPointsRef.current = laserPointsRef.current.filter((p) => now - p.timestamp < 1500);
      renderFrame();
      if (laserPointsRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [renderFrame]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const pushLaserPoint = (clientX: number, clientY: number) => {
    const worldPt = screenToWorld(clientX, clientY, camera, { left: 0, top: 0 });
    laserPointsRef.current.push({
      x: worldPt.x,
      y: worldPt.y,
      timestamp: Date.now(),
      strokeId: strokeIdRef.current,
    });
    ensureLaserLoop();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('Chế độ trình bày bảng trắng', 'Whiteboard presentation mode')}
      className={`fixed inset-0 z-50 overflow-hidden ${laserEnabled ? 'cursor-laser' : 'cursor-default'}`}
      onPointerDown={(e) => {
        if (!laserEnabled || (e.target as HTMLElement).closest('[data-present-hud]')) return;
        isPointerDownRef.current = true;
        strokeIdRef.current += 1;
        pushLaserPoint(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!laserEnabled) return;
        if (isPointerDownRef.current || e.buttons === 1) {
          pushLaserPoint(e.clientX, e.clientY);
        }
      }}
      onPointerUp={() => {
        isPointerDownRef.current = false;
      }}
    >
      <canvas ref={canvasRef} data-testid="present-canvas" className="block w-full h-full touch-none" />

      {elements.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {t(
              'Bảng hiện đang trống. Thoát trình bày để thêm nội dung.',
              'The board is currently empty. Exit presentation to add content.'
            )}
          </p>
        </div>
      )}

      {/* Minimalist floating HUD */}
      <div
        data-present-hud
        className="cursor-default absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-none text-slate-800 dark:text-slate-100"
      >
        <span className="text-xs font-medium max-w-[160px] truncate px-1">{title}</span>
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
        <button
          type="button"
          onClick={() => setLaserEnabled((v) => !v)}
          aria-pressed={laserEnabled}
          className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer ${
            laserEnabled
              ? 'bg-red-600 text-white'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <Wand2 className="w-4 h-4" strokeWidth={1.75} />
          <span>{t('Tia laser', 'Laser')}</span>
          <kbd className={`kbd-keycap ${laserEnabled ? '!bg-red-700 !border-red-400/40 !text-white' : ''}`}>L</kbd>
        </button>
        <button
          type="button"
          onClick={fitContent}
          title={t('Căn vừa màn hình', 'Fit to screen')}
          aria-label={t('Căn vừa màn hình', 'Fit to screen')}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onClose}
          title={t('Thoát trình bày (Esc)', 'Exit presentation (Esc)')}
          aria-label={t('Thoát trình bày', 'Exit presentation')}
          className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
          <span>{t('Thoát', 'Exit')}</span>
        </button>
      </div>
    </div>
  );
};
