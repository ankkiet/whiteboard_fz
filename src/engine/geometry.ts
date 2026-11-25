import { BoardElement, Bounds, Camera, Point, Rect, ResizeHandle, ShapeElement } from '../types/board';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const MIN_ELEMENT_SIZE = 24;

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera,
  canvasRect: { left: number; top: number }
): Point {
  return {
    x: (screenX - canvasRect.left - camera.x) / camera.zoom,
    y: (screenY - canvasRect.top - camera.y) / camera.zoom,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera,
  canvasRect: { left: number; top: number } = { left: 0, top: 0 }
): Point {
  return {
    x: worldX * camera.zoom + camera.x + canvasRect.left,
    y: worldY * camera.zoom + camera.y + canvasRect.top,
  };
}

/**
 * Zooms the camera to `nextZoom` while keeping the world point under
 * `(anchorScreenX, anchorScreenY)` (relative to canvas top-left) stationary.
 */
export function zoomCameraAtPoint(
  camera: Camera,
  nextZoomRaw: number,
  anchorScreenX: number,
  anchorScreenY: number
): Camera {
  const nextZoom = Math.min(Math.max(nextZoomRaw, MIN_ZOOM), MAX_ZOOM);
  const scale = nextZoom / camera.zoom;
  return {
    x: anchorScreenX - (anchorScreenX - camera.x) * scale,
    y: anchorScreenY - (anchorScreenY - camera.y) * scale,
    zoom: nextZoom,
  };
}

export function getArrowEndpoints(el: ShapeElement): { start: Point; end: Point } {
  if (el.startPoint && el.endPoint) {
    return { start: el.startPoint, end: el.endPoint };
  }
  return {
    start: { x: el.x, y: el.y },
    end: { x: el.x + el.width, y: el.y + el.height },
  };
}

const boundsCache = new WeakMap<BoardElement, Bounds>();

export function getElementBounds(element: BoardElement): Bounds {
  const cached = boundsCache.get(element);
  if (cached) return cached;

  let result: Bounds;
  if (element.type === 'stroke' || element.type === 'highlighter') {
    if (!element.points || element.points.length === 0) {
      result = {
        minX: element.x,
        minY: element.y,
        maxX: element.x + element.width,
        maxY: element.y + element.height,
      };
    } else {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of element.points) {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] > maxY) maxY = p[1];
      }
      const pad = Math.max(element.strokeWidth / 2, 4);
      result = {
        minX: minX - pad,
        minY: minY - pad,
        maxX: maxX + pad,
        maxY: maxY + pad,
      };
    }
  } else if (element.type === 'arrow' || element.type === 'line') {
    const { start, end } = getArrowEndpoints(element);
    const pad = Math.max(element.strokeWidth, 8);
    result = {
      minX: Math.min(start.x, end.x) - pad,
      minY: Math.min(start.y, end.y) - pad,
      maxX: Math.max(start.x, end.x) + pad,
      maxY: Math.max(start.y, end.y) + pad,
    };
  } else {
    result = {
      minX: Math.min(element.x, element.x + element.width),
      minY: Math.min(element.y, element.y + element.height),
      maxX: Math.max(element.x, element.x + element.width),
      maxY: Math.max(element.y, element.y + element.height),
    };
  }

  boundsCache.set(element, result);
  return result;
}

export function getSelectionRect(elements: BoardElement[], selectedIds: string[]): Rect | null {
  if (selectedIds.length === 0) return null;
  const idSet = new Set(selectedIds);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const el of elements) {
    if (!idSet.has(el.id)) continue;
    found = true;
    const b = getElementBounds(el);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  if (!found) return null;
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const ccw = (p1: Point, p2: Point, p3: Point) =>
    (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  return ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2);
}

