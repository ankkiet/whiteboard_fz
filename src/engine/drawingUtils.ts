import { PenStyle, Point } from '../types/board';

export const MIN_STROKE_WIDTH = 1;
export const MAX_STROKE_WIDTH = 20;

export const MIN_ERASER_SIZE = 10;
export const MAX_ERASER_SIZE = 96;

export interface PenStrokeProfile {
  size: number;
  thinning: number;
  smoothing: number;
  streamline: number;
  startTaper: number;
  endTaper: number;
}

/**
 * Returns perfect-freehand stroke physics parameters tailored to each pen nib style.
 * Legacy strokes with undefined `penStyle` keep the original balanced profile.
 */
export function getPenStrokeProfile(strokeWidth: number, penStyle?: PenStyle): PenStrokeProfile {
  switch (penStyle) {
    case 'ballpoint':
      return {
        size: Math.max(strokeWidth * 1.25, 2.2),
        thinning: 0.16,
        smoothing: 0.42,
        streamline: 0.24,
        startTaper: 0,
        endTaper: 2,
      };
    case 'fountain':
      return {
        size: Math.max(strokeWidth * 1.55, 2.8),
        thinning: 0.68,
        smoothing: 0.55,
        streamline: 0.35,
        startTaper: 4,
        endTaper: 10,
      };
    case 'pencil':
      return {
        size: Math.max(strokeWidth * 1.3, 2.2),
        thinning: 0.28,
        smoothing: 0.32,
        streamline: 0.18,
        startTaper: 2,
        endTaper: 4,
      };
    case 'brush':
      return {
        size: Math.max(strokeWidth * 2.1, 4),
        thinning: 0.82,
        smoothing: 0.6,
        streamline: 0.42,
        startTaper: 8,
        endTaper: 16,
      };
    default:
      return {
        size: Math.max(strokeWidth * 1.45, 2.5),
        thinning: 0.55,
        smoothing: 0.55,
        streamline: 0.5,
        startTaper: 0,
        endTaper: 0,
      };
  }
}

/**
 * Clamps stroke width to safe integer bounds for pen, highlighter, and shapes.
 */
export function clampStrokeWidth(value: number): number {
  if (!Number.isFinite(value)) return 4;
  return Math.max(MIN_STROKE_WIDTH, Math.min(MAX_STROKE_WIDTH, Math.round(value)));
}

/**
 * Clamps area eraser diameter to safe integer bounds.
 */
export function clampEraserSize(value: number): number {
  if (!Number.isFinite(value)) return 24;
  return Math.max(MIN_ERASER_SIZE, Math.min(MAX_ERASER_SIZE, Math.round(value)));
}

/**
 * Steps stroke width up or down ergonomically for keyboard shortcuts [ and ].
 */
export function stepStrokeWidth(current: number, direction: -1 | 1): number {
  const step = current >= 10 ? 2 : 1;
  return clampStrokeWidth(current + direction * step);
}

/**
 * Steps area eraser diameter up or down ergonomically for keyboard shortcuts [ and ].
 */
export function stepEraserSize(current: number, direction: -1 | 1): number {
  const step = 6;
  return clampEraserSize(current + direction * step);
}

/**
 * Computes the world-space radius of the live nib cursor so it matches the actual
 * rendered stroke diameter from perfect-freehand.
 */
export function computeBrushRadiusWorld(
  strokeWidth: number,
  isHighlighter: boolean,
  penStyle?: PenStyle
): number {
  if (isHighlighter) {
    return Math.max(strokeWidth * 3.5, 16) / 2;
  }
  return getPenStrokeProfile(strokeWidth, penStyle).size / 2;
}

/**
 * Applies gentle magnetic snapping to cardinal and 45-degree diagonals (0°, 45°, 90°, ...)
 * when the pointer is within `thresholdDegrees` of a cardinal/diagonal axis.
 * Allows smooth free-angle straight lines outside the magnetic band.
 */
export function magneticSnapLineEnd(
  start: Point,
  end: Point,
  thresholdDegrees = 4.5
): { point: Point; snappedAngleDeg: number | null } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    return { point: end, snappedAngleDeg: null };
  }

  const angleRad = Math.atan2(dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;
  const nearest45 = Math.round(angleDeg / 45) * 45;
  const deltaDeg = Math.abs(angleDeg - nearest45);

  if (deltaDeg <= thresholdDegrees) {
    const snappedRad = (nearest45 * Math.PI) / 180;
    const normalizedDeg = ((nearest45 % 360) + 360) % 360;
    return {
      point: {
        x: start.x + Math.cos(snappedRad) * dist,
        y: start.y + Math.sin(snappedRad) * dist,
      },
      snappedAngleDeg: normalizedDeg,
    };
  }

  return { point: end, snappedAngleDeg: null };
}

/**
 * Builds evenly spaced freehand points along a straight segment from start to end
 * so perfect-freehand renders a crisp, uniform straight line when Shift is held.
 */
export function buildStraightStrokePoints(
  start: [number, number, number],
  end: [number, number, number],
  stepPx = 6
): [number, number, number][] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dist = Math.hypot(dx, dy);
  const pressure = 0.5;

  if (dist < 0.5) {
    return [[start[0], start[1], pressure]];
  }

  const safeStep = Math.max(2, stepPx);
  const steps = Math.max(2, Math.min(240, Math.ceil(dist / safeStep)));
  const points: [number, number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push([start[0] + dx * t, start[1] + dy * t, pressure]);
  }

  return points;
}
