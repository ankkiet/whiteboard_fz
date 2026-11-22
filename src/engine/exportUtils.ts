import { BoardElement } from '../types/board';
import { getElementBounds } from './geometry';

export type ExportQualityScale = 2 | 3 | 4;

export const MAX_EXPORT_DIMENSION = 12000;
export const MAX_EXPORT_PIXELS = 64_000_000;

export interface ExportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  padding: number;
}

export interface ExportDimensions {
  pixelWidth: number;
  pixelHeight: number;
  effectiveScale: number;
  wasClamped: boolean;
}

export function computeBoardExportBounds(
  elements: BoardElement[],
  padding = 64
): ExportBounds {
  let minX = 0;
  let minY = 0;
  let maxX = 1280;
  let maxY = 720;

  if (elements.length > 0) {
    minX = Infinity;
    minY = Infinity;
    maxX = -Infinity;
    maxY = -Infinity;
    for (const el of elements) {
      const b = getElementBounds(el);
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }
  }

  const width = Math.max(Math.ceil(maxX - minX + padding * 2), 320);
  const height = Math.max(Math.ceil(maxY - minY + padding * 2), 240);

  return { minX, minY, maxX, maxY, width, height, padding };
}

/**
 * Computes the highest safe pixel resolution for exporting a canvas without
 * exceeding browser edge limits or total pixel memory budgets.
 */
export function computeOptimalExportDimensions(
  worldWidth: number,
  worldHeight: number,
  requestedScale: number,
  maxDimension = MAX_EXPORT_DIMENSION,
  maxPixels = MAX_EXPORT_PIXELS
): ExportDimensions {
  const safeW = Math.max(1, worldWidth);
  const safeH = Math.max(1, worldHeight);
  const targetScale = Math.max(1, requestedScale);

  const edgeScaleCap = Math.min(maxDimension / safeW, maxDimension / safeH);
  const areaScaleCap = Math.sqrt(maxPixels / (safeW * safeH));
  const maxSafeScale = Math.min(edgeScaleCap, areaScaleCap);

  const effectiveScale = Math.min(targetScale, maxSafeScale);
  const wasClamped = effectiveScale < targetScale - 1e-4;

  const pixelWidth = Math.max(1, Math.round(safeW * effectiveScale));
  const pixelHeight = Math.max(1, Math.round(safeH * effectiveScale));

  return {
    pixelWidth,
    pixelHeight,
    effectiveScale: Math.round(effectiveScale * 100) / 100,
    wasClamped,
  };
}