export function isPointInElement(point: Point, element: BoardElement, tolerance = 8): boolean {
  const bounds = getElementBounds(element);
  if (
    point.x < bounds.minX - tolerance ||
    point.x > bounds.maxX + tolerance ||
    point.y < bounds.minY - tolerance ||
    point.y > bounds.maxY + tolerance
  ) {
    return false;
  }

  if (element.type === 'stroke' || element.type === 'highlighter') {
    const pts = element.points;
    if (pts.length === 0) return false;
    const hitDist = Math.max(element.strokeWidth * 0.75, tolerance);
    if (pts.length === 1) {
      return Math.hypot(pts[0][0] - point.x, pts[0][1] - point.y) <= hitDist;
    }
    for (let i = 1; i < pts.length; i++) {
      const d = distanceToSegment(
        point,
        { x: pts[i - 1][0], y: pts[i - 1][1] },
        { x: pts[i][0], y: pts[i][1] }
      );
      if (d <= hitDist) return true;
    }
    return false;
  }

  if (element.type === 'arrow' || element.type === 'line') {
    const { start, end } = getArrowEndpoints(element);
    return distanceToSegment(point, start, end) <= Math.max(element.strokeWidth + 6, tolerance + 4);
  }

  if (element.type === 'ellipse') {
    const rx = Math.abs(element.width) / 2;
    const ry = Math.abs(element.height) / 2;
    if (rx < 1 || ry < 1) return true;
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const nx = (point.x - cx) / (rx + tolerance);
    const ny = (point.y - cy) / (ry + tolerance);
    return nx * nx + ny * ny <= 1;
  }

  return true;
}

export function doesSegmentHitElement(a: Point, b: Point, element: BoardElement, tolerance = 10): boolean {
  if (isPointInElement(a, element, tolerance) || isPointInElement(b, element, tolerance)) {
    return true;
  }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (isPointInElement(mid, element, tolerance)) {
    return true;
  }

  if (element.type === 'stroke' || element.type === 'highlighter') {
    const pts = element.points;
    for (let i = 1; i < pts.length; i++) {
      const p1 = { x: pts[i - 1][0], y: pts[i - 1][1] };
      const p2 = { x: pts[i][0], y: pts[i][1] };
      if (segmentsIntersect(a, b, p1, p2)) return true;
    }
    return false;
  }

  if (element.type === 'arrow' || element.type === 'line') {
    const { start, end } = getArrowEndpoints(element);
    return segmentsIntersect(a, b, start, end);
  }

  const bounds = getElementBounds(element);
  const topLeft = { x: bounds.minX, y: bounds.minY };
  const topRight = { x: bounds.maxX, y: bounds.minY };
  const bottomLeft = { x: bounds.minX, y: bounds.maxY };
  const bottomRight = { x: bounds.maxX, y: bounds.maxY };

  return (
    segmentsIntersect(a, b, topLeft, topRight) ||
    segmentsIntersect(a, b, topRight, bottomRight) ||
    segmentsIntersect(a, b, bottomRight, bottomLeft) ||
    segmentsIntersect(a, b, bottomLeft, topLeft)
  );
}

export function doesRectIntersectElement(rect: Rect, element: BoardElement): boolean {
  const rMinX = Math.min(rect.x, rect.x + rect.width);
  const rMaxX = Math.max(rect.x, rect.x + rect.width);
  const rMinY = Math.min(rect.y, rect.y + rect.height);
  const rMaxY = Math.max(rect.y, rect.y + rect.height);

  const b = getElementBounds(element);
  return !(b.maxX < rMinX || b.minX > rMaxX || b.maxY < rMinY || b.minY > rMaxY);
}

export function translateElement(element: BoardElement, dx: number, dy: number): BoardElement {
  if (element.type === 'stroke' || element.type === 'highlighter') {
    return {
      ...element,
      x: element.x + dx,
      y: element.y + dy,
      points: element.points.map(([px, py, pr]) => [px + dx, py + dy, pr]),
    };
  }
  if ((element.type === 'arrow' || element.type === 'line') && element.startPoint && element.endPoint) {
    return {
      ...element,
      x: element.x + dx,
      y: element.y + dy,
      startPoint: { x: element.startPoint.x + dx, y: element.startPoint.y + dy },
      endPoint: { x: element.endPoint.x + dx, y: element.endPoint.y + dy },
    };
  }
  return {
    ...element,
    x: element.x + dx,
    y: element.y + dy,
  };
}

