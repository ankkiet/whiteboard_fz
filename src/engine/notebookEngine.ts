import { AppLanguage, getAppLanguage } from '../i18n';
import { BoardElement, BoardPattern, Camera, NotebookPageConfig, NotebookPaperSize, Point, Rect } from '../types/board';
import { getArrowEndpoints, getElementBounds } from './geometry';

export type NotebookPaperStyle = 'lined' | 'grid' | 'dots' | 'plain';

export interface NotebookPaperStyleOption {
  id: NotebookPaperStyle;
  label: string;
  shortLabel: string;
  description: string;
}

export const DEFAULT_NOTEBOOK_PAPER_STYLE: NotebookPaperStyle = 'lined';

export function getNotebookPaperStyles(
  lang: AppLanguage = getAppLanguage()
): NotebookPaperStyleOption[] {
  if (lang === 'en') {
    return [
      {
        id: 'lined',
        label: 'Ruled paper',
        shortLabel: 'Ruled',
        description: 'Classic horizontal lines',
      },
      {
        id: 'grid',
        label: 'Grid paper',
        shortLabel: 'Grid',
        description: 'Even squares for alignment & sketches',
      },
      {
        id: 'dots',
        label: 'Dotted paper',
        shortLabel: 'Dotted',
        description: 'Subtle dot grid for freeform notes',
      },
      {
        id: 'plain',
        label: 'Blank paper',
        shortLabel: 'Blank',
        description: 'No lines, page margins only',
      },
    ];
  }
  return [
    {
      id: 'lined',
      label: 'Giấy kẻ ngang',
      shortLabel: 'Kẻ ngang',
      description: 'Dòng kẻ ngang truyền thống',
    },
    {
      id: 'grid',
      label: 'Giấy ô ly',
      shortLabel: 'Ô ly',
      description: 'Ô vuông đều, dễ căn hàng & vẽ hình',
    },
    {
      id: 'dots',
      label: 'Giấy chấm bi',
      shortLabel: 'Chấm bi',
      description: 'Chấm lưới tinh gọn, ghi chú tự do',
    },
    {
      id: 'plain',
      label: 'Giấy trắng trơn',
      shortLabel: 'Trắng trơn',
      description: 'Không dòng kẻ, chỉ giữ lề trang',
    },
  ];
}

export const NOTEBOOK_PAPER_STYLES: NotebookPaperStyleOption[] = getNotebookPaperStyles('vi');

export function normalizeNotebookPaperStyle(raw?: BoardPattern | unknown): NotebookPaperStyle {
  if (raw === 'lined' || raw === 'grid' || raw === 'dots' || raw === 'plain') {
    return raw;
  }
  return DEFAULT_NOTEBOOK_PAPER_STYLE;
}

export const NOTEBOOK_PAPER_CONFIGS: Record<NotebookPaperSize, NotebookPageConfig> = {
  a4: {
    id: 'a4',
    name: 'Khổ A4 (210 × 297 mm)',
    label: 'Khổ A4',
    width: 800,
    height: 1132,
    marginLeft: 36,
    marginRight: 36,
    marginTop: 56,
    marginBottom: 48,
    lineSpacing: 32,
  },
  a3: {
    id: 'a3',
    name: 'Khổ A3 (297 × 420 mm)',
    label: 'Khổ A3',
    width: 1132,
    height: 1600,
    marginLeft: 48,
    marginRight: 48,
    marginTop: 72,
    marginBottom: 64,
    lineSpacing: 36,
  },
  b5: {
    id: 'b5',
    name: 'Khổ B5 (176 × 250 mm)',
    label: 'Khổ B5',
    width: 700,
    height: 994,
    marginLeft: 32,
    marginRight: 32,
    marginTop: 50,
    marginBottom: 44,
    lineSpacing: 30,
  },
  letter: {
    id: 'letter',
    name: 'Khổ Letter (216 × 279 mm)',
    label: 'Khổ Letter',
    width: 800,
    height: 1035,
    marginLeft: 36,
    marginRight: 36,
    marginTop: 56,
    marginBottom: 48,
    lineSpacing: 32,
  },
};

