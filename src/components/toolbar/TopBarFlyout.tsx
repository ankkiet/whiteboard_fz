import React, { useEffect, useRef, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { DriveSyncStatus } from '../../services/driveSyncUtils';
import { BoardType, ToolType } from '../../types/board';
import {
  getNotebookConfig,
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
  ERASER_SIZES,
  HIGHLIGHTER_COLORS,
  INK_COLORS,
  NOTEBOOK_PAPER_OPTIONS,
  PATTERNS,
  STICKY_COLORS,
  STROKE_WIDTHS,
  TOOLS,
} from './toolbarConfig';
import {
  BookOpen,
  Check,
  ChevronDown,
  Cloud,
  Download,
  Focus,
  Grid,
  Loader2,
  Maximize2,
  Moon,
  Pin,
  PinOff,
  Pipette,
  Presentation,
  Sigma,
  Sun,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface TopBarFlyoutProps {
  boardType: BoardType;
  isPinned: boolean;
  onTogglePin: () => void;
  inkDotColor: string | null;
  flyoutMarginStyle?: React.CSSProperties;
  isDriveConnected: boolean;
  syncStatus: DriveSyncStatus;
  isMathPanelOpen: boolean;
  onSelectTool: (tool: ToolType) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onExportClick: () => void;
  onDriveClick: () => void;
  onPresentClick: () => void;
  onToggleFocusMode: () => void;
  onToggleMathPanel?: () => void;
}

export const TopBarFlyout: React.FC<TopBarFlyoutProps> = ({
  boardType,
  isPinned,
  onTogglePin,
  inkDotColor,
  flyoutMarginStyle,
  isDriveConnected,
  syncStatus,
  isMathPanelOpen,
  onSelectTool,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onExportClick,
  onDriveClick,
  onPresentClick,
  onToggleFocusMode,
  onToggleMathPanel,
}) => {
  const clearBoard = useBoardStore((s) => s.clearBoard);
  const elementCount = useBoardStore((s) => s.elements.length);
  const currentTool = useBoardStore((s) => s.currentTool);
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
  const theme = useBoardStore((s) => s.theme);
  const setTheme = useBoardStore((s) => s.setTheme);
  const boardPattern = useBoardStore((s) => s.boardPattern);
  const setBoardPattern = useBoardStore((s) => s.setBoardPattern);
  const notebookPaperSize = useBoardStore((s) => s.notebookPaperSize);
  const setNotebookPaperSize = useBoardStore((s) => s.setNotebookPaperSize);

  const [confirmClear, setConfirmClear] = useState(false);
  const [showPatternMenu, setShowPatternMenu] = useState(false);
  const [showPaperSizeMenu, setShowPaperSizeMenu] = useState(false);

  const clearPopoverRef = useRef<HTMLDivElement>(null);
  const patternMenuRef = useRef<HTMLDivElement>(null);
  const paperSizeMenuRef = useRef<HTMLDivElement>(null);
  const customColorInputRef = useRef<HTMLInputElement>(null);

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

  return (
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
              onClick={onTogglePin}
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
              {isPinned ? (
                <Pin className="w-3.5 h-3.5" strokeWidth={1.75} />
              ) : (
                <PinOff className="w-3.5 h-3.5" strokeWidth={1.75} />
              )}
              <span>{isPinned ? 'Đã ghim mở' : 'Tự thu gọn'}</span>
            </button>
          </div>
        </div>

        {/* Các nhóm công cụ */}
        <div className="flex items-center gap-2 flex-wrap">
          {[0, 1, 2, 3].map((groupId) => (
            <div
              key={groupId}
              className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60"
            >
              {TOOLS.filter((t) => t.group === groupId).map((tool) => {
                const Icon = tool.icon;
                const isActive = currentTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => onSelectTool(tool.id)}
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
          ))}
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
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Bút tia laser dùng để chỉ điểm khi trình chiếu
            </div>
          )}

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
                      {NOTEBOOK_PAPER_OPTIONS.map((paper) => {
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
              {theme === 'light' ? (
                <Moon className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <Sun className="w-4 h-4" strokeWidth={1.75} />
              )}
            </button>

            {/* Thu phóng +/- */}
            <div className="h-8 flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={onZoomOut}
                title="Thu nhỏ (Ctrl -)"
                aria-label="Thu nhỏ"
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors duration-150 cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={onZoomIn}
                title="Phóng to (Ctrl +)"
                aria-label="Phóng to"
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors duration-150 cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={onFitToScreen}
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

            <button
              type="button"
              onClick={onExportClick}
              className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors duration-150 cursor-pointer"
            >
              <Download className="w-4 h-4" strokeWidth={1.75} />
              <span>Xuất tệp</span>
            </button>

            <button
              type="button"
              onClick={onPresentClick}
              className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-medium transition-colors duration-150 cursor-pointer"
            >
              <Presentation className="w-4 h-4" strokeWidth={1.75} />
              <span>Trình chiếu</span>
            </button>

            <button
              type="button"
              onClick={onToggleFocusMode}
              title="Chế độ tập trung (F)"
              aria-label="Chế độ tập trung (F)"
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors duration-150 cursor-pointer"
            >
              <Focus className="w-4 h-4" strokeWidth={1.75} />
            </button>

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
  );
};
