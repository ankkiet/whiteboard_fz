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
import { BoardElement, PenStyle, ShapeElement, StrokeElement } from '../../types/board';
import { getSelectedGroupSummary } from '../../engine/groupUtils';
import {
  clampEraserSize,
  clampStrokeWidth,
  MAX_ERASER_SIZE,
  MAX_STROKE_WIDTH,
  MIN_ERASER_SIZE,
  MIN_STROKE_WIDTH,
} from '../../engine/drawingUtils';
import {
  getEraserSizes,
  getHighlighterColors,
  getInkColors,
  getPenStyles,
  getStickyColors,
  getStrokeWidths,
} from './toolbarConfig';
import { useI18n } from '../../i18n/useI18n';

const FONT_SIZES = [
  { value: 14, label: 'S' },
  { value: 18, label: 'M' },
  { value: 24, label: 'L' },
  { value: 32, label: 'XL' },
];

export const ContextualToolbar: React.FC = () => {
  const { language, t } = useI18n();
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

  // Thanh ngữ cảnh chỉ xuất hiện khi người dùng chủ động chọn 1 hoặc nhiều đối tượng trên bảng
  if (!hasSelection) {
    return null;
  }

  const inkColors = getInkColors(language);
  const highlighterColors = getHighlighterColors(language);
  const stickyColors = getStickyColors(language);
  const strokeWidths = getStrokeWidths(language);
  const penStyles = getPenStyles(language);
  const eraserSizes = getEraserSizes(language);

  const colorableElements = selectedElements.filter(
    (el): el is Extract<BoardElement, { color: string }> => 'color' in el
  );
  const strokeableElements = selectedElements.filter(
    (el): el is Extract<BoardElement, { strokeWidth: number }> => 'strokeWidth' in el
  );
  const penStrokeElements = selectedElements.filter(
    (el): el is StrokeElement => el.type === 'stroke'
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
    ? stickyColors
    : showHighlighterPalette
    ? highlighterColors
    : inkColors;

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

  const handlePenStylePick = (style: PenStyle) => {
    updateSelectedElements(
      (el) => (el.type === 'stroke' ? { ...el, penStyle: style } : el),
      true
    );
  };

  const activePenStyle = penStrokeElements[0]?.penStyle;

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
      aria-label={t('Thanh công cụ đối tượng được chọn', 'Selected object toolbar')}
      data-testid="contextual-toolbar"
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-25 max-w-[calc(100vw-24px)] flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg dark:shadow-none border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 overflow-x-auto scrollbar-none"
    >
      {showEraserControls && (
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90">
            <button
              type="button"
              onClick={() => setEraserMode('stroke')}
              aria-pressed={eraserMode === 'stroke'}
              title={t('Quẹt qua để xóa trọn cả nét vẽ hoặc đối tượng', 'Swipe across to erase an entire stroke or object')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                eraserMode === 'stroke'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>{t('Xóa nét', 'Stroke eraser')}</span>
            </button>
            <button
              type="button"
              onClick={() => setEraserMode('area')}
              aria-pressed={eraserMode === 'area'}
              title={t('Tẩy hình vuông theo vùng bôi — lắc càng mạnh đầu tẩy càng to', 'Square area eraser — faster movement enlarges tip')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                eraserMode === 'area'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <SquareDashed className="w-3.5 h-3.5" />
              <span>{t('Xóa vùng bôi', 'Area eraser')}</span>
            </button>
          </div>

          {eraserMode === 'area' && (
            <>
              <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div
                className="flex items-center gap-1 shrink-0"
                role="group"
                aria-label={t('Kích cỡ đầu tẩy', 'Eraser size')}
              >
                {eraserSizes.map((sz) => {
                  const active = eraserSize === sz.value;
                  return (
                    <button
                      type="button"
                      key={sz.value}
                      onClick={() => setEraserSize(sz.value)}
                      title={t(
                        `Cỡ tẩy cơ bản: ${sz.label} (${sz.value}px · lắc mạnh để phóng to)`,
                        `Base eraser size: ${sz.label} (${sz.value}px · shake to enlarge)`
                      )}
                      aria-label={t(`Cỡ tẩy ${sz.label}`, `Eraser size ${sz.label}`)}
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
                  aria-label={t('Thanh trượt kích cỡ đầu tẩy', 'Eraser size slider')}
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
        <div
          className="flex items-center gap-1.5 shrink-0"
          role="group"
          aria-label={t('Bảng màu', 'Color palette')}
        >
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
                aria-label={t(`Màu ${item.label}`, `Color ${item.label}`)}
                aria-pressed={isSelected}
                style={{ backgroundColor: swatchBg }}
                className={`w-6 h-6 rounded-full border border-black/15 dark:border-white/15 transition-shadow duration-150 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-slate-900 dark:ring-slate-100 ring-offset-2 dark:ring-offset-slate-900'
                    : 'hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600'
                }`}
              />
            );
          })}

          {/* Custom Color Picker */}
          <label
            title={t('Chọn màu tùy chỉnh', 'Choose custom color')}
            className={`relative w-6 h-6 rounded-full flex items-center justify-center cursor-pointer border border-slate-300 dark:border-slate-600 transition-shadow duration-150 shrink-0 ${
              !isPresetColor
                ? 'ring-2 ring-slate-900 dark:ring-slate-100 ring-offset-2 dark:ring-offset-slate-900'
                : 'hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
            style={!isPresetColor ? { backgroundColor: resolvedActiveInk } : undefined}
          >
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(activeColor) ? activeColor : '#4f46e5'}
              onChange={(e) => handleColorPick(e.target.value)}
              aria-label={t('Chọn màu tùy chỉnh', 'Choose custom color')}
              className="sr-only"
            />
            {isPresetColor && <Pipette className="w-3 h-3" aria-hidden="true" />}
          </label>
        </div>
      )}

      {showStrokeWidths && (
        <>
          {showColorPalette && <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />}
          <div
            className="flex items-center gap-1 shrink-0"
            role="group"
            aria-label={t('Độ dày nét nhanh', 'Quick stroke widths')}
          >
            {strokeWidths.map((w) => {
              const isSelected = activeStrokeWidth === w.value;
              return (
                <button
                  type="button"
                  key={w.value}
                  onClick={() => handleStrokePick(w.value)}
                  title={t(`Độ dày nét: ${w.label} (${w.value}px)`, `Stroke width: ${w.label} (${w.value}px)`)}
                  aria-label={t(`Độ dày nét ${w.label}`, `Stroke width ${w.label}`)}
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
              title={t(`Xem trước đầu bút ${activeStrokeWidth}px`, `Nib preview ${activeStrokeWidth}px`)}
            >
              <span
                className="rounded-full block transition-opacity duration-150"
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
              aria-label={t('Thanh trượt độ dày nét', 'Stroke width slider')}
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

      {penStrokeElements.length > 0 && (
        <>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div
            className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 shrink-0"
            role="group"
            aria-label={t('Kiểu ngòi bút', 'Pen nib style')}
          >
            {penStyles.map((ps) => {
              const isSelected = activePenStyle === ps.id;
              return (
                <button
                  type="button"
                  key={ps.id}
                  onClick={() => handlePenStylePick(ps.id)}
                  title={ps.desc}
                  aria-pressed={isSelected}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {ps.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {showFillToggle && (
        <>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />
          <button
            type="button"
            onClick={handleToggleFill}
            title={activeFill === 'transparent' ? t('Tô nền nhạt', 'Add light fill') : t('Bỏ màu nền', 'Remove fill')}
            aria-label={
              activeFill === 'transparent' ? t('Tô nền nhạt', 'Add light fill') : t('Bỏ màu nền', 'Remove fill')
            }
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
                  title={t(`Cỡ chữ ${fs.label}`, `Font size ${fs.label}`)}
                  aria-label={t(`Cỡ chữ ${fs.label}`, `Font size ${fs.label}`)}
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
          <span>{t('Xem / Tải tệp', 'View / Download file')}</span>
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
              <span>{t('Che lại', 'Hide solution')}</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>{t('Mở lời giải', 'Reveal solution')}</span>
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
                ? t(`Nhóm (${selectedElements.length})`, `Group (${selectedElements.length})`)
                : t(`${selectedElements.length} mục`, `${selectedElements.length} items`)}
            </span>
          )}
          {(groupSummary.canGroup || groupSummary.canUngroup) && (
            <div className="flex items-center gap-1 shrink-0">
              {groupSummary.canGroup && (
                <button
                  type="button"
                  data-testid="group-selected-button"
                  onClick={groupSelected}
                  title={t('Nhóm các đối tượng (Ctrl+G)', 'Group objects (Ctrl+G)')}
                  aria-label={t('Nhóm đối tượng', 'Group objects')}
                  className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Group className="w-3.5 h-3.5" />
                  <span>{t('Nhóm', 'Group')}</span>
                </button>
              )}
              {groupSummary.canUngroup && (
                <button
                  type="button"
                  data-testid="ungroup-selected-button"
                  onClick={ungroupSelected}
                  title={t('Bỏ nhóm đối tượng (Ctrl+Shift+G)', 'Ungroup objects (Ctrl+Shift+G)')}
                  aria-label={t('Bỏ nhóm đối tượng', 'Ungroup objects')}
                  className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Ungroup className="w-3.5 h-3.5" />
                  <span>{t('Bỏ nhóm', 'Ungroup')}</span>
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={bringSelectedForward}
              title={t('Đưa lên trên cùng', 'Bring to front')}
              aria-label={t('Đưa lên trên cùng', 'Bring to front')}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <ArrowUpToLine className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={sendSelectedBackward}
              title={t('Đưa xuống dưới cùng', 'Send to back')}
              aria-label={t('Đưa xuống dưới cùng', 'Send to back')}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleLockSelected}
              title={allLocked ? t('Mở khóa vị trí', 'Unlock position') : t('Khóa vị trí', 'Lock position')}
              aria-label={
                allLocked ? t('Mở khóa vị trí', 'Unlock position') : t('Khóa vị trí', 'Lock position')
              }
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
              title={t('Nhân bản (Ctrl+D)', 'Duplicate (Ctrl+D)')}
              aria-label={t('Nhân bản', 'Duplicate')}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              title={t('Xóa (Delete)', 'Delete (Delete)')}
              aria-label={t('Xóa đối tượng', 'Delete object')}
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