export const DEFAULT_NOTEBOOK_PAPER_SIZE: NotebookPaperSize = 'a4';

export function getNotebookConfig(
  size?: NotebookPaperSize,
  lang: AppLanguage = getAppLanguage()
): NotebookPageConfig {
  const base =
    size && NOTEBOOK_PAPER_CONFIGS[size]
      ? NOTEBOOK_PAPER_CONFIGS[size]
      : NOTEBOOK_PAPER_CONFIGS[DEFAULT_NOTEBOOK_PAPER_SIZE];
  if (lang !== 'en') return base;
  const enLabels: Record<NotebookPaperSize, { name: string; label: string }> = {
    a4: { name: 'A4 (210 × 297 mm)', label: 'A4' },
    a3: { name: 'A3 (297 × 420 mm)', label: 'A3' },
    b5: { name: 'B5 (176 × 250 mm)', label: 'B5' },
    letter: { name: 'Letter (216 × 279 mm)', label: 'Letter' },
  };
  return { ...base, ...enLabels[base.id] };
}

export function normalizeNotebookPaperSize(raw: unknown): NotebookPaperSize {
  if (raw === 'a4' || raw === 'a3' || raw === 'b5' || raw === 'letter') {
    return raw;
  }
  return DEFAULT_NOTEBOOK_PAPER_SIZE;
}

export function getNotebookPageBounds(pageIndex: number, config: NotebookPageConfig): Rect {
  const safeIndex = Math.max(0, pageIndex);
  return {
    x: 0,
    y: safeIndex * config.height,
    width: config.width,
    height: config.height,
  };
}

export interface NotebookMarginsInfo {
  left: number;
  right: number;
  top: number;
  bottom: number;
  contentWidth: number;
  contentHeight: number;
}

export function getNotebookMargins(pageIndex: number, config: NotebookPageConfig): NotebookMarginsInfo {
  const safeIndex = Math.max(0, pageIndex);
  const left = config.marginLeft;
  const right = config.width - config.marginRight;
  const top = safeIndex * config.height + config.marginTop;
  const bottom = (safeIndex + 1) * config.height - config.marginBottom;
  return {
    left,
    right,
    top,
    bottom,
    contentWidth: Math.max(0, right - left),
    contentHeight: Math.max(0, bottom - top),
  };
}

/**
 * Clamps coordinates to stay strictly within notebook margins
 * so handwriting and shapes cannot spill outside the page boundaries.
 */
export function clampPointToNotebookMargins(point: Point, config: NotebookPageConfig): Point {
  const minX = config.marginLeft;
  const maxX = config.width - config.marginRight;
  const clampedX = Math.max(minX, Math.min(maxX, point.x));
  const clampedY = Math.max(config.marginTop, point.y);
  return { x: clampedX, y: clampedY };
}

export function isPointInsideNotebookMargins(point: Point, config: NotebookPageConfig): boolean {
  const minX = config.marginLeft;
  const maxX = config.width - config.marginRight;
  return point.x >= minX && point.x <= maxX && point.y >= config.marginTop;
}

/**
 * Calculates total continuous pages needed based on elements position
 * and current camera scroll position, with at least 2 pages.
 */
export function computeTotalNotebookPages(
  elements: BoardElement[],
  camera: Camera,
  viewportHeight: number,
  config: NotebookPageConfig
): number {
  let maxElementY = 0;
  for (const el of elements) {
    const bounds = getElementBounds(el);
    if (bounds.maxY > maxElementY) {
      maxElementY = bounds.maxY;
    }
  }

  const safeZoom = Math.max(0.1, camera.zoom);
  const worldBottom = (-camera.y + viewportHeight) / safeZoom;
  const neededExtent = Math.max(maxElementY + 120, worldBottom + config.height * 0.4);
  const pages = Math.ceil(neededExtent / config.height);
  return Math.max(2, pages);
}

