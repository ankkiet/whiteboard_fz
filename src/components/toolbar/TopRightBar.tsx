import React, { useState, useRef, useEffect } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { computeFitCamera, zoomCameraAtPoint } from '../../engine/geometry';
import { PWAInstallTriggerButton } from '../modals/DesktopAppModal';
import {
  ZoomIn,
  ZoomOut,
  Sun,
  Moon,
  Grid,
  Presentation,
  Check,
  Maximize2,
  Focus,
} from 'lucide-react';
import { BoardPattern } from '../../types/board';

interface TopRightBarProps {
  onPresentClick: () => void;
  onToggleFocusMode: () => void;
  onOpenDesktopAppClick: () => void;
}

export const TopRightBar: React.FC<TopRightBarProps> = ({
  onPresentClick,
  onToggleFocusMode,
  onOpenDesktopAppClick,
}) => {
  const camera = useBoardStore((s) => s.camera);
  const setCamera = useBoardStore((s) => s.setCamera);
  const theme = useBoardStore((s) => s.theme);
  const setTheme = useBoardStore((s) => s.setTheme);
  const boardPattern = useBoardStore((s) => s.boardPattern);
  const setBoardPattern = useBoardStore((s) => s.setBoardPattern);
  const elements = useBoardStore((s) => s.elements);

  const [showPatternMenu, setShowPatternMenu] = useState(false);
  const patternMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (patternMenuRef.current && !patternMenuRef.current.contains(event.target as Node)) {
        setShowPatternMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const zoomPercent = Math.round(camera.zoom * 100);

  const handleZoomIn = () => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setCamera((prev) => zoomCameraAtPoint(prev, prev.zoom * 1.2, cx, cy));
  };

  const handleZoomOut = () => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setCamera((prev) => zoomCameraAtPoint(prev, prev.zoom / 1.2, cx, cy));
  };

  const handleResetZoom = () => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setCamera((prev) => zoomCameraAtPoint(prev, 1, cx, cy));
  };

  const handleFitToScreen = () => {
    setCamera(computeFitCamera(elements, window.innerWidth, window.innerHeight, 100));
  };

  const patterns: { id: BoardPattern; label: string }[] = [
    { id: 'plain', label: 'Trắng trơn' },
    { id: 'grid', label: 'Lưới ô ly' },
    { id: 'coordinate', label: 'Trục tọa độ Oxy' },
    { id: 'isometric', label: 'Lưới tam giác 3D' },
    { id: 'polar', label: 'Lưới tọa độ cực' },
    { id: 'dots', label: 'Chấm bi' },
    { id: 'lined', label: 'Dòng kẻ' },
  ];

  return (
    <div
      data-testid="top-right-bar"
      className="pointer-events-auto shrink-0 flex items-center gap-0.5 sm:gap-1 lg:gap-1.5 bg-white/92 dark:bg-slate-900/92 backdrop-blur-md px-1.5 sm:px-2 lg:px-2.5 py-1.5 rounded-2xl shadow-lg shadow-slate-900/5 dark:shadow-black/30 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 transition-colors"
    >
      {/* Zoom Controls */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={handleZoomOut}
          title="Thu nhỏ (Ctrl -)"
          aria-label="Thu nhỏ"
          className="hidden lg:flex p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          title="Đặt lại tỷ lệ 100% (Ctrl 0)"
          aria-label={`Tỷ lệ thu phóng ${zoomPercent}%, bấm để đặt lại 100%`}
          className="px-1.5 sm:px-2 py-1 text-xs font-semibold font-mono tabular-nums hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors min-w-[44px] sm:min-w-[48px] text-center whitespace-nowrap shrink-0"
        >
          {zoomPercent}%
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          title="Phóng to (Ctrl +)"
          aria-label="Phóng to"
          className="hidden lg:flex p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleFitToScreen}
          title="Vừa khung màn hình"
          aria-label="Vừa khung màn hình"
          className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200 hidden md:flex"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

      {/* Background Pattern Selector */}
      <div className="relative" ref={patternMenuRef}>
        <button
          type="button"
          onClick={() => setShowPatternMenu((v) => !v)}
          title="Chọn nền bảng"
          aria-label="Chọn nền bảng"
          aria-expanded={showPatternMenu}
          className={`p-1.5 sm:p-2 rounded-xl transition-colors flex items-center gap-1.5 ${
            showPatternMenu
              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <Grid className="w-4 h-4" />
        </button>

        {showPatternMenu && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 z-30"
          >
            <div className="text-xs font-medium px-2.5 py-1.5 text-slate-500 dark:text-slate-400">
              Nền bảng
            </div>
            {patterns.map((pat) => (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={boardPattern === pat.id}
                key={pat.id}
                onClick={() => {
                  setBoardPattern(pat.id);
                  setShowPatternMenu(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-xl transition-colors whitespace-nowrap ${
                  boardPattern === pat.id
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium'
                }`}
              >
                <span>{pat.label}</span>
                {boardPattern === pat.id && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Theme Toggle */}
      <button
        type="button"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        title={theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
        aria-label={theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
        className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
      >
        {theme === 'light' ? (
          <Moon className="w-4 h-4" />
        ) : (
          <Sun className="w-4 h-4 text-amber-400" />
        )}
      </button>

      {/* Focus Writing Mode */}
      <button
        type="button"
        onClick={onToggleFocusMode}
        title="Chế độ tập trung viết vẽ (F)"
        aria-label="Chế độ tập trung viết vẽ (F)"
        className="hidden sm:flex p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
      >
        <Focus className="w-4 h-4" />
      </button>

      {/* Install / Package Desktop App (Windows & macOS) */}
      <PWAInstallTriggerButton onOpenModal={onOpenDesktopAppClick} compact />

      {/* Present Mode */}
      <button
        type="button"
        onClick={onPresentClick}
        title="Chế độ Trình bày"
        aria-label="Chế độ Trình bày"
        className="flex items-center gap-1.5 px-2 lg:px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
      >
        <Presentation className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Trình bày</span>
      </button>
    </div>
  );
};