export function computeResizedRect(
  initial: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  preserveAspectRatio: boolean
): Rect {
  let { x, y, width, height } = initial;
  const aspect = initial.height > 0 ? initial.width / initial.height : 1;

  if (handle.includes('e')) {
    width = Math.max(MIN_ELEMENT_SIZE, initial.width + dx);
  }
  if (handle.includes('s')) {
    height = Math.max(MIN_ELEMENT_SIZE, initial.height + dy);
  }
  if (handle.includes('w')) {
    const nextWidth = Math.max(MIN_ELEMENT_SIZE, initial.width - dx);
    x = initial.x + (initial.width - nextWidth);
    width = nextWidth;
  }
  if (handle.includes('n')) {
    const nextHeight = Math.max(MIN_ELEMENT_SIZE, initial.height - dy);
    y = initial.y + (initial.height - nextHeight);
    height = nextHeight;
  }

  const isCorner = handle.length === 2;
  if (preserveAspectRatio && isCorner && aspect > 0) {
    const widthDelta = Math.abs(width - initial.width);
    const heightDelta = Math.abs(height - initial.height);
    if (widthDelta >= heightDelta) {
      const nextHeight = Math.max(MIN_ELEMENT_SIZE, width / aspect);
      if (handle.includes('n')) {
        y = initial.y + (initial.height - nextHeight);
      }
      height = nextHeight;
    } else {
      const nextWidth = Math.max(MIN_ELEMENT_SIZE, height * aspect);
      if (handle.includes('w')) {
        x = initial.x + (initial.width - nextWidth);
      }
      width = nextWidth;
    }
  }

  return { x, y, width, height };
}

export function resizeElementToRect(element: BoardElement, initialRect: Rect, nextRect: Rect): BoardElement {
  const scaleX = initialRect.width > 0 ? nextRect.width / initialRect.width : 1;
  const scaleY = initialRect.height > 0 ? nextRect.height / initialRect.height : 1;

  if (element.type === 'stroke' || element.type === 'highlighter') {
    const nextPoints: [number, number, number][] = element.points.map(([px, py, pr]) => [
      nextRect.x + (px - initialRect.x) * scaleX,
      nextRect.y + (py - initialRect.y) * scaleY,
      pr,
    ]);
    return {
      ...element,
      x: nextRect.x + (element.x - initialRect.x) * scaleX,
      y: nextRect.y + (element.y - initialRect.y) * scaleY,
      width: Math.max(1, element.width * scaleX),
      height: Math.max(1, element.height * scaleY),
      points: nextPoints,
    };
  }

  if (element.type === 'arrow' || element.type === 'line') {
    const { start, end } = getArrowEndpoints(element);
    const nextStart = {
      x: nextRect.x + (start.x - initialRect.x) * scaleX,
      y: nextRect.y + (start.y - initialRect.y) * scaleY,
    };
    const nextEnd = {
      x: nextRect.x + (end.x - initialRect.x) * scaleX,
      y: nextRect.y + (end.y - initialRect.y) * scaleY,
    };
    return {
      ...element,
      x: Math.min(nextStart.x, nextEnd.x),
      y: Math.min(nextStart.y, nextEnd.y),
      width: Math.abs(nextEnd.x - nextStart.x),
      height: Math.abs(nextEnd.y - nextStart.y),
      startPoint: nextStart,
      endPoint: nextEnd,
    };
  }

  return {
    ...element,
    x: nextRect.x + (element.x - initialRect.x) * scaleX,
    y: nextRect.y + (element.y - initialRect.y) * scaleY,
    width: Math.max(MIN_ELEMENT_SIZE, element.width * scaleX),
    height: Math.max(MIN_ELEMENT_SIZE, element.height * scaleY),
  };
}

/**
 * Computes Shift-constrained shape geometry:
 * - rectangle / ellipse: square / circle
 * - arrow / line: snaps angle to 45° increments
 */
export function constrainShapeEndPoint(
  start: Point,
  current: Point,
  shapeType: 'rectangle' | 'ellipse' | 'arrow' | 'line',
  shiftKey: boolean
): Point {
  if (!shiftKey) return current;
  const dx = current.x - start.x;
  const dy = current.y - start.y;

  if (shapeType === 'rectangle' || shapeType === 'ellipse') {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      x: start.x + Math.sign(dx || 1) * size,
      y: start.y + Math.sign(dy || 1) * size,
    };
  }

  // Snap arrow/line to 45° increments
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return {
    x: start.x + Math.cos(snappedAngle) * dist,
    y: start.y + Math.sin(snappedAngle) * dist,
  };
}

export function computeFitCamera(
  elements: BoardElement[],
  viewportWidth: number,
  viewportHeight: number,
  padding = 96
): Camera {
  if (elements.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const b = getElementBounds(el);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  const contentW = Math.max(maxX - minX, 1);
  const contentH = Math.max(maxY - minY, 1);
  const availW = Math.max(viewportWidth - padding * 2, 100);
  const availH = Math.max(viewportHeight - padding * 2, 100);

  const zoom = Math.min(Math.max(Math.min(availW / contentW, availH / contentH), MIN_ZOOM), 1.5);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    x: viewportWidth / 2 - centerX * zoom,
    y: viewportHeight / 2 - centerY * zoom,
    zoom,
  };
}