function getTightElementVerticalRange(el: BoardElement): { minY: number; maxY: number } | null {
  if (el.type === 'stroke' || el.type === 'highlighter') {
    if (!el.points || el.points.length === 0) return null;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of el.points) {
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return null;
    return { minY, maxY };
  }

  if (el.type === 'text') {
    if (!el.text || el.text.trim().length === 0) return null;
  }

  if (el.type === 'arrow' || el.type === 'line') {
    const { start, end } = getArrowEndpoints(el);
    return {
      minY: Math.min(start.y, end.y),
      maxY: Math.max(start.y, end.y),
    };
  }

  const bounds = getElementBounds(el);
  return { minY: bounds.minY, maxY: bounds.maxY };
}

/**
 * Returns the sorted, 0-based indices of notebook pages that actually contain
 * written/drawn content (ignoring empty strokes and blank text boxes).
 * Used by PDF export so empty trailing or intermediate pages are never exported.
 */
export function getNotebookContentPageIndices(
  elements: BoardElement[],
  config: NotebookPageConfig,
  maxPages = 50
): number[] {
  if (!elements || elements.length === 0 || config.height <= 0) {
    return [];
  }

  const pageIndices = new Set<number>();

  for (const el of elements) {
    const range = getTightElementVerticalRange(el);
    if (!range) continue;

    if (range.maxY < 0) continue;
    const clampedMinY = Math.max(0, range.minY);
    const startPage = Math.floor(clampedMinY / config.height);
    const endPage =
      range.maxY > clampedMinY
        ? Math.floor((range.maxY - 0.001) / config.height)
        : startPage;

    const safeEndPage = Math.min(maxPages - 1, Math.max(startPage, endPage));
    for (let p = startPage; p <= safeEndPage; p++) {
      if (p >= 0 && p < maxPages) {
        pageIndices.add(p);
      }
    }
  }

  return Array.from(pageIndices).sort((a, b) => a - b);
}

/**
 * Restricts camera navigation in notebook mode so the notebook is not an infinite void.
 * - Horizontal (X): perfectly centered if page fits in viewport; clamped to page width if zoomed in.
 * - Vertical (Y): restricted from panning way above page 1 or infinitely below the last page.
 */
export function clampNotebookCamera(
  camera: Camera,
  viewport: { width: number; height: number },
  config: NotebookPageConfig,
  totalPages: number
): Camera {
  const clampedZoom = Math.max(0.35, Math.min(3.0, camera.zoom));
  const renderedWidth = config.width * clampedZoom;

  let targetX: number;
  if (renderedWidth <= viewport.width) {
    targetX = Math.round((viewport.width - renderedWidth) / 2);
  } else {
    const pad = 24 * clampedZoom;
    const minX = viewport.width - (renderedWidth + pad);
    const maxX = pad;
    targetX = Math.max(minX, Math.min(maxX, camera.x));
  }

  const safeTotalPages = Math.max(1, totalPages);
  const totalWorldHeight = safeTotalPages * config.height;
  const topPad = 48 * clampedZoom;
  const maxY = Math.round(topPad);
  const minY = Math.round(viewport.height - (totalWorldHeight + 160) * clampedZoom);

  const targetY = Math.min(maxY, Math.max(minY, camera.y));

  return {
    x: targetX,
    y: targetY,
    zoom: clampedZoom,
  };
}

/**
 * Computes camera setting that fits the entire notebook page width comfortably in the viewport.
 */
export function getNotebookFitCamera(
  viewport: { width: number; height: number },
  config: NotebookPageConfig
): Camera {
  const horizontalPadding = Math.min(72, Math.max(24, viewport.width * 0.08));
  const availableW = Math.max(200, viewport.width - horizontalPadding * 2);
  const idealZoom = Math.max(0.4, Math.min(1.5, availableW / config.width));
  const roundedZoom = Math.round(idealZoom * 100) / 100;
  const renderedW = config.width * roundedZoom;
  const x = Math.round((viewport.width - renderedW) / 2);
  const y = 32;

  return { x, y, zoom: roundedZoom };
}
