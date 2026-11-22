import { BoardElement, Point, StrokeElement } from '../types/board';
import { getElementBounds } from './geometry';

export interface DynamicEraserState {
  currentSize: number;
  energy: number; // 0..1 normalized shake/scrub intensity
  lastScreenPos: Point | null;
  lastDir: Point | null;
  lastTimestamp: number;
}

export const DYNAMIC_ERASER_MAX_SCALE = 4.2;
export const DYNAMIC_ERASER_MAX_SIZE = 240;

export function createDynamicEraserState(baseSize: number): DynamicEraserState {
  return {
    currentSize: baseSize,
    energy: 0,
    lastScreenPos: null,
    lastDir: null,
    lastTimestamp: 0,
  };
}

/**
 * Updates dynamic eraser size based on pointer speed and back-and-forth shaking ("lắc mạnh").
 * Fast scrubbing and rapid direction reversals expand the square eraser smoothly;
 * slowing down or pausing decays it back toward `baseSize`.
 */
export function stepDynamicEraserState(
  state: DynamicEraserState,
  screenPos: Point,
  timestampMs: number,
  baseSize: number
): DynamicEraserState {
  if (!state.lastScreenPos || state.lastTimestamp <= 0) {
    return {
      currentSize: baseSize,
      energy: 0,
      lastScreenPos: screenPos,
      lastDir: null,
      lastTimestamp: timestampMs,
    };
  }

  const rawDtMs = timestampMs - state.lastTimestamp;
  const dtSec = Math.max(0.008, Math.min(rawDtMs / 1000, 0.25));
  const dx = screenPos.x - state.lastScreenPos.x;
  const dy = screenPos.y - state.lastScreenPos.y;
  const dist = Math.hypot(dx, dy);
  const speed = dist / dtSec; // screen px/sec

  // Natural decay when moving slowly or pausing
  let energy = state.energy * Math.exp(-dtSec * 2.8);
  let nextDir = state.lastDir;

  if (dist >= 2) {
    const dirX = dx / dist;
    const dirY = dy / dist;
    nextDir = { x: dirX, y: dirY };

    // Speed contribution above gentle precision threshold (~320 px/s)
    if (speed > 320) {
      const speedFactor = Math.min((speed - 320) / 1400, 1);
      energy += speedFactor * Math.min(dtSec * 3.8, 0.32);
    }

    // Back-and-forth shake detection: sharp direction reversal boosts growth dramatically
    if (state.lastDir && speed > 220) {
      const dot = state.lastDir.x * dirX + state.lastDir.y * dirY;
      if (dot < -0.15) {
        const reversalStrength = Math.min((-dot - 0.15) / 0.85, 1);
        const speedWeight = Math.min(speed / 900, 1.35);
        energy += (0.24 + 0.18 * reversalStrength) * speedWeight;
      }
    }
  }

  energy = Math.max(0, Math.min(1, energy));

  const maxAllowedSize = Math.min(
    Math.max(baseSize * DYNAMIC_ERASER_MAX_SCALE, baseSize + 96),
    DYNAMIC_ERASER_MAX_SIZE
  );
  const targetSize = baseSize + (maxAllowedSize - baseSize) * Math.pow(energy, 0.85);

  // Fast attack when growing, smooth gentle release when shrinking
  const alpha = targetSize > state.currentSize ? 0.36 : 0.12;
  const nextSize = state.currentSize + (targetSize - state.currentSize) * alpha;

  return {
    currentSize: Math.max(baseSize, Math.min(maxAllowedSize, nextSize)),
    energy,
    lastScreenPos: screenPos,
    lastDir: nextDir,
    lastTimestamp: timestampMs,
  };
}

/**
 * Exact 1D slab intersection test checking whether `point` lies inside the
 * axis-aligned square of side `2 * halfSize` swept linearly from `segStart` to `segEnd`.
 */
export function isPointInSweptSquare(
  point: Point,
  segStart: Point,
  segEnd: Point,
  halfSize: number
): boolean {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;

  let tMin = 0;
  let tMax = 1;

  // X slab: |point.x - (segStart.x + t * dx)| <= halfSize
  if (Math.abs(dx) < 1e-9) {
    if (Math.abs(point.x - segStart.x) > halfSize) return false;
  } else {
    const t1 = (point.x - halfSize - segStart.x) / dx;
    const t2 = (point.x + halfSize - segStart.x) / dx;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return false;
  }

  // Y slab: |point.y - (segStart.y + t * dy)| <= halfSize
  if (Math.abs(dy) < 1e-9) {
    if (Math.abs(point.y - segStart.y) > halfSize) return false;
  } else {
    const t1 = (point.y - halfSize - segStart.y) / dy;
    const t2 = (point.y + halfSize - segStart.y) / dy;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return false;
  }

  return tMin <= tMax;
}

