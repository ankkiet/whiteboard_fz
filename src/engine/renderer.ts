import { getStroke } from 'perfect-freehand';
import { BoardElement, PenStyle, StrokeElement } from '../types/board';
import { getPenStrokeProfile } from './drawingUtils';
import { getArrowEndpoints } from './geometry';
import { getCachedImage } from './imageCache';
import { latexToReadableMath } from './mathDisplay';
import { drawRoundedRectPath, resolveColor } from './renderBackground';
import { tr } from '../i18n';

export {
  ADAPTIVE_INK,
  drawNotebookLayout,
  drawWorldBackgroundPattern,
  getCanvasBackgroundColor,
  resolveColor,
} from './renderBackground';

export {
  drawBrushCursor,
  drawEraserCursor,
  drawEraserTrail,
  drawLaserTrail,
  drawMarqueeRect,
} from './renderOverlays';

const strokePathCache = new WeakMap<StrokeElement, { key: string; path: Path2D }>();
const pencilPatternCache = new Map<string, CanvasPattern>();

function getPencilGrainPattern(
  ctx: CanvasRenderingContext2D,
  color: string
): CanvasPattern | null {
  if (typeof document === 'undefined') return null;
  const cached = pencilPatternCache.get(color);
  if (cached) return cached;

  const tileSize = 48;
  const tile = document.createElement('canvas');
  tile.width = tileSize;
  tile.height = tileSize;
  const tctx = tile.getContext('2d');
  if (!tctx) return null;

  // Deterministic paper-tooth graphite mask
  tctx.fillStyle = color;
  for (let y = 0; y < tileSize; y++) {
    for (let x = 0; x < tileSize; x++) {
      const hash = ((x * 374761393 + y * 668265263) ^ (x * y)) >>> 0;
      const noise = (hash % 100) / 100;
      if (noise > 0.14) {
        tctx.globalAlpha = 0.42 + noise * 0.56;
        tctx.fillRect(x, y, 1, 1);
      }
    }
  }

  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return null;
  if (pencilPatternCache.size > 32) {
    pencilPatternCache.clear();
  }
  pencilPatternCache.set(color, pattern);
  return pattern;
}

function buildStrokePath2D(outlinePoints: number[][], dotRadius: number): Path2D | null {
  if (outlinePoints.length === 0 || typeof Path2D === 'undefined') return null;

  const path = new Path2D();
  if (outlinePoints.length === 1) {
    path.arc(outlinePoints[0][0], outlinePoints[0][1], dotRadius, 0, Math.PI * 2);
    return path;
  }

  const len = outlinePoints.length;
  const firstMidX = (outlinePoints[0][0] + outlinePoints[1][0]) / 2;
  const firstMidY = (outlinePoints[0][1] + outlinePoints[1][1]) / 2;
  path.moveTo(firstMidX, firstMidY);

  for (let i = 1; i < len; i++) {
    const curr = outlinePoints[i];
    const next = outlinePoints[(i + 1) % len];
    const midX = (curr[0] + next[0]) / 2;
    const midY = (curr[1] + next[1]) / 2;
    path.quadraticCurveTo(curr[0], curr[1], midX, midY);
  }
  path.closePath();
  return path;
}

