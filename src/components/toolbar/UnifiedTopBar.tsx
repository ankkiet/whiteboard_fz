import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { DriveSyncStatus } from '../../services/driveSyncUtils';
import { BoardType, ToolType } from '../../types/board';
import { computeFitCamera, zoomCameraAtPoint } from '../../engine/geometry';
import {
  clampNotebookCamera,
  computeTotalNotebookPages,
  getNotebookConfig,
  getNotebookFitCamera,
} from '../../engine/notebookEngine';
import { TOOLS } from './toolbarConfig';
import { TopBarFlyout } from './TopBarFlyout';
import {
  ChevronDown,
  ChevronUp,
  Eraser,
  Home,
  Redo2,
  Undo2,
} from 'lucide-react';

interface UnifiedTopBarProps {
  onHomeClick: () => void;
  onExportClick: () => void;
  onDriveClick: () => void;
  onPresentClick: () => void;
  onToggleFocusMode: () => void;
  onTriggerImageUpload: () => void;
  isDriveConnected?: boolean;
  syncStatus?: DriveSyncStatus;
  lastSyncedAt?: string | null;
  autoSaveEnabled?: boolean;
  boardType?: BoardType;
  isMathPanelOpen?: boolean;
  onToggleMathPanel?: () => void;
}

export const UnifiedTopBar: React.FC<UnifiedTopBarProps> = ({
  onHomeClick,
  onExportClick,
  onDriveClick,
  onPresentClick,
  onToggleFocusMode,
  onTriggerImageUpload,
  isDriveConnected = false,
  syncStatus = 'idle',
  boardType = 'basic',
  isMathPanelOpen = false,
  onToggleMathPanel,
}) => {
  const title = useBoardStore((s) => s.title);
  const setTitle = useBoardStore((s) => s.setTitle);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const historyIndex = useBoardStore((s) => s.historyIndex);
  const historyLength = useBoardStore((s) => s.history.length);
  const elements = useBoardStore((s) => s.elements);

  const currentTool = useBoardStore((s) => s.currentTool);
  const setCurrentTool = useBoardStore((s) => s.setCurrentTool);
  const color = useBoardStore((s) => s.color);
  const highlighterColor = useBoardStore((s) => s.highlighterColor);
  const strokeWidth = useBoardStore((s) => s.strokeWidth);
  const stickyColor = useBoardStore((s) => s.stickyColor);
  const isDarkMode = useBoardStore((s) => s.isDarkMode);
  const notebookPaperSize = useBoardStore((s) => s.notebookPaperSize);
  const camera = useBoardStore((s) => s.camera);
  const setCamera = useBoardStore((s) => s.setCamera);
  const isMathPanelCollapsed = useBoardStore((s) => s.isMathPanelCollapsed);
  const isCalculatorOpen = useBoardStore((s) => s.isCalculatorOpen);
  const isCalculatorMinimized = useBoardStore((s) => s.isCalculatorMinimized);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const prevToolRef = useRef<ToolType>('pen');
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-collapse when clicking outside the unified bar on the canvas, unless pinned
  useEffect(() => {
    if (!isExpanded || isPinned) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isExpanded, isPinned]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;
  const zoomPercent = Math.round(camera.zoom * 100);

  const handleSelectTool = useCallback(
    (tool: ToolType) => {
      if (tool === 'image') {
        onTriggerImageUpload();
        if (!isPinned) setIsExpanded(false);
        return;
      }
      if (tool !== 'eraser') {
        prevToolRef.current = tool;
      }
      setCurrentTool(tool);
      if (!isPinned) {
        setIsExpanded(false);
      }
    },
    [setCurrentTool, onTriggerImageUpload, isPinned]
  );

  const handleQuickEraserToggle = () => {
    if (currentTool === 'eraser') {
      setCurrentTool(prevToolRef.current || 'pen');
    } else {
      prevToolRef.current = currentTool;
      setCurrentTool('eraser');
    }
  };

  const handleZoomIn = () => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setCamera((prev) => {
      const next = zoomCameraAtPoint(prev, prev.zoom * 1.2, cx, cy);
      if (boardType === 'notebook') {
        const config = getNotebookConfig(notebookPaperSize);
        const totalPages = computeTotalNotebookPages(elements, next, window.innerHeight, config);
        return clampNotebookCamera(next, { width: window.innerWidth, height: window.innerHeight }, config, totalPages);
      }
      return next;
    });
  };

  const handleZoomOut = () => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setCamera((prev) => {
      const next = zoomCameraAtPoint(prev, prev.zoom / 1.2, cx, cy);
      if (boardType === 'notebook') {
        const config = getNotebookConfig(notebookPaperSize);
        const totalPages = computeTotalNotebookPages(elements, next, window.innerHeight, config);
        return clampNotebookCamera(next, { width: window.innerWidth, height: window.innerHeight }, config, totalPages);
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    if (boardType === 'notebook') {
      const config = getNotebookConfig(notebookPaperSize);
      setCamera(getNotebookFitCamera({ width: window.innerWidth, height: window.innerHeight }, config));
      return;
    }
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setCamera((prev) => zoomCameraAtPoint(prev, 1, cx, cy));
  };

  const handleFitToScreen = () => {
    if (boardType === 'notebook') {
      const config = getNotebookConfig(notebookPaperSize);
      setCamera(getNotebookFitCamera({ width: window.innerWidth, height: window.innerHeight }, config));
      return;
    }
    setCamera(computeFitCamera(elements, window.innerWidth, window.innerHeight, 100));
  };

  const activeToolDef = TOOLS.find((t) => t.id === currentTool) || TOOLS[2];
  const ActiveToolIcon = activeToolDef.icon;

  const resolvedPenInk =
    isDarkMode && color.toLowerCase() === '#1e293b' ? '#f1f5f9' : color;
  const inkDotColor =
    currentTool === 'pen'
      ? resolvedPenInk
      : currentTool === 'highlighter'
      ? highlighterColor
      : currentTool === 'sticky'
      ? stickyColor
      : null;

  const hasOpenMathRight = boardType === 'math' && isMathPanelOpen && !isMathPanelCollapsed;
  const hasOpenCalcLeft = isCalculatorOpen && !isCalculatorMinimized;
  const flyoutMarginStyle: React.CSSProperties | undefined =
    hasOpenMathRight && !hasOpenCalcLeft
      ? { marginRight: 336 }
      : hasOpenCalcLeft && !hasOpenMathRight
      ? { marginLeft: 328 }
      : undefined;

  return (
    <header
      ref={containerRef}
      role="banner"
      aria-label="Thanh công cụ bảng trắng"
      className="pointer-events-none absolute top-3 inset-x-0 z-30 flex flex-col items-center px-3"
    >
      {/* 1. Persistent floating bar */}
      <div
        data-testid="unified-capsule-bar"
        className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2 py-1.5 rounded-2xl shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 transition-colors duration-150 max-w-[calc(100vw-24px)] overflow-x-auto scrollbar-none"
      >
        {/* Trang chủ */}
        <button
          type="button"
          onClick={onHomeClick}
          title="Về trang chủ xem tất cả bảng đã lưu"
          aria-label="Về trang chủ"
          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0 transition-colors duration-150 cursor-pointer"
        >
          <Home className="w-4 h-4" strokeWidth={1.75} />
        </button>

        {/* Tiêu đề sổ ghi chép / bảng trắng */}
        <input
          type="text"
          aria-label={boardType === 'notebook' ? 'Tên sổ ghi chép' : 'Tên bảng trắng'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="font-medium text-xs sm:text-sm bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 px-2 py-1 rounded-lg outline-none transition-colors duration-150 w-28 sm:w-36 md:w-44 max-w-[280px] truncate text-slate-900 dark:text-slate-100"
          placeholder={boardType === 'notebook' ? 'Tên sổ ghi chép' : 'Tên bảng'}
        />

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

        {/* Công cụ đang chọn */}
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          title={`Công cụ hiện tại: ${activeToolDef.label} (${activeToolDef.shortcut}) — Bấm để mở rộng khay công cụ`}
          aria-label={`Công cụ hiện tại: ${activeToolDef.label}`}
          aria-expanded={isExpanded}
          className={`h-8 flex items-center gap-2 px-2.5 rounded-lg transition-colors duration-150 shrink-0 cursor-pointer ${
            isExpanded
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200/80 dark:hover:bg-slate-700'
          }`}
        >
          <ActiveToolIcon className="w-4 h-4" />
          <span className="hidden sm:inline font-medium text-xs">{activeToolDef.label}</span>
          {inkDotColor && (
            <span
              className="w-2.5 h-2.5 rounded-full ring-1 ring-black/15 dark:ring-white/30 shrink-0"
              style={{ backgroundColor: inkDotColor }}
            />
          )}
          {currentTool === 'pen' && (
            <span className="hidden lg:inline text-xs font-mono tabular-nums opacity-70">{strokeWidth}px</span>
          )}
        </button>

        {/* Phím tắt nhanh chuyển đổi tẩy / bút vẽ */}
        <button
          type="button"
          onClick={handleQuickEraserToggle}
          title={
            currentTool === 'eraser'
              ? 'Đang dùng tẩy — Bấm để quay lại bút vẽ (E)'
              : 'Chuyển nhanh sang tẩy (E)'
          }
          aria-label="Tẩy xóa nhanh"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 shrink-0 cursor-pointer ${
            currentTool === 'eraser'
              ? 'bg-indigo-600 text-white'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          <Eraser className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

        {/* Hoàn tác & Làm lại */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Hoàn tác (Ctrl+Z)"
            aria-label="Hoàn tác"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors duration-150 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <Undo2 className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Làm lại (Ctrl+Shift+Z)"
            aria-label="Làm lại"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors duration-150 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <Redo2 className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

        {/* Thu phóng tỷ lệ */}
        <button
          type="button"
          onClick={handleResetZoom}
          title="Đặt lại tỷ lệ 100% (Ctrl 0)"
          aria-label={`Tỷ lệ thu phóng ${zoomPercent}%, bấm để đặt lại 100%`}
          className="h-8 px-2 text-xs font-medium font-mono tabular-nums hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors duration-150 text-slate-600 dark:text-slate-300 shrink-0 text-center cursor-pointer"
        >
          {zoomPercent}%
        </button>

        {/* Nút Mở rộng / Thu gọn chính */}
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          title={isExpanded ? 'Thu gọn thanh công cụ' : 'Mở rộng toàn bộ công cụ & cài đặt'}
          aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          className={`h-8 flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-colors duration-150 shrink-0 cursor-pointer ${
            isExpanded
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          <span>{isExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" strokeWidth={1.75} />
          ) : (
            <ChevronDown className="w-4 h-4" strokeWidth={1.75} />
          )}
        </button>
      </div>

      {/* 2. Expanded flyout hub */}
      {isExpanded && (
        <TopBarFlyout
          boardType={boardType}
          isPinned={isPinned}
          onTogglePin={() => setIsPinned((v) => !v)}
          inkDotColor={inkDotColor}
          flyoutMarginStyle={flyoutMarginStyle}
          isDriveConnected={isDriveConnected}
          syncStatus={syncStatus}
          isMathPanelOpen={isMathPanelOpen}
          onSelectTool={handleSelectTool}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitToScreen={handleFitToScreen}
          onExportClick={onExportClick}
          onDriveClick={onDriveClick}
          onPresentClick={onPresentClick}
          onToggleFocusMode={onToggleFocusMode}
          onToggleMathPanel={onToggleMathPanel}
        />
      )}
    </header>
  );
};
