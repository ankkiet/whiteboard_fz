import React from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  Trash2,
  Copy,
  Lock,
  Unlock,
  ArrowUpToLine,
  ArrowDownToLine,
  PaintBucket,
  Eye,
  EyeOff,
  Eraser,
  SquareDashed,
  Pipette,
  Group,
  Ungroup,
} from 'lucide-react';
import { BoardElement, ShapeElement } from '../../types/board';
import { getSelectedGroupSummary } from '../../engine/groupUtils';
import {
  clampEraserSize,
  clampStrokeWidth,
  MAX_ERASER_SIZE,
  MAX_STROKE_WIDTH,
  MIN_ERASER_SIZE,
  MIN_STROKE_WIDTH,
} from '../../engine/drawingUtils';

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

const FONT_SIZES = [
  { value: 14, label: 'S' },
  { value: 18, label: 'M' },
  { value: 24, label: 'L' },
  { value: 32, label: 'XL' },
];

const ERASER_SIZES = [
  { value: 14, label: 'Nhỏ', dot: 6 },
  { value: 24, label: 'Vừa', dot: 10 },
  { value: 40, label: 'Lớn', dot: 14 },
  { value: 64, label: 'Rất lớn', dot: 18 },
];

export const ContextualToolbar: React.FC = () => {
  const color = useBoardStore((s) => s.color);
  const setColor = useBoardStore((s) => s.setColor);
  const highlighterColor = useBoardStore((s) => s.highlighterColor);
  const setHighlighterColor = useBoardStore((s) => s.setHighlighterColor);
  const fillColor = useBoardStore((s) => s.fillColor);
  const setFillColor = useBoardStore((s) => s.setFillColor);
  const strokeWidth = useBoardStore((s) => s.strokeWidth);
  const setStrokeWidth = useBoardStore((s) => s.setStrokeWidth);
  const fontSize = useBoardStore((s) => s.fontSize);
  const setFontSize = useBoardStore((s) => s.setFontSize);
  const stickyColor = useBoardStore((s) => s.stickyColor);
  const setStickyColor = useBoardStore((s) => s.setStickyColor);
  const eraserMode = useBoardStore((s) => s.eraserMode);
  const setEraserMode = useBoardStore((s) => s.setEraserMode);
  const eraserSize = useBoardStore((s) => s.eraserSize);
  const setEraserSize = useBoardStore((s) => s.setEraserSize);
  const currentTool = useBoardStore((s) => s.currentTool);
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const editingGroupId = useBoardStore((s) => s.editingGroupId);
  const elements = useBoardStore((s) => s.elements);
  const isDarkMode = useBoardStore((s) => s.isDarkMode);

  const updateSelectedElements = useBoardStore((s) => s.updateSelectedElements);
  const deleteSelected = useBoardStore((s) => s.deleteSelected);
  const duplicateSelected = useBoardStore((s) => s.duplicateSelected);
  const groupSelected = useBoardStore((s) => s.groupSelected);
  const ungroupSelected = useBoardStore((s) => s.ungroupSelected);
  const bringSelectedForward = useBoardStore((s) => s.bringSelectedForward);
  const sendSelectedBackward = useBoardStore((s) => s.sendSelectedBackward);
  const toggleLockSelected = useBoardStore((s) => s.toggleLockSelected);
  const setPreviewFileCardId = useBoardStore((s) => s.setPreviewFileCardId);

  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));
  const hasSelection = selectedElements.length > 0;
  const primarySelected = hasSelection ? selectedElements[0] : null;
  const allLocked = hasSelection && selectedElements.every((el) => el.isLocked);
  const groupSummary = getSelectedGroupSummary(elements, selectedIds, editingGroupId);

  const isStrokeTool = currentTool === 'pen' || currentTool === 'highlighter';
  const isShapeTool =
    currentTool === 'rectangle' || currentTool === 'ellipse' || currentTool === 'arrow';
  const isTextTool = currentTool === 'text';
  const isStickyTool = currentTool === 'sticky';
  const isEraserTool = currentTool === 'eraser';

  if (
    !isStrokeTool &&
    !isShapeTool &&
    !isTextTool &&
    !isStickyTool &&
    !isEraserTool &&
    !hasSelection
  ) {
    return null;
  }

  const colorableElements = selectedElements.filter(
    (el): el is Extract<BoardElement, { color: string }> => 'color' in el
  );
  const strokeableElements = selectedElements.filter(
    (el): el is Extract<BoardElement, { strokeWidth: number }> => 'strokeWidth' in el
  );
  const fillableElements = selectedElements.filter(
    (el): el is ShapeElement =>
      el.type === 'rectangle' || el.type === 'ellipse'
  );
  const fontSizedElements = selectedElements.filter(
    (el): el is Extract<BoardElement, { fontSize: number }> =>
      el.type === 'text' || el.type === 'sticky' || el.type === 'formula'
  );

  const showEraserControls = isEraserTool && !hasSelection;
  const showStickyPalette =
    (hasSelection &&
      colorableElements.length > 0 &&
      colorableElements.every((el) => el.type === 'sticky')) ||
    (!hasSelection && isStickyTool);
  const showHighlighterPalette =
    (hasSelection &&
      colorableElements.length > 0 &&
      colorableElements.every((el) => el.type === 'highlighter')) ||
    (!hasSelection && currentTool === 'highlighter');
  const showColorPalette =
    !showEraserControls && (!hasSelection || colorableElements.length > 0);
  const isSingleFileCard =
    selectedElements.length === 1 && primarySelected?.type === 'file-card';
  const isSingleReveal =
    selectedElements.length === 1 && primarySelected?.type === 'reveal';

  const palette = showStickyPalette
    ? STICKY_COLORS
    : showHighlighterPalette
    ? HIGHLIGHTER_COLORS
    : INK_COLORS;

  const showStrokeWidths =
    (!hasSelection && (isStrokeTool || isShapeTool)) ||
    (hasSelection && strokeableElements.length > 0);

  const showFillToggle =
    (!hasSelection && (currentTool === 'rectangle' || currentTool === 'ellipse')) ||
    (hasSelection && fillableElements.length > 0);

  const showFontSizes =
    (!hasSelection && (isTextTool || isStickyTool)) ||
    (hasSelection && fontSizedElements.length > 0);

  const activeColor =
    hasSelection && colorableElements[0]
      ? colorableElements[0].color
      : isStickyTool
      ? stickyColor
      : currentTool === 'highlighter'
      ? highlighterColor
      : color;

  const activeStrokeWidth =
    hasSelection && strokeableElements[0]
      ? strokeableElements[0].strokeWidth
      : strokeWidth;

  const activeFontSize =
    hasSelection && fontSizedElements[0]
      ? fontSizedElements[0].fontSize
      : fontSize;

  const activeFill =
    hasSelection && fillableElements[0]
      ? fillableElements[0].fillColor || 'transparent'
      : fillColor;

  const handleColorPick = (hex: string) => {
    if (hasSelection) {
      updateSelectedElements((el: BoardElement) => {
        if ('color' in el) {
          const nextEl = { ...el, color: hex } as BoardElement;
          if (
            (nextEl.type === 'rectangle' || nextEl.type === 'ellipse') &&
            nextEl.fillColor &&
            nextEl.fillColor !== 'transparent'
          ) {
            nextEl.fillColor = `${hex}22`;
          }
          return nextEl;
        }
        return el;
      }, true);
    } else if (isStickyTool) {
      setStickyColor(hex);
    } else if (currentTool === 'highlighter') {
      setHighlighterColor(hex);
    } else {
      setColor(hex);
      if (fillColor !== 'transparent') {
        setFillColor(`${hex}22`);
      }
    }
  };

  const handleStrokePick = (w: number) => {
    if (hasSelection) {
      updateSelectedElements((el) => ('strokeWidth' in el ? ({ ...el, strokeWidth: w } as BoardElement) : el), true);
    } else {
      setStrokeWidth(w);
    }
  };

  const handleFontSizePick = (size: number) => {
    if (hasSelection) {
      updateSelectedElements((el) => ('fontSize' in el ? ({ ...el, fontSize: size } as BoardElement) : el), true);
    } else {
      setFontSize(size);
    }
  };

  const handleToggleFill = () => {
    const nextFill = activeFill === 'transparent' ? `${activeColor}22` : 'transparent';
    if (hasSelection) {
      updateSelectedElements(
        (el) =>
          el.type === 'rectangle' || el.type === 'ellipse'
            ? { ...el, fillColor: nextFill }
            : el,
        true
      );
    } else {
      setFillColor(nextFill);
    }
  };

  const isPresetColor = palette.some(
    (item) => item.hex.toLowerCase() === activeColor.toLowerCase()
  );
  const resolvedActiveInk =
    isDarkMode && activeColor.toLowerCase() === '#1e293b' ? '#f1f5f9' : activeColor;
  const liveNibPreviewSize = Math.min(Math.max(activeStrokeWidth * 1.15, 4), 18);

  return (
    <div
      role="toolbar"
      aria-label="Thanh thuộc tính ngữ cảnh"
      data-testid="contextual-toolbar"
      className="absolute bottom-[74px] sm:bottom-[76px] left-1/2 -translate-x-1/2 z-20 max-w-[calc(100vw-20px)] flex items-center gap-2.5 sm:gap-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-3.5 py-2 rounded-2xl shadow-lg shadow-slate-900/8 dark:shadow-black/40 border border-slate-200/85 dark:border-slate-800 text-slate-800 dark:text-slate-100 overflow-x-auto"
    >
      {showEraserControls && (
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90">
            <button
              type="button"
              onClick={() => setEraserMode('stroke')}
              aria-pressed={eraserMode === 'stroke'}
              title="Quẹt qua để xóa trọn cả nét vẽ hoặc đối tượng"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                eraserMode === 'stroke'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Xóa nét</span>
            </button>
            <button
              type="button"
              onClick={() => setEraserMode('area')}
              aria-pressed={eraserMode === 'area'}
              title="Tẩy hình vuông theo vùng bôi — lắc càng mạnh đầu tẩy càng to"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                eraserMode === 'area'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <SquareDashed className="w-3.5 h-3.5" />
              <span>Xóa vùng bôi</span>
            </button>
          </div>

          {eraserMode === 'area' && (
            <>
              <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Kích cỡ đầu tẩy">
                {ERASER_SIZES.map((sz) => {
                  const active = eraserSize === sz.value;
                  return (
                    <button
                      type="button"
                      key={sz.value}
                      onClick={() => setEraserSize(sz.value)}
                      title={`Cỡ tẩy cơ bản: ${sz.label} (${sz.value}px · lắc mạnh để phóng to)`}
                      aria-label={`Cỡ tẩy ${sz.label}`}
                      aria-pressed={active}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span
                        className="rounded-[3px] border-[1.75px] border-current block"
                        style={{ width: sz.dot, height: sz.dot }}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="hidden sm:flex items-center gap-2 pl-1 shrink-0">
                <input
                  type="range"
                  min={MIN_ERASER_SIZE}
                  max={MAX_ERASER_SIZE}
                  step={2}
                  value={eraserSize}
                  onChange={(e) => setEraserSize(clampEraserSize(Number(e.target.value)))}
                  aria-label="Thanh trượt kích cỡ đầu tẩy"
                  className="w-20 h-1.5 accent-indigo-600 cursor-pointer"
                />
                <span className="text-[11px] font-mono font-medium tabular-nums text-slate-500 dark:text-slate-400 w-9 text-right whitespace-nowrap shrink-0">
                  {eraserSize}px
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {showColorPalette && (
        <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label="Bảng màu">
          {palette.map((item) => {
            const swatchBg =
              isDarkMode && item.hex === '#1e293b' ? '#f1f5f9' : item.hex;
            const isSelected = activeColor.toLowerCase() === item.hex.toLowerCase();
            return (
              <button
                type="button"
                key={item.hex}
                onClick={() => handleColorPick(item.hex)}
                title={item.label}
                aria-label={`Màu ${item.label}`}
                aria-pressed={isSelected}
                style={{ backgroundColor: swatchBg }}
                className={`w-6 h-6 rounded-full border border-slate-300/90 dark:border-slate-600 transition-transform shrink-0 ${
                  isSelected
                    ? 'scale-115 ring-2 ring-indigo-600 ring-offset-2 dark:ring-offset-slate-900'
                    : 'hover:scale-110'
                }`}
              />
            );
          })}

          {/* Custom Color Picker */}
          <label
            title="Chọn màu tùy chỉnh"
            className={`relative w-6 h-6 rounded-full flex items-center justify-center cursor-pointer border border-slate-300 dark:border-slate-600 transition-transform shrink-0 ${
              !isPresetColor
                ? 'scale-115 ring-2 ring-indigo-600 ring-offset-2 dark:ring-offset-slate-900'
                : 'hover:scale-110 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
            style={!isPresetColor ? { backgroundColor: resolvedActiveInk } : undefined}
          >
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(activeColor) ? activeColor : '#4f46e5'}
              onChange={(e) => handleColorPick(e.target.value)}
              aria-label="Chọn màu tùy chỉnh"
              className="sr-only"
            />
            {isPresetColor && <Pipette className="w-3 h-3" aria-hidden="true" />}
          </label>
        </div>
      )}

      {showStrokeWidths && (
        <>
          {showColorPalette && <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />}
          <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Độ dày nét nhanh">
            {STROKE_WIDTHS.map((w) => {
              const isSelected = activeStrokeWidth === w.value;
              return (
                <button
                  type="button"
                  key={w.value}
                  onClick={() => handleStrokePick(w.value)}
                  title={`Độ dày nét: ${w.label} (${w.value}px)`}
                  aria-label={`Độ dày nét ${w.label}`}
                  aria-pressed={isSelected}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span
                    className="rounded-full bg-current block"
                    style={{ width: w.dot, height: w.dot }}
                  />
                </button>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-2 pl-1 shrink-0">
            <span
              aria-hidden="true"
              className="w-5 h-5 flex items-center justify-center shrink-0"
              title={`Xem trước đầu bút ${activeStrokeWidth}px`}
            >
              <span
                className="rounded-full block transition-all duration-150"
                style={{
                  width: liveNibPreviewSize,
                  height: liveNibPreviewSize,
                  backgroundColor: resolvedActiveInk,
                  opacity: showHighlighterPalette ? 0.65 : 1,
                }}
              />
            </span>
            <input
              type="range"
              min={MIN_STROKE_WIDTH}
              max={MAX_STROKE_WIDTH}
              step={1}
              value={activeStrokeWidth}
              onChange={(e) => handleStrokePick(clampStrokeWidth(Number(e.target.value)))}
              aria-label="Thanh trượt độ dày nét"
              className="w-20 h-1.5 accent-indigo-600 cursor-pointer"
            />
            <span
              data-testid="stroke-width-readout"
              className="text-[11px] font-mono font-medium tabular-nums text-slate-500 dark:text-slate-400 w-8 text-right whitespace-nowrap shrink-0"
            >
              {activeStrokeWidth}px
            </span>
          </div>
        </>
      )}

      {showFillToggle && (
        <>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />
          <button
            type="button"
            onClick={handleToggleFill}
            title={activeFill === 'transparent' ? 'Tô nền nhạt' : 'Bỏ màu nền'}
            aria-label={activeFill === 'transparent' ? 'Tô nền nhạt' : 'Bỏ màu nền'}
            aria-pressed={activeFill !== 'transparent'}
            className={`p-2 rounded-xl transition-colors shrink-0 ${
              activeFill !== 'transparent'
                ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <PaintBucket className="w-4 h-4" />
          </button>
        </>
      )}

      {showFontSizes && (
        <>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="flex items-center gap-1 shrink-0">
            {FONT_SIZES.map((fs) => {
              const isSelected = activeFontSize === fs.value;
              return (
                <button
                  type="button"
                  key={fs.value}
                  onClick={() => handleFontSizePick(fs.value)}
                  title={`Cỡ chữ ${fs.label}`}
                  aria-label={`Cỡ chữ ${fs.label}`}
                  aria-pressed={isSelected}
                  className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {fs.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {isSingleFileCard && primarySelected && (
        <button
          type="button"
          onClick={() => setPreviewFileCardId(primarySelected.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Xem / Tải tệp</span>
        </button>
      )}

      {isSingleReveal && primarySelected && primarySelected.type === 'reveal' && (
        <button
          type="button"
          data-testid="toggle-reveal-curtain-button"
          onClick={() =>
            updateSelectedElements(
              (el) => (el.type === 'reveal' ? { ...el, revealed: !el.revealed } : el),
              true
            )
          }
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {primarySelected.revealed ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Che lại</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>Mở lời giải</span>
            </>
          )}
        </button>
      )}

      {hasSelection && (
        <>
          {(showColorPalette ||
            showStrokeWidths ||
            showFillToggle ||
            showFontSizes ||
            isSingleFileCard ||
            isSingleReveal) && (
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />
          )}
          {selectedElements.length > 1 && (
            <span
              data-testid="selection-count-label"
              className={`text-xs font-medium whitespace-nowrap tabular-nums shrink-0 ${
                groupSummary.isSingleGroup
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {groupSummary.isSingleGroup
                ? `Nhóm (${selectedElements.length})`
                : `${selectedElements.length} mục`}
            </span>
          )}
          {(groupSummary.canGroup || groupSummary.canUngroup) && (
            <div className="flex items-center gap-1 shrink-0">
              {groupSummary.canGroup && (
                <button
                  type="button"
                  data-testid="group-selected-button"
                  onClick={groupSelected}
                  title="Nhóm các đối tượng (Ctrl+G)"
                  aria-label="Nhóm đối tượng"
                  className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Group className="w-3.5 h-3.5" />
                  <span>Nhóm</span>
                </button>
              )}
              {groupSummary.canUngroup && (
                <button
                  type="button"
                  data-testid="ungroup-selected-button"
                  onClick={ungroupSelected}
                  title="Bỏ nhóm đối tượng (Ctrl+Shift+G)"
                  aria-label="Bỏ nhóm đối tượng"
                  className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Ungroup className="w-3.5 h-3.5" />
                  <span>Bỏ nhóm</span>
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={bringSelectedForward}
              title="Đưa lên trên cùng"
              aria-label="Đưa lên trên cùng"
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <ArrowUpToLine className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={sendSelectedBackward}
              title="Đưa xuống dưới cùng"
              aria-label="Đưa xuống dưới cùng"
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleLockSelected}
              title={allLocked ? 'Mở khóa vị trí' : 'Khóa vị trí'}
              aria-label={allLocked ? 'Mở khóa vị trí' : 'Khóa vị trí'}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                allLocked
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              {allLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={duplicateSelected}
              title="Nhân bản (Ctrl+D)"
              aria-label="Nhân bản"
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              title="Xóa (Delete)"
              aria-label="Xóa đối tượng"
              className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
