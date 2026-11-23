import { BoardElement, Camera, NotebookPageConfig, NotebookPaperSize, Point, Rect } from '../types/board';
import { getElementBounds } from './geometry';

export const NOTEBOOK_PAPER_CONFIGS: Record<NotebookPaperSize, NotebookPageConfig> = {
  a4: {
    id: 'a4',
    name: 'Khổ A4 (210 × 297 mm)',
    label: 'Khổ A4',
    width: 800,
    height: 1132,
    marginLeft: 72,
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
    marginLeft: 96,
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
    marginLeft: 64,
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
    marginLeft: 72,
    marginRight: 36,
    marginTop: 56,
    marginBottom: 48,
    lineSpacing: 32,
  },
};

export const DEFAULT_NOTEBOOK_PAPER_SIZE: NotebookPaperSize = 'a4';

export function getNotebookConfig(size?: NotebookPaperSize): NotebookPageConfig {
  if (size && NOTEBOOK_PAPER_CONFIGS[size]) {
    return NOTEBOOK_PAPER_CONFIGS[size];
  }
  return NOTEBOOK_PAPER_CONFIGS[DEFAULT_NOTEBOOK_PAPER_SIZE];
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
