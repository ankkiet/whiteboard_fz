import { LaserPoint, Point, Rect } from '../types/board';
import { drawRoundedRectPath, resolveColor } from './renderBackground';

export function drawEraserTrail(ctx: CanvasRenderingContext2D, points: Point[], zoom: number) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.lineWidth = 14 / zoom;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawEraserCursor(
  ctx: CanvasRenderingContext2D,
  pos: Point,
  halfSize: number,
  zoom: number,
  isActive: boolean,
  isDarkMode: boolean,
  shakeIntensity = 0
) {
  ctx.save();
  const displayHalf = Math.max(halfSize, 5 / zoom);
  const side = displayHalf * 2;
  const x = pos.x - displayHalf;
  const y = pos.y - displayHalf;
  const cornerRadius = Math.min(side * 0.14, 10 / zoom);
  const clampedIntensity = Math.max(0, Math.min(1, shakeIntensity));

  drawRoundedRectPath(ctx, x, y, side, side, cornerRadius);

  if (isActive) {
    const fillAlpha = 0.14 + clampedIntensity * 0.1;
    ctx.fillStyle = `rgba(239, 68, 68, ${fillAlpha.toFixed(3)})`;
  } else {
    ctx.fillStyle = isDarkMode
      ? 'rgba(248, 250, 252, 0.1)'
      : 'rgba(15, 23, 42, 0.06)';
  }
  ctx.fill();

  ctx.strokeStyle = isDarkMode ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 3 / zoom;
  ctx.stroke();

  ctx.strokeStyle = isActive
    ? clampedIntensity > 0.35
      ? 'rgba(220, 38, 38, 0.96)'
      : 'rgba(239, 68, 68, 0.9)'
    : isDarkMode
    ? 'rgba(226, 232, 240, 0.85)'
    : 'rgba(51, 65, 85, 0.78)';
  ctx.lineWidth = (1.6 + clampedIntensity * 0.7) / zoom;
  ctx.stroke();

  const dotSize = Math.max(1.4 / zoom, 0.9);
  ctx.fillStyle = isActive
    ? 'rgba(239, 68, 68, 0.9)'
    : isDarkMode
    ? 'rgba(226, 232, 240, 0.75)'
    : 'rgba(51, 65, 85, 0.65)';
  ctx.fillRect(pos.x - dotSize, pos.y - dotSize, dotSize * 2, dotSize * 2);
  ctx.restore();
}

export function drawBrushCursor(
  ctx: CanvasRenderingContext2D,
  pos: Point,
  radiusWorld: number,
  color: string,
  isHighlighter: boolean,
  zoom: number,
  isDarkMode: boolean,
  isDrawing: boolean
) {
  ctx.save();
  const minScreenRadius = isHighlighter ? 6 : 3;
  const displayRadius = Math.max(radiusWorld, minScreenRadius / zoom);
  const resolved = isHighlighter ? color : resolveColor(color, isDarkMode);

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, displayRadius, 0, Math.PI * 2);
  ctx.fillStyle = resolved;
  ctx.globalAlpha = isHighlighter ? (isDrawing ? 0.25 : 0.36) : isDrawing ? 0.22 : 0.32;
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = isDarkMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 2.6 / zoom;
  ctx.stroke();

  ctx.strokeStyle = isHighlighter
    ? isDarkMode
      ? 'rgba(248, 250, 252, 0.85)'
      : 'rgba(15, 23, 42, 0.65)'
    : resolved;
  ctx.lineWidth = 1.35 / zoom;
  ctx.stroke();

  if (!isHighlighter && !isDrawing) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, Math.max(1.2 / zoom, 0.8), 0, Math.PI * 2);
    ctx.fillStyle = resolved;
    ctx.fill();
  }
  ctx.restore();
}

export function drawMarqueeRect(ctx: CanvasRenderingContext2D, rect: Rect, zoom: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(79, 70, 229, 0.08)';
  ctx.strokeStyle = '#4f46e5';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

export function drawLaserTrail(
  ctx: CanvasRenderingContext2D,
  laserPoints: LaserPoint[],
  now: number,
  zoom: number
) {
  const lifetime = 1500;
  const active = laserPoints.filter((p) => now - p.timestamp < lifetime);
  if (active.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < active.length; i++) {
    const prev = active[i - 1];
    const curr = active[i];
    if (prev.strokeId !== curr.strokeId) continue;

    const age = now - curr.timestamp;
    const rawT = Math.max(0, 1 - age / lifetime);
    if (rawT <= 0) continue;
    const alpha = Math.pow(rawT, 0.55);

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.92})`;
    ctx.lineWidth = (3 + 7 * rawT) / zoom;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 18;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.strokeStyle = `rgba(255, 241, 242, ${alpha})`;
    ctx.lineWidth = (1.5 + 2.8 * rawT) / zoom;
    ctx.shadowBlur = 0;
    ctx.stroke();
  }

  const head = active[active.length - 1];
  const headRawT = Math.max(0, 1 - (now - head.timestamp) / lifetime);
  const headAlpha = Math.pow(headRawT, 0.55);
  if (headRawT > 0.05) {
    ctx.beginPath();
    ctx.arc(head.x, head.y, (6.5 * headAlpha) / zoom, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(239, 68, 68, ${headAlpha})`;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 20;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(head.x, head.y, (2.8 * headAlpha) / zoom, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${headAlpha})`;
    ctx.shadowBlur = 0;
    ctx.fill();
  }

  ctx.restore();
}
