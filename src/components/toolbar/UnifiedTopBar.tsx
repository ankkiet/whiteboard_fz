import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { DriveSyncStatus, formatSyncTime } from '../../services/driveSyncUtils';
import { BoardType, BoardPattern, NotebookPaperSize, ToolType } from '../../types/board';
import { computeFitCamera, zoomCameraAtPoint } from '../../engine/geometry';
import {
  clampNotebookCamera,
  computeTotalNotebookPages,
  getNotebookConfig,
  getNotebookFitCamera,
  NOTEBOOK_PAPER_STYLES,
  normalizeNotebookPaperStyle,
} from '../../engine/notebookEngine';
import {
  clampEraserSize,
  clampStrokeWidth,
  MAX_ERASER_SIZE,
  MAX_STROKE_WIDTH,
  MIN_ERASER_SIZE,
  MIN_STROKE_WIDTH,
} from '../../engine/drawingUtils';
import {
  Home,
  Undo2,
  Redo2,
  Cloud,
  Check,
  Loader2,
  AlertCircle,
  Download,
  Sigma,
  Trash2,
  MousePointer2,
  Hand,
  PenTool,
  Highlighter,
  Eraser,
  Square,
  Circle,
  ArrowUpRight,
  Type,
  StickyNote,
  Image as ImageIcon,
  Wand2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sun,
  Moon,
  Grid,
  Focus,
  Presentation,
  ChevronDown,
  ChevronUp,
  Pin,
  PinOff,
  Pipette,
  SquareDashed,
  RotateCcw,
  BookOpen,
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

interface ToolItem {
  id: ToolType;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
  group: number;
}

const TOOLS: ToolItem[] = [
  { id: 'select', label: 'Chọn', shortcut: 'V', icon: MousePointer2, group: 0 },
  { id: 'hand', label: 'Kéo bảng', shortcut: 'H', icon: Hand, group: 0 },
  { id: 'pen', label: 'Bút vẽ', shortcut: 'P', icon: PenTool, group: 1 },
  { id: 'highlighter', label: 'Bút dạ quang', shortcut: 'M', icon: Highlighter, group: 1 },
  { id: 'eraser', label: 'Tẩy', shortcut: 'E', icon: Eraser, group: 1 },
  { id: 'laser', label: 'Bút tia Laser', shortcut: 'L', icon: Wand2, group: 1 },
  { id: 'rectangle', label: 'Hình chữ nhật', shortcut: 'R', icon: Square, group: 2 },
  { id: 'ellipse', label: 'Hình tròn', shortcut: 'O', icon: Circle, group: 2 },
  { id: 'arrow', label: 'Mũi tên', shortcut: 'A', icon: ArrowUpRight, group: 2 },
  { id: 'text', label: 'Văn bản', shortcut: 'T', icon: Type, group: 3 },
  { id: 'sticky', label: 'Ghi chú dán', shortcut: 'S', icon: StickyNote, group: 3 },
  { id: 'image', label: 'Chèn ảnh / tệp', shortcut: 'I', icon: ImageIcon, group: 3 },
];

const INK_COLORS = [
  { hex: '#1e293b', label: 'Mực chuẩn' },
  { hex: '#4f46e5', label: 'Chàm' },
  { hex: '#2563eb', label: 'Xanh dương' },
  { hex: '#059669', label: 'Xanh lá' },
  { hex: '#d97706', label: 'Hổ phách' },
  { hex: '#e11d48', label: 'Đỏ hồng' },
  { hex: '#7c3aed', label: 'Tím' },
  { hex: '#64748b', label: 'Xám đá' },
];

const HIGHLIGHTER_COLORS = [
  { hex: '#fde047', label: 'Vàng chanh' },
  { hex: '#86efac', label: 'Xanh bạc hà' },
  { hex: '#7dd3fc', label: 'Xanh trời' },
  { hex: '#f9a8d4', label: 'Hồng phấn' },
  { hex: '#fdba74', label: 'Cam nhạt' },
  { hex: '#c4b5fd', label: 'Tím nhạt' },
];

const STICKY_COLORS = [
  { hex: '#fef08a', label: 'Vàng nhạt' },
  { hex: '#bbf7d0', label: 'Xanh lá nhạt' },
  { hex: '#bae6fd', label: 'Xanh dương nhạt' },
  { hex: '#fbcfe8', label: 'Hồng nhạt' },
  { hex: '#fed7aa', label: 'Cam đào' },
  { hex: '#e9d5ff', label: 'Tím oải hương' },
];

const STROKE_WIDTHS = [
  { value: 2, label: 'Mảnh', dot: 4 },
  { value: 4, label: 'Vừa', dot: 7 },
  { value: 7, label: 'Đậm', dot: 10 },
  { value: 12, label: 'Rất đậm', dot: 14 },
];

const ERASER_SIZES = [
  { value: 14, label: 'Nhỏ', dot: 6 },
  { value: 24, label: 'Vừa', dot: 10 },
  { value: 40, label: 'Lớn', dot: 14 },
  { value: 64, label: 'Rất lớn', dot: 18 },
];

const PATTERNS: { id: BoardPattern; label: string }[] = [
  { id: 'plain', label: 'Trắng trơn' },
  { id: 'grid', label: 'Lưới ô ly' },
  { id: 'coordinate', label: 'Trục tọa độ Oxy' },
  { id: 'isometric', label: 'Lưới tam giác 3D' },
  { id: 'polar', label: 'Lưới tọa độ cực' },
  { id: 'dots', label: 'Chấm bi' },
  { id: 'lined', label: 'Dòng kẻ' },
];

export const UnifiedTopBar: React.FC<UnifiedTopBarProps> = ({
  onHomeClick,
  onExportClick,
  onDriveClick,
  onPresentClick,
  onToggleFocusMode,
  onTriggerImageUpload,
  isDriveConnected = false,
  syncStatus = 'idle',
  lastSyncedAt = null,
  autoSaveEnabled = true,
  boardType = 'basic',
  isMathPanelOpen = false,
  onToggleMathPanel,
}) => {
  // Store subscriptions
  const title = useBoardStore((s) => s.title);
  const setTitle = useBoardStore((s) => s.setTitle);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const historyIndex = useBoardStore((s) => s.historyIndex);
  const historyLength = useBoardStore((s) => s.history.length);
  const clearBoard = useBoardStore((s) => s.clearBoard);
  const elementCount = useBoardStore((s) => s.elements.length);
  const elements = useBoardStore((s) => s.elements);

  const currentTool = useBoardStore((s) => s.currentTool);
  const setCurrentTool = useBoardStore((s) => s.setCurrentTool);
  const color = useBoardStore((s) => s.color);
  const setColor = useBoardStore((s) => s.setColor);
  const highlighterColor = useBoardStore((s) => s.highlighterColor);
  const setHighlighterColor = useBoardStore((s) => s.setHighlighterColor);
  const strokeWidth = useBoardStore((s) => s.strokeWidth);
  const setStrokeWidth = useBoardStore((s) => s.setStrokeWidth);
  const stickyColor = useBoardStore((s) => s.stickyColor);
  const setStickyColor = useBoardStore((s) => s.setStickyColor);
  const eraserMode = useBoardStore((s) => s.eraserMode);
  const setEraserMode = useBoardStore((s) => s.setEraserMode);
  const eraserSize = useBoardStore((s) => s.eraserSize);
  const setEraserSize = useBoardStore((s) => s.setEraserSize);
  const isDarkMode = useBoardStore((s) => s.isDarkMode);
  const theme = useBoardStore((s) => s.theme);
  const setTheme = useBoardStore((s) => s.setTheme);
  const boardPattern = useBoardStore((s) => s.boardPattern);
  const setBoardPattern = useBoardStore((s) => s.setBoardPattern);
  const notebookPaperSize = useBoardStore((s) => s.notebookPaperSize);
  const setNotebookPaperSize = useBoardStore((s) => s.setNotebookPaperSize);
  const camera = useBoardStore((s) => s.camera);
  const setCamera = useBoardStore((s) => s.setCamera);

  // Local state for expandable drawer & modals
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showPatternMenu, setShowPatternMenu] = useState(false);
  const [showPaperSizeMenu, setShowPaperSizeMenu] = useState(false);

  // Previous non-eraser tool for quick toggle
  const prevToolRef = useRef<ToolType>('pen');
  const containerRef = useRef<HTMLDivElement>(null);
  const clearPopoverRef = useRef<HTMLDivElement>(null);
  const patternMenuRef = useRef<HTMLDivElement>(null);
  const paperSizeMenuRef = useRef<HTMLDivElement>(null);
  const customColorInputRef = useRef<HTMLInputElement>(null);

  // Close clear popover on outside click
  useEffect(() => {
    if (!confirmClear) return;
    const onOutside = (e: MouseEvent) => {
      if (clearPopoverRef.current && !clearPopoverRef.current.contains(e.target as Node)) {
        setConfirmClear(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [confirmClear]);

  // Close pattern / paper size dropdowns on outside click
  useEffect(() => {
    if (!showPatternMenu && !showPaperSizeMenu) return;
    const onOutside = (e: MouseEvent) => {
      if (patternMenuRef.current && !patternMenuRef.current.contains(e.target as Node)) {
        setShowPatternMenu(false);
      }
      if (paperSizeMenuRef.current && !paperSizeMenuRef.current.contains(e.target as Node)) {
        setShowPaperSizeMenu(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showPatternMenu, showPaperSizeMenu]);

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

  // Tool selection handler
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
      // Auto-collapse if not pinned
      if (!isPinned) {
        setIsExpanded(false);
      }
    },
    [setCurrentTool, onTriggerImageUpload, isPinned]
  );

  // Quick toggle between Eraser and Pen / Previous tool
  const handleQuickEraserToggle = () => {
    if (currentTool === 'eraser') {
      setCurrentTool(prevToolRef.current || 'pen');
    } else {
      prevToolRef.current = currentTool;
      setCurrentTool('eraser');
    }
  };

  // Zoom handlers
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

  // Color selection
  const currentPalette =
    currentTool === 'highlighter'
      ? HIGHLIGHTER_COLORS
      : currentTool === 'sticky'
      ? STICKY_COLORS
      : INK_COLORS;

  const activeColor =
    currentTool === 'highlighter'
      ? highlighterColor
      : currentTool === 'sticky'
      ? stickyColor
      : color;

  const handleColorSelect = (hex: string) => {
    if (currentTool === 'highlighter') {
      setHighlighterColor(hex);
    } else if (currentTool === 'sticky') {
      setStickyColor(hex);
    } else {
      setColor(hex);
    }
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

  return (
    <header
      ref={containerRef}
      role="banner"
      aria-label="Thanh công cụ bảng trắng tinh gọn"
      className="pointer-events-none absolute top-2.5 sm:top-3.5 inset-x-0 z-30 flex flex-col items-center px-2 sm:px-4"
    >
      {/* 1. PERSISTENT FLOATING CAPSULE BAR (CHẾ ĐỘ THU GỌN SIÊU TINH GỌN) */}
      <div
        data-testid="unified-capsule-bar"
        className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 md:gap-2 bg-white/94 dark:bg-slate-900/94 backdrop-blur-xl px-2 sm:px-3 py-1.5 rounded-full shadow-lg shadow-slate-900/8 dark:shadow-black/40 border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-100 transition-all duration-200 max-w-[calc(100vw-16px)] overflow-x-auto scrollbar-none"
      >
        {/* Trang chủ */}
        <button
          type="button"
          onClick={onHomeClick}
          title="Về trang chủ xem tất cả bảng đã lưu"
          aria-label="Về trang chủ"
          className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white shrink-0 transition-colors cursor-pointer"
        >
          <Home className="w-4 h-4" />
        </button>

        {/* Tiêu đề sổ ghi chép / bảng trắng */}
        <input
          type="text"
          aria-label={boardType === 'notebook' ? 'Tên sổ ghi chép' : 'Tên bảng trắng'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="font-semibold text-xs sm:text-sm bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 px-2 py-1 rounded-lg outline-none transition-colors w-28 sm:w-36 md:w-44 max-w-[280px] truncate text-slate-800 dark:text-slate-100"
          placeholder={boardType === 'notebook' ? 'Tên sổ ghi chép...' : 'Tên bảng...'}
        />

        <div className="h-4 sm:h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

        {/* Công cụ đang chọn (Bấm để mở rộng / thu gọn) */}
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          title={`Công cụ hiện tại: ${activeToolDef.label} (${activeToolDef.shortcut}) — Bấm để mở rộng khay công cụ`}
          aria-label={`Công cụ hiện tại: ${activeToolDef.label}`}
          aria-expanded={isExpanded}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all duration-150 shrink-0 cursor-pointer ${
            isExpanded
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
          }`}
        >
          <ActiveToolIcon className="w-4 h-4" />
          <span className="hidden sm:inline font-semibold text-xs">{activeToolDef.label}</span>
          {inkDotColor && (
            <span
              className="w-2.5 h-2.5 rounded-full ring-1 ring-white/80 shrink-0"
              style={{ backgroundColor: inkDotColor }}
            />
          )}
          {currentTool === 'pen' && (
            <span className="hidden lg:inline text-[10px] font-mono opacity-80">{strokeWidth}px</span>
          )}
        </button>

        {/* Phím tắt nhanh chuyển đổi Tẩy / Bút vẽ */}
        <button
          type="button"
          onClick={handleQuickEraserToggle}
          title={
            currentTool === 'eraser'
              ? 'Đang dùng Tẩy — Bấm để quay lại Bút vẽ (E)'
              : 'Chuyển nhanh sang Tẩy (E)'
          }
          aria-label="Tẩy xóa nhanh"
          className={`p-1.5 sm:p-2 rounded-full transition-colors shrink-0 ${
            currentTool === 'eraser'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <Eraser className="w-4 h-4" />
        </button>

        <div className="h-4 sm:h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

        {/* Hoàn tác & Làm lại */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Hoàn tác (Ctrl+Z)"
            aria-label="Hoàn tác"
            className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-700 dark:text-slate-200"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Làm lại (Ctrl+Shift+Z)"
            aria-label="Làm lại"
            className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-700 dark:text-slate-200"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 sm:h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

        {/* Thu phóng tỷ lệ */}
        <button
          type="button"
          onClick={handleResetZoom}
          title="Đặt lại tỷ lệ 100% (Ctrl 0)"
          aria-label={`Tỷ lệ thu phóng ${zoomPercent}%, bấm để đặt lại 100%`}
          className="px-1.5 sm:px-2 py-1 text-xs font-semibold font-mono tabular-nums hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-700 dark:text-slate-200 shrink-0 text-center"
        >
          {zoomPercent}%
        </button>

        {/* Nút Mở rộng / Thu gọn chính */}
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          title={isExpanded ? 'Thu gọn thanh công cụ' : 'Mở rộng toàn bộ công cụ & cài đặt'}
          aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 shrink-0 cursor-pointer ${
            isExpanded
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20'
          }`}
        >
          <span>{isExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* 2. EXPANDED FLYOUT HUB (CHẾ ĐỘ MỞ RỘNG KHI CẦN DÙNG) */}
      {isExpanded && (
        <section
          aria-label="Khay công cụ mở rộng"
          className="pointer-events-auto mt-2.5 w-full max-w-4xl bg-white/96 dark:bg-slate-900/96 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-slate-900/15 dark:shadow-black/55 rounded-3xl p-3 sm:p-4 flex flex-col gap-3 text-slate-800 dark:text-slate-100 transition-all duration-200 animate-in fade-in slide-in-from-top-2 overflow-x-auto scrollbar-none"
        >
          {/* HÀNG 1: BỘ CÔNG CỤ VẼ & GHI CHÚ */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                1. Công cụ vẽ & ghi chú
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPinned((v) => !v)}
                  title={
                    isPinned
                      ? 'Đang ghim mở cố định — Bấm để cho phép tự động thu gọn khi viết'
                      : 'Ghim khay công cụ luôn mở'
                  }
                  aria-pressed={isPinned}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium transition-colors ${
                    isPinned
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-300 dark:ring-indigo-700'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {isPinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
                  <span className="text-[11px]">{isPinned ? 'Đã ghim mở' : 'Tự thu gọn'}</span>
                </button>
              </div>
            </div>

            {/* Các nhóm công cụ */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {/* Nhóm 0: Chọn & Kéo bảng */}
              <div className="flex items-center gap-0.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                {TOOLS.filter((t) => t.group === 0).map((tool) => {
                  const Icon = tool.icon;
                  const isActive = currentTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handleSelectTool(tool.id)}
                      title={`${tool.label} (${tool.shortcut})`}
                      aria-label={`${tool.label} (${tool.shortcut})`}
                      aria-pressed={isActive}
                      className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                          : 'hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>

              {/* Nhóm 1: Bút vẽ, Dạ quang, Tẩy, Laser */}
              <div className="flex items-center gap-0.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                {TOOLS.filter((t) => t.group === 1).map((tool) => {
                  const Icon = tool.icon;
                  const isActive = currentTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handleSelectTool(tool.id)}
                      title={`${tool.label} (${tool.shortcut})`}
                      aria-label={`${tool.label} (${tool.shortcut})`}
                      aria-pressed={isActive}
                      className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                          : 'hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tool.id === 'pen' && inkDotColor && (
                        <span
                          className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full ring-1 ring-white"
                          style={{ backgroundColor: inkDotColor }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Nhóm 2: Hình khối (Chữ nhật, Tròn, Mũi tên) */}
              <div className="flex items-center gap-0.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                {TOOLS.filter((t) => t.group === 2).map((tool) => {
                  const Icon = tool.icon;
                  const isActive = currentTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handleSelectTool(tool.id)}
                      title={`${tool.label} (${tool.shortcut})`}
                      aria-label={`${tool.label} (${tool.shortcut})`}
                      aria-pressed={isActive}
                      className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                          : 'hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>

              {/* Nhóm 3: Văn bản, Ghi chú, Ảnh/PDF */}
              <div className="flex items-center gap-0.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                {TOOLS.filter((t) => t.group === 3).map((tool) => {
                  const Icon = tool.icon;
                  const isActive = currentTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handleSelectTool(tool.id)}
                      title={`${tool.label} (${tool.shortcut})`}
                      aria-label={`${tool.label} (${tool.shortcut})`}
                      aria-pressed={isActive}
                      className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                          : 'hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* HÀNG 2: THUỘC TÍNH NÉT VẼ, BẢNG MÀU & CHẾ ĐỘ TẨY */}
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                2. Bảng màu & thuộc tính nét
              </span>
              {currentTool === 'eraser' && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setEraserMode('stroke')}
                    className={`px-2 py-0.5 rounded-md text-xs font-semibold transition-colors ${
                      eraserMode === 'stroke'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Xóa nét
                  </button>
                  <button
                    type="button"
                    onClick={() => setEraserMode('area')}
                    className={`px-2 py-0.5 rounded-md text-xs font-semibold transition-colors ${
                      eraserMode === 'area'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Xóa vùng
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Chọn màu sắc (nếu không phải tẩy hoặc laser) */}
              {currentTool !== 'eraser' && currentTool !== 'laser' ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {currentPalette.map((item) => {
                    const isSelected = activeColor.toLowerCase() === item.hex.toLowerCase();
                    return (
                      <button
                        key={item.hex}
                        type="button"
                        onClick={() => handleColorSelect(item.hex)}
                        title={item.label}
                        aria-label={`Màu ${item.label}`}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-transform cursor-pointer ${
                          isSelected
                            ? 'scale-110 ring-2 ring-indigo-600 dark:ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: item.hex }}
                      />
                    );
                  })}
                  {/* Custom color input */}
                  <input
                    ref={customColorInputRef}
                    type="color"
                    value={activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : '#4f46e5'}
                    onChange={(e) => handleColorSelect(e.target.value)}
                    className="sr-only"
                    aria-label="Chọn màu tùy chỉnh"
                  />
                  <button
                    type="button"
                    onClick={() => customColorInputRef.current?.click()}
                    title="Màu tùy chỉnh"
                    aria-label="Chọn màu tùy chỉnh"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Pipette className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : currentTool === 'eraser' ? (
                /* Eraser size picker */
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cỡ đầu tẩy:</span>
                  <div className="flex items-center gap-1">
                    {ERASER_SIZES.map((sz) => {
                      const isActive = eraserSize === sz.value;
                      return (
                        <button
                          key={sz.value}
                          type="button"
                          onClick={() => setEraserSize(sz.value)}
                          title={`Cỡ tẩy: ${sz.label} (${sz.value}px)`}
                          aria-label={`Cỡ tẩy ${sz.label}`}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-colors ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <span
                            className="rounded-[2px] border-[1.5px] border-current block"
                            style={{ width: sz.dot, height: sz.dot }}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="range"
                    min={MIN_ERASER_SIZE}
                    max={MAX_ERASER_SIZE}
                    step={2}
                    value={eraserSize}
                    onChange={(e) => setEraserSize(clampEraserSize(Number(e.target.value)))}
                    className="w-20 accent-indigo-600 cursor-pointer"
                    aria-label="Thanh trượt kích cỡ đầu tẩy"
                  />
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {eraserSize}px
                  </span>
                </div>
              ) : (
                <div className="text-xs text-slate-500">Bút tia Laser chỉ dùng để thuyết trình và chỉ điểm</div>
              )}

              {/* Chọn kích thước nét vẽ (Pen, Highlighter, Shapes) */}
              {currentTool !== 'eraser' && currentTool !== 'laser' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cỡ nét:</span>
                  <div className="flex items-center gap-1">
                    {STROKE_WIDTHS.map((sw) => {
                      const isActive = strokeWidth === sw.value;
                      return (
                        <button
                          key={sw.value}
                          type="button"
                          onClick={() => setStrokeWidth(sw.value)}
                          title={`Cỡ nét ${sw.label} (${sw.value}px)`}
                          aria-label={`Cỡ nét ${sw.label}`}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-colors ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <span
                            className="rounded-full bg-current block"
                            style={{ width: sw.dot, height: sw.dot }}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="range"
                    min={MIN_STROKE_WIDTH}
                    max={MAX_STROKE_WIDTH}
                    step={1}
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(clampStrokeWidth(Number(e.target.value)))}
                    className="w-16 accent-indigo-600 cursor-pointer hidden sm:block"
                    aria-label="Thanh trượt cỡ nét"
                  />
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {strokeWidth}px
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* HÀNG 3: TIỆN ÍCH BẢNG & CÀI ĐẶT */}
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                3. Tiện ích bảng & thiết lập
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Cụm Nền bảng & Giao diện sáng tối */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* Pattern / Notebook Paper Style Menu */}
                {boardType === 'notebook' ? (
                  <>
                    <div className="relative" ref={patternMenuRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPaperSizeMenu(false);
                          setShowPatternMenu((v) => !v);
                        }}
                        aria-label="Chọn loại giấy viết"
                        aria-expanded={showPatternMenu}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Grid className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>
                          Giấy:{' '}
                          {NOTEBOOK_PAPER_STYLES.find(
                            (s) => s.id === normalizeNotebookPaperStyle(boardPattern)
                          )?.shortLabel || 'Kẻ ngang'}
                        </span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </button>

                      {showPatternMenu && (
                        <div className="absolute left-0 bottom-full mb-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 z-40">
                          <div className="text-[11px] font-medium px-2.5 py-1 text-slate-500 dark:text-slate-400">
                            Loại giấy viết
                          </div>
                          {NOTEBOOK_PAPER_STYLES.map((style) => {
                            const isSelected = normalizeNotebookPaperStyle(boardPattern) === style.id;
                            return (
                              <button
                                key={style.id}
                                type="button"
                                onClick={() => {
                                  setBoardPattern(style.id);
                                  setShowPatternMenu(false);
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs rounded-lg transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <div>
                                  <div>{style.label}</div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                    {style.description}
                                  </div>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="relative" ref={paperSizeMenuRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPatternMenu(false);
                          setShowPaperSizeMenu((v) => !v);
                        }}
                        aria-label="Chọn khổ giấy vở ghi chú"
                        aria-expanded={showPaperSizeMenu}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>{getNotebookConfig(notebookPaperSize).label}</span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </button>

                      {showPaperSizeMenu && (
                        <div className="absolute left-0 bottom-full mb-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 z-40">
                          <div className="text-[11px] font-medium px-2.5 py-1 text-slate-500 dark:text-slate-400">
                            Khổ giấy vở ghi chú
                          </div>
                          {(
                            [
                              { id: 'a4', label: 'Khổ A4', desc: '210 × 297 mm' },
                              { id: 'a3', label: 'Khổ A3', desc: '297 × 420 mm' },
                              { id: 'b5', label: 'Khổ B5', desc: '176 × 250 mm' },
                              { id: 'letter', label: 'Khổ Letter', desc: '216 × 279 mm' },
                            ] as { id: NotebookPaperSize; label: string; desc: string }[]
                          ).map((paper) => {
                            const isSelected = notebookPaperSize === paper.id;
                            return (
                              <button
                                key={paper.id}
                                type="button"
                                onClick={() => {
                                  setNotebookPaperSize(paper.id);
                                  setShowPaperSizeMenu(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs rounded-lg transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <div>
                                  <div>{paper.label}</div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                    {paper.desc}
                                  </div>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="relative" ref={patternMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowPatternMenu((v) => !v)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-medium transition-colors"
                    >
                      <Grid className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Nền: {PATTERNS.find((p) => p.id === boardPattern)?.label || 'Ô ly'}</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {showPatternMenu && (
                      <div className="absolute left-0 bottom-full mb-2 w-44 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 z-40">
                        {PATTERNS.map((pat) => (
                          <button
                            key={pat.id}
                            type="button"
                            onClick={() => {
                              setBoardPattern(pat.id);
                              setShowPatternMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                              boardPattern === pat.id
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span>{pat.label}</span>
                            {boardPattern === pat.id && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sáng / Tối */}
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  title={theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
                  aria-label="Giao diện sáng tối"
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
                </button>

                {/* Thu phóng +/- */}
                <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    title="Thu nhỏ (Ctrl -)"
                    aria-label="Thu nhỏ"
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 dark:text-slate-200"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    title="Phóng to (Ctrl +)"
                    aria-label="Phóng to"
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 dark:text-slate-200"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleFitToScreen}
                    title="Vừa màn hình"
                    aria-label="Vừa màn hình"
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 dark:text-slate-200"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Cụm Tiện ích Hành động */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* Bảng Toán học */}
                {boardType === 'math' && onToggleMathPanel && (
                  <button
                    type="button"
                    onClick={onToggleMathPanel}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium text-xs transition-colors ${
                      isMathPanelOpen
                        ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Sigma className="w-3.5 h-3.5" />
                    <span>Bảng toán</span>
                  </button>
                )}

                {/* Google Drive */}
                <button
                  type="button"
                  onClick={onDriveClick}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors"
                >
                  {isDriveConnected && syncStatus === 'saving' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  ) : isDriveConnected && syncStatus === 'saved' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span>
                    {!isDriveConnected
                      ? 'Lưu Drive'
                      : syncStatus === 'saving'
                      ? 'Đang lưu...'
                      : syncStatus === 'saved'
                      ? 'Đã lưu'
                      : 'Drive'}
                  </span>
                </button>

                {/* Xuất bảng */}
                <button
                  type="button"
                  onClick={onExportClick}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất file</span>
                </button>

                {/* Trình chiếu */}
                <button
                  type="button"
                  onClick={onPresentClick}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 text-xs font-medium transition-colors"
                >
                  <Presentation className="w-3.5 h-3.5" />
                  <span>Trình chiếu</span>
                </button>

                {/* Chế độ tập trung */}
                <button
                  type="button"
                  onClick={onToggleFocusMode}
                  title="Chế độ tập trung (F)"
                  aria-label="Chế độ tập trung (F)"
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <Focus className="w-3.5 h-3.5" />
                </button>

                {/* Xóa bảng (Confirm popover) */}
                {elementCount > 0 && (
                  <div className="relative" ref={clearPopoverRef}>
                    <button
                      type="button"
                      onClick={() => setConfirmClear((v) => !v)}
                      title="Xóa toàn bộ bảng"
                      aria-label="Xóa toàn bộ bảng"
                      className="p-1.5 sm:p-2 rounded-xl bg-red-50 dark:bg-red-950/50 hover:bg-red-100 text-red-600 dark:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {confirmClear && (
                      <div className="absolute right-0 bottom-full mb-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-40">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1">
                          Xóa toàn bộ bảng trắng?
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                          Bạn vẫn có thể nhấn Hoàn tác (Ctrl+Z) sau khi xóa.
                        </p>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmClear(false)}
                            className="px-2.5 py-1 text-xs rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              clearBoard();
                              setConfirmClear(false);
                            }}
                            className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
                          >
                            Xóa tất cả
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </header>
  );
};