function drawSmoothStrokePolygon(
  ctx: CanvasRenderingContext2D,
  outlinePoints: number[][],
  dotRadius = 1.5
) {
  if (outlinePoints.length === 0) return;

  ctx.beginPath();
  if (outlinePoints.length === 1) {
    ctx.arc(outlinePoints[0][0], outlinePoints[0][1], dotRadius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const len = outlinePoints.length;
  const firstMidX = (outlinePoints[0][0] + outlinePoints[1][0]) / 2;
  const firstMidY = (outlinePoints[0][1] + outlinePoints[1][1]) / 2;
  ctx.moveTo(firstMidX, firstMidY);

  for (let i = 1; i < len; i++) {
    const curr = outlinePoints[i];
    const next = outlinePoints[(i + 1) % len];
    const midX = (curr[0] + next[0]) / 2;
    const midY = (curr[1] + next[1]) / 2;
    ctx.quadraticCurveTo(curr[0], curr[1], midX, midY);
  }
  ctx.closePath();
  ctx.fill();
}

function computePolylineLength(points: [number, number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

export function computeStrokeOutline(
  points: [number, number, number][],
  strokeWidth: number,
  isHighlighter: boolean,
  penStyle?: PenStyle,
  isComplete = true
): { outlinePoints: number[][]; dotRadius: number } {
  if (points.length === 0) {
    return { outlinePoints: [], dotRadius: 1.1 };
  }

  if (isHighlighter) {
    const size = Math.max(strokeWidth * 3.5, 16);
    const totalLen = computePolylineLength(points);
    if (points.length === 1 || totalLen < 0.5) {
      return {
        outlinePoints: [[points[0][0], points[0][1]]],
        dotRadius: size / 2,
      };
    }
    const outlinePoints = getStroke(points, {
      size,
      thinning: 0.05,
      smoothing: 0.65,
      streamline: 0.55,
      simulatePressure: false,
      start: { cap: true, taper: 0 },
      end: { cap: true, taper: 0 },
      last: isComplete,
    });
    return { outlinePoints, dotRadius: size / 2 };
  }

  const profile = getPenStrokeProfile(strokeWidth, penStyle);
  const totalLen = computePolylineLength(points);
  const firstPressure = points[0][2] > 0 ? points[0][2] : 0.5;
  const dotRadius = Math.max((profile.size * (0.72 + 0.28 * firstPressure)) / 2, 1.4);

  // Single tap or micro-movement: render a crisp round dot instead of letting taper/streamline collapse it
  if (points.length === 1 || totalLen < 1.2) {
    return {
      outlinePoints: [[points[0][0], points[0][1]]],
      dotRadius,
    };
  }

  // Only enable entry/exit taper on strokes long enough to preserve full round caps on short dots & accents
  const minTaperLength = Math.max(profile.size * 3.2, 18);
  const taperScale =
    totalLen < minTaperLength
      ? 0
      : Math.min(1, (totalLen - minTaperLength) / Math.max(profile.size * 2.5, 12));
  const hasRealPressure = points.some((p) => p[2] > 0 && p[2] !== 0.5);
  const outlinePoints = getStroke(points, {
    size: profile.size,
    thinning: profile.thinning,
    smoothing: profile.smoothing,
    streamline: profile.streamline,
    simulatePressure: !hasRealPressure,
    start: { cap: true, taper: profile.startTaper * taperScale },
    end: { cap: true, taper: profile.endTaper * taperScale },
    last: isComplete,
  });
  return { outlinePoints, dotRadius };
}

function applyStrokeFillStyle(
  ctx: CanvasRenderingContext2D,
  color: string,
  isHighlighter: boolean,
  isDarkMode: boolean,
  opacityMultiplier: number,
  penStyle?: PenStyle
) {
  if (isHighlighter) {
    ctx.globalAlpha = (isDarkMode ? 0.5 : 0.36) * opacityMultiplier;
    ctx.globalCompositeOperation = isDarkMode ? 'screen' : 'multiply';
    ctx.fillStyle = color;
    return;
  }

  const resolved = resolveColor(color, isDarkMode);
  if (penStyle === 'pencil') {
    ctx.globalAlpha = opacityMultiplier * 0.92;
    const grain = getPencilGrainPattern(ctx, resolved);
    ctx.fillStyle = grain ?? resolved;
    return;
  }

  ctx.globalAlpha = opacityMultiplier;
  ctx.fillStyle = resolved;
}

function drawStrokeElement(
  ctx: CanvasRenderingContext2D,
  el: StrokeElement,
  isDarkMode: boolean,
  opacityMultiplier = 1
) {
  if (!el.points || el.points.length === 0) return;

  const isHighlighter = el.type === 'highlighter';
  const cacheKey = `${isHighlighter ? 'h' : el.penStyle ?? 'legacy'}|${el.strokeWidth}|${el.points.length}`;
  let cached = strokePathCache.get(el);

  if (!cached || cached.key !== cacheKey) {
    const { outlinePoints, dotRadius } = computeStrokeOutline(
      el.points,
      el.strokeWidth,
      isHighlighter,
      el.penStyle,
      true
    );
    const path = buildStrokePath2D(outlinePoints, dotRadius);
    if (path) {
      cached = { key: cacheKey, path };
      strokePathCache.set(el, cached);
    } else {
      drawFreehandPoints(
        ctx,
        el.points,
        el.color,
        el.strokeWidth,
        isHighlighter,
        isDarkMode,
        opacityMultiplier,
        el.penStyle
      );
      return;
    }
  }

  ctx.save();
  applyStrokeFillStyle(
    ctx,
    el.color,
    isHighlighter,
    isDarkMode,
    opacityMultiplier,
    el.penStyle
  );
  ctx.fill(cached.path);
  ctx.restore();
}

export function drawFreehandPoints(
  ctx: CanvasRenderingContext2D,
  points: [number, number, number][],
  color: string,
  strokeWidth: number,
  isHighlighter: boolean,
  isDarkMode: boolean,
  opacityMultiplier = 1,
  penStyle?: PenStyle
) {
  if (!points || points.length === 0) return;

  ctx.save();
  applyStrokeFillStyle(ctx, color, isHighlighter, isDarkMode, opacityMultiplier, penStyle);
  const { outlinePoints, dotRadius } = computeStrokeOutline(
    points,
    strokeWidth,
    isHighlighter,
    penStyle,
    true
  );
  drawSmoothStrokePolygon(ctx, outlinePoints, dotRadius);
  ctx.restore();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (para === '') {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !currentLine) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  return lines;
}

export function drawBoardElement(
  ctx: CanvasRenderingContext2D,
  el: BoardElement,
  options: {
    isDarkMode: boolean;
    assets: Record<string, string>;
    preloadedImages?: Map<string, HTMLImageElement>;
    dimmed?: boolean;
    editingId?: string | null;
    renderFormulasOnCanvas?: boolean;
    displayScale?: number;
    lowQualityImages?: boolean;
  }
) {
  const {
    isDarkMode,
    assets,
    preloadedImages,
    dimmed = false,
    editingId,
    renderFormulasOnCanvas = false,
    displayScale,
    lowQualityImages = false,
  } = options;
  const opacity = (el.opacity ?? 1) * (dimmed ? 0.25 : 1);

  if (el.type === 'stroke' || el.type === 'highlighter') {
    drawStrokeElement(ctx, el, isDarkMode, opacity);
    return;
  }

  ctx.save();
  ctx.globalAlpha = opacity;

  if (el.type === 'rectangle') {
    const strokeCol = resolveColor(el.color, isDarkMode);
    drawRoundedRectPath(ctx, el.x, el.y, el.width, el.height, 10);
    if (el.fillColor && el.fillColor !== 'transparent') {
      ctx.fillStyle = el.fillColor;
      ctx.fill();
    }
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  } else if (el.type === 'ellipse') {
    const strokeCol = resolveColor(el.color, isDarkMode);
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const rx = Math.max(Math.abs(el.width / 2), 0.5);
    const ry = Math.max(Math.abs(el.height / 2), 0.5);
    ctx.beginPath();
    if (el.sectorStartAngle !== undefined && el.sectorEndAngle !== undefined) {
      ctx.moveTo(cx, cy);
      ctx.ellipse(cx, cy, rx, ry, 0, el.sectorStartAngle, el.sectorEndAngle);
      ctx.closePath();
    } else {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
    if (el.fillColor && el.fillColor !== 'transparent') {
      ctx.fillStyle = el.fillColor;
      ctx.fill();
    }
    if (el.strokeWidth > 0) {
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = el.strokeWidth;
      ctx.stroke();
    }
  } else if (el.type === 'arrow' || el.type === 'line') {
    const strokeCol = resolveColor(el.color, isDarkMode);
    const { start, end } = getArrowEndpoints(el);
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (el.dashed) {
      ctx.setLineDash([7, 5]);
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);

    if (el.type === 'arrow' && dist > 4) {
      const angle = Math.atan2(dy, dx);
      const headLength = Math.min(Math.max(12 + el.strokeWidth * 2, 14), dist * 0.45);
      const shaftEndX = end.x - Math.cos(angle) * (headLength * 0.35);
      const shaftEndY = end.y - Math.sin(angle) * (headLength * 0.35);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(shaftEndX, shaftEndY);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLength * Math.cos(angle - Math.PI / 6.5),
        end.y - headLength * Math.sin(angle - Math.PI / 6.5)
      );
      ctx.lineTo(
        end.x - headLength * Math.cos(angle + Math.PI / 6.5),
        end.y - headLength * Math.sin(angle + Math.PI / 6.5)
      );
      ctx.closePath();
      ctx.fillStyle = strokeCol;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  } else if (el.type === 'formula') {
    if (renderFormulasOnCanvas) {
      const textCol = resolveColor(el.color, isDarkMode);
      const readable = latexToReadableMath(el.latex);
      ctx.fillStyle = textCol;
      ctx.font = `600 ${el.fontSize}px "Cambria Math", Georgia, serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(readable, el.x + el.width / 2, el.y + el.height / 2);
    }
  } else if (el.type === 'reveal') {
    const accent = resolveColor(el.color || '#4f46e5', isDarkMode);
    drawRoundedRectPath(ctx, el.x, el.y, el.width, el.height, 12);
    if (!el.revealed) {
      ctx.fillStyle = isDarkMode ? 'rgba(30, 41, 59, 0.96)' : 'rgba(226, 232, 240, 0.96)';
      ctx.fill();

      ctx.save();
      ctx.clip();
      ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.14)' : 'rgba(79, 70, 229, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let sx = el.x - el.height; sx < el.x + el.width + el.height; sx += 18) {
        ctx.moveTo(sx, el.y + el.height);
        ctx.lineTo(sx + el.height, el.y);
      }
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      drawRoundedRectPath(ctx, el.x, el.y, el.width, el.height, 12);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isDarkMode ? '#f1f5f9' : '#1e293b';
      ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${el.label || tr('Che lời giải', 'Solution curtain')} · ${tr('Nhấp đúp để mở', 'Double-click to reveal')}`,
        el.x + el.width / 2,
        el.y + el.height / 2
      );
    } else {
      ctx.fillStyle = isDarkMode ? 'rgba(79, 70, 229, 0.05)' : 'rgba(79, 70, 229, 0.04)';
      ctx.fill();
      ctx.strokeStyle = isDarkMode ? 'rgba(129, 140, 248, 0.45)' : 'rgba(79, 70, 229, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isDarkMode ? '#a5b4fc' : '#4f46e5';
      ctx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(tr('Đã mở (nhấp đúp để che lại)', 'Revealed (double-click to hide)'), el.x + 10, el.y + 6);
    }
  } else if (el.type === 'text') {
    if (editingId === el.id) {
      ctx.restore();
      return;
    }
    const textCol = resolveColor(el.color, isDarkMode);
    ctx.fillStyle = textCol;
    ctx.font = `500 ${el.fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    const maxW = Math.max(el.width - 8, 60);
    const lines = wrapTextLines(ctx, el.text || tr('Nhấp đúp để nhập chữ', 'Double-click to type'), maxW);
    const lineHeight = el.fontSize * 1.4;
    if (!el.text) {
      ctx.globalAlpha *= 0.45;
    }
    lines.forEach((line, idx) => {
      ctx.fillText(line, el.x + 4, el.y + 4 + idx * lineHeight);
    });
  } else if (el.type === 'sticky') {
    ctx.shadowColor = isDarkMode ? 'rgba(0, 0, 0, 0.45)' : 'rgba(15, 23, 42, 0.14)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = el.color;
    drawRoundedRectPath(ctx, el.x, el.y, el.width, el.height, 14);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (editingId !== el.id) {
      ctx.save();
      drawRoundedRectPath(ctx, el.x, el.y, el.width, el.height, 14);
      ctx.clip();

      ctx.fillStyle = '#1e293b';
      ctx.font = `500 ${el.fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      const pad = 16;
      const lines = wrapTextLines(
        ctx,
        el.text || tr('Nhấp đúp để viết ghi chú...', 'Double-click to write note...'),
        Math.max(el.width - pad * 2, 40)
      );
      if (!el.text) {
        ctx.globalAlpha *= 0.45;
      }
      const lineHeight = el.fontSize * 1.45;
      lines.forEach((line, idx) => {
        ctx.fillText(line, el.x + pad, el.y + pad + idx * lineHeight);
      });
      ctx.restore();
    }
  } else if (el.type === 'image') {
    const dataUrl = assets[el.assetId];
    const displayPixelWidth =
      displayScale !== undefined ? Math.abs(el.width) * displayScale : undefined;
    const img =
      preloadedImages?.get(el.assetId) ??
      (dataUrl ? getCachedImage(el.assetId, dataUrl, displayPixelWidth) : null);

    ctx.save();
    drawRoundedRectPath(ctx, el.x, el.y, el.width, el.height, 8);
    ctx.clip();
    if (img) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality =
        preloadedImages !== undefined
          ? 'high'
          : lowQualityImages
          ? 'low'
          : 'medium';
      ctx.drawImage(img, el.x, el.y, el.width, el.height);
    } else {
      ctx.fillStyle = isDarkMode ? '#1e293b' : '#e2e8f0';
      ctx.fillRect(el.x, el.y, el.width, el.height);
      ctx.fillStyle = isDarkMode ? '#94a3b8' : '#64748b';
      ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tr('Đang tải ảnh...', 'Loading image...'), el.x + el.width / 2, el.y + el.height / 2);
    }
    ctx.restore();

    ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)';
    ctx.lineWidth = 1;
    drawRoundedRectPath(ctx, el.x, el.y, el.width, el.height, 8);
    ctx.stroke();
  } else if (el.type === 'file-card') {
    const accentMap: Record<string, { bg: string; fg: string; label: string }> = {
      pdf: { bg: '#dc2626', fg: '#ffffff', label: 'PDF' },
      word: { bg: '#2563eb', fg: '#ffffff', label: 'DOCX' },
      sheet: { bg: '#059669', fg: '#ffffff', label: 'XLSX' },
      slide: { bg: '#d97706', fg: '#ffffff', label: 'PPTX' },
      text: { bg: '#475569', fg: '#ffffff', label: 'TXT' },
      other: { bg: '#64748b', fg: '#ffffff', label: 'FILE' },
    };
    const badge = accentMap[el.fileCategory] || accentMap.other;

    ctx.shadowColor = isDarkMode ? 'rgba(0, 0, 0, 0.45)' : 'rgba(15, 23, 42, 0.1)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = isDarkMode ? '#1e293b' : '#ffffff';
    drawRoundedRectPath(ctx, el.x, el.y, el.width, el.height, 14);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.25)' : 'rgba(15, 23, 42, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    drawRoundedRectPath(ctx, el.x, el.y, el.width, el.height, 14);
    ctx.clip();

    const tileX = el.x + 16;
    const tileY = el.y + 16;
    const tileW = 46;
    const tileH = 46;
    ctx.fillStyle = badge.bg;
    drawRoundedRectPath(ctx, tileX, tileY, tileW, tileH, 10);
    ctx.fill();

    ctx.fillStyle = badge.fg;
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge.label, tileX + tileW / 2, tileY + tileH / 2);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const textStartX = tileX + tileW + 14;
    const availW = Math.max(el.width - (tileW + 46), 60);

    ctx.fillStyle = isDarkMode ? '#f8fafc' : '#0f172a';
    ctx.font = '600 14px "Plus Jakarta Sans", system-ui, sans-serif';
    let displayName = el.fileName;
    while (displayName.length > 6 && ctx.measureText(displayName).width > availW) {
      displayName = displayName.slice(0, -2) + '…';
    }
    ctx.fillText(displayName, textStartX, tileY + 4);

    const kb = el.fileSize / 1024;
    const sizeStr =
      el.fileSize < 1024
        ? `${el.fileSize} B`
        : kb < 1024
        ? `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
        : `${(kb / 1024).toFixed(1)} MB`;
    const metaText = el.pageCount
      ? `${badge.label} · ${el.pageCount} ${tr('trang', 'pages')} · ${sizeStr}`
      : `${badge.label} · ${sizeStr}`;

    ctx.fillStyle = isDarkMode ? '#94a3b8' : '#64748b';
    ctx.font = '500 11.5px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(metaText, textStartX, tileY + 26);

    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.07)';
    ctx.beginPath();
    ctx.moveTo(el.x + 16, el.y + el.height - 34);
    ctx.lineTo(el.x + el.width - 16, el.y + el.height - 34);
    ctx.stroke();

    ctx.fillStyle = isDarkMode ? '#818cf8' : '#4f46e5';
    ctx.font = '500 11.5px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(tr('Nhấp đúp để xem nhanh hoặc tải tệp', 'Double-click to preview or download'), el.x + 16, el.y + el.height - 23);

    ctx.restore();
  }

  ctx.restore();
}