function densifyPointsNearSegment(
  points: [number, number, number][],
  segStart: Point,
  segEnd: Point,
  halfSize: number
): [number, number, number][] {
  if (points.length <= 1) return points;

  const segMinX = Math.min(segStart.x, segEnd.x) - halfSize - 4;
  const segMaxX = Math.max(segStart.x, segEnd.x) + halfSize + 4;
  const segMinY = Math.min(segStart.y, segEnd.y) - halfSize - 4;
  const segMaxY = Math.max(segStart.y, segEnd.y) + halfSize + 4;

  const maxStep = Math.max(Math.min(halfSize * 0.3, 4), 1.5);
  const out: [number, number, number][] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];

    const pMinX = Math.min(a[0], b[0]);
    const pMaxX = Math.max(a[0], b[0]);
    const pMinY = Math.min(a[1], b[1]);
    const pMaxY = Math.max(a[1], b[1]);

    const overlaps =
      pMaxX >= segMinX && pMinX <= segMaxX && pMaxY >= segMinY && pMinY <= segMaxY;

    if (overlaps) {
      const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (dist > maxStep) {
        const steps = Math.ceil(dist / maxStep);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          out.push([
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
          ]);
        }
      }
    }

    out.push(b);
  }

  return out;
}

/**
 * Erases only the portion of a freehand stroke/highlighter that falls within the
 * swept square of half-size `halfSize` along `[segStart, segEnd]`, splitting the
 * stroke cleanly into surviving sub-stroke fragments.
 */
export function eraseStrokeBySegment(
  stroke: StrokeElement,
  segStart: Point,
  segEnd: Point,
  halfSize: number,
  createId: () => string
): { changed: boolean; fragments: StrokeElement[] } {
  if (stroke.isLocked || stroke.points.length === 0) {
    return { changed: false, fragments: [stroke] };
  }

  const bounds = getElementBounds(stroke);
  const pad = halfSize + Math.max(stroke.strokeWidth * 2, 6);
  const segMinX = Math.min(segStart.x, segEnd.x) - pad;
  const segMaxX = Math.max(segStart.x, segEnd.x) + pad;
  const segMinY = Math.min(segStart.y, segEnd.y) - pad;
  const segMaxY = Math.max(segStart.y, segEnd.y) + pad;

  if (
    bounds.maxX < segMinX ||
    bounds.minX > segMaxX ||
    bounds.maxY < segMinY ||
    bounds.minY > segMaxY
  ) {
    return { changed: false, fragments: [stroke] };
  }

  const dense = densifyPointsNearSegment(stroke.points, segStart, segEnd, halfSize);
  const runs: [number, number, number][][] = [];
  let currentRun: [number, number, number][] = [];
  let removedAny = false;

  for (const pt of dense) {
    if (isPointInSweptSquare({ x: pt[0], y: pt[1] }, segStart, segEnd, halfSize)) {
      removedAny = true;
      if (currentRun.length > 0) {
        runs.push(currentRun);
        currentRun = [];
      }
    } else {
      currentRun.push(pt);
    }
  }
  if (currentRun.length > 0) {
    runs.push(currentRun);
  }

  if (!removedAny) {
    return { changed: false, fragments: [stroke] };
  }

  const minRunPoints = stroke.points.length >= 2 ? 2 : 1;
  const validRuns = runs.filter((run) => run.length >= minRunPoints);

  const fragments: StrokeElement[] = validRuns.map((pts, idx) => {
    const draft: StrokeElement = {
      ...stroke,
      id: idx === 0 ? stroke.id : createId(),
      points: pts,
    };
    const b = getElementBounds(draft);
    return {
      ...draft,
      x: b.minX,
      y: b.minY,
      width: b.maxX - b.minX,
      height: b.maxY - b.minY,
    };
  });

  return { changed: true, fragments };
}

/**
 * Applies square area brush erasure across all unlocked freehand strokes and highlighters
 * on the board while preserving locked elements and non-ink objects (shapes, PDFs, images).
 */
export function eraseElementsInArea(
  elements: BoardElement[],
  segStart: Point,
  segEnd: Point,
  halfSize: number,
  createId: () => string
): { changed: boolean; elements: BoardElement[] } {
  let anyChanged = false;
  const next: BoardElement[] = [];

  for (const el of elements) {
    if (!el.isLocked && (el.type === 'stroke' || el.type === 'highlighter')) {
      const res = eraseStrokeBySegment(el, segStart, segEnd, halfSize, createId);
      if (res.changed) {
        anyChanged = true;
        next.push(...res.fragments);
      } else {
        next.push(el);
      }
    } else {
      next.push(el);
    }
  }

  return {
    changed: anyChanged,
    elements: anyChanged ? next : elements,
  };
}
