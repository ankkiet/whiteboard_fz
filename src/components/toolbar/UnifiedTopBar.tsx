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
  { id: 'laser', label: 'Bút tia laser', shortcut: 'L', icon: Wand2, group: 1 },
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
  const isMathPanelCollapsed = useBoardStore((s) => s.isMathPanelCollapsed);
  const isCalculatorOpen = useBoardStore((s) => s.isCalculatorOpen);
  const isCalculatorMinimized = useBoardStore((s) => s.isCalculatorMinimized);

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

        {/* Công cụ đang chọn (Bấm để mở rộng / thu gọn) */}
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

      {/* 2. Expanded flyout hub (respects safe space between Casio and MathPanel) */}
      {isExpanded && (
        <section
          aria-label="Khay công cụ mở rộng"
          style={flyoutMarginStyle}
          className="pointer-events-auto mt-2 w-full max-w-[720px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-none rounded-2xl p-4 flex flex-col gap-3 text-slate-800 dark:text-slate-100 overflow-x-auto scrollbar-none"
        >
          {/* Hàng 1: Công cụ vẽ & ghi chú */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Công cụ vẽ & ghi chú
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPinned((v) => !v)}
                  title={
                    isPinned
                      ? 'Đang ghim mở cố định — Bấm để tự thu gọn khi viết'
                      : 'Ghim khay công cụ luôn mở'
                  }
                  aria-pressed={isPinned}
                  className={`h-7 flex items-center gap-1.5 px-2 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                    isPinned
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {isPinned ? <Pin className="w-3.5 h-3.5" strokeWidth={1.75} /> : <PinOff className="w-3.5 h-3.5" strokeWidth={1.75} />}
                  <span>{isPinned ? 'Đã ghim mở' : 'Tự thu gọn'}</span>
                </button>
              </div>
            </div>

            {/* Các nhóm công cụ */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Nhóm 0: Chọn & Kéo bảng */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
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
                      className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>

              {/* Nhóm 1: Bút vẽ, Dạ quang, Tẩy, Laser */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
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
                      className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tool.id === 'pen' && inkDotColor && (
                        <span
                          className="absolute bottom-1 right-1 w-2 h-2 rounded-full ring-1 ring-white"
                          style={{ backgroundColor: inkDotColor }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Nhóm 2: Hình khối (Chữ nhật, Tròn, Mũi tên) */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
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
                      className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>

              {/* Nhóm 3: Văn bản, Ghi chú, Ảnh/PDF */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
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
                      className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white'
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

          {/* Hàng 2: Màu sắc & nét vẽ */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Màu sắc & thuộc tính nét
              </span>
              {currentTool === 'eraser' && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setEraserMode('stroke')}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer ${
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
                    className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer ${
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
                        className={`w-7 h-7 rounded-full border border-black/10 dark:border-white/15 transition-shadow duration-150 cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-slate-900 dark:ring-slate-100 ring-offset-2 dark:ring-offset-slate-900'
                            : 'hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600 hover:ring-offset-1 dark:hover:ring-offset-slate-900'
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
                    className="w-7 h-7 rounded-full border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-500 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-150 cursor-pointer"
                  >
                    <Pipette className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              ) : currentTool === 'eraser' ? (
                /* Eraser size picker */
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cỡ đầu tẩy</span>
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
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
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
                <div className="text-xs text-slate-500 dark:text-slate-400">Bút tia laser dùng để chỉ điểm khi trình chiếu</div>
              )}

              {/* Chọn kích thước nét vẽ (Pen, Highlighter, Shapes) */}
              {currentTool !== 'eraser' && currentTool !== 'laser' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cỡ nét</span>
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
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
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

          {/* Hàng 3: Tiện ích bảng */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Tiện ích bảng
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Cụm nền bảng & giao diện sáng tối */}
              <div className="flex items-center gap-2 flex-wrap">
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
                        className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors duration-150 cursor-pointer"
                      >
                        <Grid className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                        <span>
                          Giấy:{' '}
                          {NOTEBOOK_PAPER_STYLES.find(
                            (s) => s.id === normalizeNotebookPaperStyle(boardPattern)
                          )?.shortLabel || 'Kẻ ngang'}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                      </button>

                      {showPatternMenu && (
                        <div className="absolute left-0 bottom-full mb-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-lg dark:shadow-none border border-slate-200 dark:border-slate-800 p-1.5 z-40">
                          <div className="text-xs font-medium px-2.5 py-1 text-slate-500 dark:text-slate-400">
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
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs rounded-lg transition-colors duration-150 cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <div>
                                  <div>{style.label}</div>
                                  <div className="text-xs text-slate-400 dark:text-slate-500 font-normal">
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
                        className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors duration-150 cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                        <span>{getNotebookConfig(notebookPaperSize).label}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                      </button>

                      {showPaperSizeMenu && (
                        <div className="absolute left-0 bottom-full mb-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-lg dark:shadow-none border border-slate-200 dark:border-slate-800 p-1.5 z-40">
                          <div className="text-xs font-medium px-2.5 py-1 text-slate-500 dark:text-slate-400">
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
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs rounded-lg transition-colors duration-150 cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <div>
                                  <div>{paper.label}</div>
                                  <div className="text-xs font-mono text-slate-400 dark:text-slate-500 font-normal">
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
                      className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors duration-150 cursor-pointer"
                    >
                      <Grid className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                      <span>Nền: {PATTERNS.find((p) => p.id === boardPattern)?.label || 'Ô ly'}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                    </button>

                    {showPatternMenu && (
                      <div className="absolute left-0 bottom-full mb-2 w-44 bg-white dark:bg-slate-900 rounded-xl shadow-lg dark:shadow-none border border-slate-200 dark:border-slate-800 p-1.5 z-40">
                        {PATTERNS.map((pat) => (
                          <button
                            key={pat.id}
                            type="button"
                            onClick={() => {
                              setBoardPattern(pat.id);
                              setShowPatternMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors duration-150 cursor-pointer ${
                              boardPattern === pat.id
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium'
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
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors duration-150 cursor-pointer"
                >
                  {theme === 'light' ? <Moon className="w-4 h-4" strokeWidth={1.75} /> : <Sun className="w-4 h-4" strokeWidth={1.75} />}
                </button>

                {/* Thu phóng +/- */}
                <div className="h-8 flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    title="Thu nhỏ (Ctrl -)"
                    aria-label="Thu nhỏ"
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors duration-150 cursor-pointer"
                  >
                    <ZoomOut className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    title="Phóng to (Ctrl +)"
                    aria-label="Phóng to"
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors duration-150 cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={handleFitToScreen}
                    title="Vừa màn hình"
                    aria-label="Vừa màn hình"
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors duration-150 cursor-pointer"
                  >
                    <Maximize2 className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              {/* Cụm tiện ích hành động */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Bảng toán học */}
                {boardType === 'math' && onToggleMathPanel && (
                  <button
                    type="button"
                    onClick={onToggleMathPanel}
                    className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg font-medium text-xs transition-colors duration-150 cursor-pointer ${
                      isMathPanelOpen
                        ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Sigma className="w-4 h-4" strokeWidth={1.75} />
                    <span>Bảng toán</span>
                  </button>
                )}

                {/* Google Drive */}
                <button
                  type="button"
                  onClick={onDriveClick}
                  className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors duration-150 cursor-pointer"
                >
                  {isDriveConnected && syncStatus === 'saving' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                  ) : isDriveConnected && syncStatus === 'saved' ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                  ) : (
                    <Cloud className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                  )}
                  <span>
                    {!isDriveConnected
                      ? 'Lưu Drive'
                      : syncStatus === 'saving'
                      ? 'Đang lưu'
                      : syncStatus === 'saved'
                      ? 'Đã lưu'
                      : 'Drive'}
                  </span>
                </button>

                {/* Xuất tệp */}
                <button
                  type="button"
                  onClick={onExportClick}
                  className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors duration-150 cursor-pointer"
                >
                  <Download className="w-4 h-4" strokeWidth={1.75} />
                  <span>Xuất tệp</span>
                </button>

                {/* Trình chiếu */}
                <button
                  type="button"
                  onClick={onPresentClick}
                  className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-medium transition-colors duration-150 cursor-pointer"
                >
                  <Presentation className="w-4 h-4" strokeWidth={1.75} />
                  <span>Trình chiếu</span>
                </button>

                {/* Chế độ tập trung */}
                <button
                  type="button"
                  onClick={onToggleFocusMode}
                  title="Chế độ tập trung (F)"
                  aria-label="Chế độ tập trung (F)"
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors duration-150 cursor-pointer"
                >
                  <Focus className="w-4 h-4" strokeWidth={1.75} />
                </button>

                {/* Xóa bảng (Confirm popover) */}
                {elementCount > 0 && (
                  <div className="relative" ref={clearPopoverRef}>
                    <button
                      type="button"
                      onClick={() => setConfirmClear((v) => !v)}
                      title="Xóa toàn bộ bảng"
                      aria-label="Xóa toàn bộ bảng"
                      className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors duration-150 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    </button>

                    {confirmClear && (
                      <div className="absolute right-0 bottom-full mb-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-lg dark:shadow-none border border-slate-200 dark:border-slate-800 p-3 z-40">
                        <p className="text-xs font-medium text-slate-900 dark:text-slate-100 mb-1">
                          Xóa toàn bộ bảng trắng?
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          Bạn vẫn có thể nhấn Hoàn tác (Ctrl+Z) sau khi xóa.
                        </p>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmClear(false)}
                            className="h-8 px-3 text-xs rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              clearBoard();
                              setConfirmClear(false);
                            }}
                            className="h-8 px-3 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer"
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
