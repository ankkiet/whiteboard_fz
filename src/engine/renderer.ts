import { getStroke } from 'perfect-freehand';
import {
  BoardElement,
  BoardPattern,
  BoardType,
  Camera,
  LaserPoint,
  NotebookPaperSize,
  Point,
  Rect,
} from '../types/board';
import { getArrowEndpoints } from './geometry';
import { getCachedImage, loadImageAsync } from './imageCache';
import {
  computeBoardExportBounds,
  computeOptimalExportDimensions,
  ExportQualityScale,
} from './exportUtils';
import { MATH_UNIT_PX } from './mathUtils';
import { latexToReadableMath } from './mathDisplay';
import { computeTotalNotebookPages, getNotebookConfig } from './notebookEngine';
import { jsPDF } from 'jspdf';

export const ADAPTIVE_INK = '#1e293b';

export function resolveColor(color: string, isDarkMode: boolean): string {
  if (isDarkMode && (color.toLowerCase() === '#1e293b' || color.toLowerCase() === '#0f172a' || color.toLowerCase() === '#000000')) {
    return '#f1f5f9';
  }
  if (!isDarkMode && color.toLowerCase() === '#f1f5f9') {
    return '#1e293b';
  }
  return color;
}

export function getCanvasBackgroundColor(isDarkMode: boolean, boardType?: BoardType): string {
  if (boardType === 'notebook') {
    return isDarkMode ? '#0b0f19' : '#eef1f6';
  }
  return isDarkMode ? '#0f172a' : '#f8fafc';
}

function pickCoordinateUnitStep(unitPxOnScreen: number): number {
  const candidates = [1, 2, 5, 10, 20, 50, 100];
  for (const c of candidates) {
    if (c * unitPxOnScreen >= 28) return c;
  }
  return 100;
}

/**
 * Draws background pattern directly in exact world coordinates so it stays
 * locked 1:1 with canvas objects across any Pan or Zoom level.
 */
export function drawWorldBackgroundPattern(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  pattern: BoardPattern,
  isDarkMode: boolean
) {
  if (pattern === 'plain') return;

  const baseStep = pattern === 'lined' ? 36 : 32;
  // Adaptive step doubling when zoomed far out so grid never becomes noisy soup
  let step = baseStep;
  while (step * camera.zoom < 14) {
    step *= 2;
  }

  const worldLeft = -camera.x / camera.zoom;
  const worldTop = -camera.y / camera.zoom;
  const worldRight = (viewportWidth - camera.x) / camera.zoom;
  const worldBottom = (viewportHeight - camera.y) / camera.zoom;

  const startX = Math.floor(worldLeft / step) * step;
  const startY = Math.floor(worldTop / step) * step;

  ctx.save();
  if (pattern === 'grid') {
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.11)' : 'rgba(15, 23, 42, 0.065)';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.beginPath();
    for (let x = startX; x <= worldRight; x += step) {
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x, worldBottom);
    }
    for (let y = startY; y <= worldBottom; y += step) {
      ctx.moveTo(worldLeft, y);
      ctx.lineTo(worldRight, y);
    }
    ctx.stroke();

    // Subtle major grid every 5 cells
    const majorStep = step * 5;
    const majorStartX = Math.floor(worldLeft / majorStep) * majorStep;
    const majorStartY = Math.floor(worldTop / majorStep) * majorStep;
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(15, 23, 42, 0.12)';
    ctx.beginPath();
    for (let x = majorStartX; x <= worldRight; x += majorStep) {
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x, worldBottom);
    }
    for (let y = majorStartY; y <= worldBottom; y += majorStep) {
      ctx.moveTo(worldLeft, y);
      ctx.lineTo(worldRight, y);
    }
    ctx.stroke();
  } else if (pattern === 'dots') {
    ctx.fillStyle = isDarkMode ? 'rgba(148, 163, 184, 0.28)' : 'rgba(15, 23, 42, 0.18)';
    const radius = Math.max(1.2 / camera.zoom, 0.9);
    for (let x = startX; x <= worldRight; x += step) {
      for (let y = startY; y <= worldBottom; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === 'lined') {
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(59, 130, 246, 0.15)';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.beginPath();
    for (let y = startY; y <= worldBottom; y += step) {
      ctx.moveTo(worldLeft, y);
      ctx.lineTo(worldRight, y);
    }
    ctx.stroke();
  } else if (pattern === 'coordinate') {
    const unitPx = MATH_UNIT_PX;
    const unitStep = pickCoordinateUnitStep(unitPx * camera.zoom);
    const minorWorldStep = unitStep * unitPx;
    const majorWorldStep = minorWorldStep * 5;

    const coordStartX = Math.floor(worldLeft / minorWorldStep) * minorWorldStep;
    const coordStartY = Math.floor(worldTop / minorWorldStep) * minorWorldStep;

    // Minor unit grid
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.09)' : 'rgba(15, 23, 42, 0.055)';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.beginPath();
    for (let x = coordStartX; x <= worldRight; x += minorWorldStep) {
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x, worldBottom);
    }
    for (let y = coordStartY; y <= worldBottom; y += minorWorldStep) {
      ctx.moveTo(worldLeft, y);
      ctx.lineTo(worldRight, y);
    }
    ctx.stroke();

    // Major grid every 5 unit steps
    const majorStartX = Math.floor(worldLeft / majorWorldStep) * majorWorldStep;
    const majorStartY = Math.floor(worldTop / majorWorldStep) * majorWorldStep;
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.18)' : 'rgba(15, 23, 42, 0.11)';
    ctx.beginPath();
    for (let x = majorStartX; x <= worldRight; x += majorWorldStep) {
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x, worldBottom);
    }
    for (let y = majorStartY; y <= worldBottom; y += majorWorldStep) {
      ctx.moveTo(worldLeft, y);
      ctx.lineTo(worldRight, y);
    }
    ctx.stroke();

    // Bold Ox (y = 0) and Oy (x = 0) axes
    const axisColor = isDarkMode ? '#cbd5e1' : '#334155';
    const labelColor = isDarkMode ? '#94a3b8' : '#475569';
    const invZoom = 1 / camera.zoom;
    const tickHalf = 4 * invZoom;
    const arrowLen = 11 * invZoom;
    const arrowHalfW = 4.5 * invZoom;

    ctx.strokeStyle = axisColor;
    ctx.fillStyle = axisColor;
    ctx.lineWidth = 1.75 * invZoom;

    const showXAxis = worldTop <= 0 && worldBottom >= 0;
    const showYAxis = worldLeft <= 0 && worldRight >= 0;

    if (showXAxis) {
      ctx.beginPath();
      ctx.moveTo(worldLeft, 0);
      ctx.lineTo(worldRight - arrowLen * 0.5, 0);
      ctx.stroke();

      // Right arrowhead on Ox
      const tipX = worldRight - 8 * invZoom;
      ctx.beginPath();
      ctx.moveTo(tipX, 0);
      ctx.lineTo(tipX - arrowLen, -arrowHalfW);
      ctx.lineTo(tipX - arrowLen, arrowHalfW);
      ctx.closePath();
      ctx.fill();
    }

    if (showYAxis) {
      ctx.beginPath();
      ctx.moveTo(0, worldBottom);
      ctx.lineTo(0, worldTop + arrowLen * 0.5);
      ctx.stroke();

      // Top arrowhead on Oy
      const tipY = worldTop + 8 * invZoom;
      ctx.beginPath();
      ctx.moveTo(0, tipY);
      ctx.lineTo(-arrowHalfW, tipY + arrowLen);
      ctx.lineTo(arrowHalfW, tipY + arrowLen);
      ctx.closePath();
      ctx.fill();
    }

    // Numeric ticks & labels
    const fontSize = 11 * invZoom;
    ctx.font = `500 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillStyle = labelColor;

    // Label step: ensure labels have comfortable breathing room (>= 36px on screen)
    const labelEvery = minorWorldStep * camera.zoom < 40 ? 2 : 1;
    const labelStepPx = minorWorldStep * labelEvery;

    if (showXAxis) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const firstTickX = Math.floor(worldLeft / labelStepPx) * labelStepPx;
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1.25 * invZoom;
      ctx.beginPath();
      for (let x = firstTickX; x <= worldRight - 28 * invZoom; x += labelStepPx) {
        const unitVal = Math.round(x / unitPx);
        if (unitVal === 0) continue;
        ctx.moveTo(x, -tickHalf);
        ctx.lineTo(x, tickHalf);
        ctx.fillText(String(unitVal), x, 7 * invZoom);
      }
      ctx.stroke();

      // Italic x axis label
      ctx.font = `italic 600 ${14 * invZoom}px Georgia, "Times New Roman", serif`;
      ctx.fillStyle = axisColor;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('x', worldRight - 14 * invZoom, -8 * invZoom);
    }

    if (showYAxis) {
      ctx.font = `500 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.fillStyle = labelColor;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const firstTickY = Math.floor(worldTop / labelStepPx) * labelStepPx;
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1.25 * invZoom;
      ctx.beginPath();
      for (let y = firstTickY; y <= worldBottom; y += labelStepPx) {
        if (y < worldTop + 28 * invZoom) continue;
        // Canvas Y downward => math Y is -y / unitPx
        const unitVal = Math.round(-y / unitPx);
        if (unitVal === 0) continue;
        ctx.moveTo(-tickHalf, y);
        ctx.lineTo(tickHalf, y);
        ctx.fillText(String(unitVal), -8 * invZoom, y);
      }
      ctx.stroke();

      // Italic y axis label
      ctx.font = `italic 600 ${14 * invZoom}px Georgia, "Times New Roman", serif`;
      ctx.fillStyle = axisColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('y', 10 * invZoom, worldTop + 12 * invZoom);
    }

    // Origin label O
    if (showXAxis && showYAxis) {
      ctx.font = `italic 600 ${13 * invZoom}px Georgia, "Times New Roman", serif`;
      ctx.fillStyle = axisColor;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('O', -7 * invZoom, 6 * invZoom);
    }
  } else if (pattern === 'isometric') {
    const isoStep = step * 1.15;
    const dx = isoStep * Math.cos(Math.PI / 6);
    const dy = isoStep * Math.sin(Math.PI / 6);
    const slope = dy / dx; // tan(30 deg)
    const spanY = worldBottom - worldTop;
    const extraX = spanY / slope + dx * 2;

    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.beginPath();

    // Vertical lines
    const vStart = Math.floor(worldLeft / dx) * dx;
    for (let x = vStart; x <= worldRight; x += dx) {
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x, worldBottom);
    }

    // +30 deg and -30 deg diagonal families
    const diagStep = isoStep;
    const yStart = Math.floor((worldTop - extraX * slope) / diagStep) * diagStep;
    const yEnd = worldBottom + extraX * slope;
    for (let y0 = yStart; y0 <= yEnd; y0 += diagStep) {
      ctx.moveTo(worldLeft, y0 + worldLeft * slope);
      ctx.lineTo(worldRight, y0 + worldRight * slope);

      ctx.moveTo(worldLeft, y0 - worldLeft * slope);
      ctx.lineTo(worldRight, y0 - worldRight * slope);
    }
    ctx.stroke();
  } else if (pattern === 'polar') {
    const ringStep = MATH_UNIT_PX;
    const maxR =
      Math.hypot(
        Math.max(Math.abs(worldLeft), Math.abs(worldRight)),
        Math.max(Math.abs(worldTop), Math.abs(worldBottom))
      ) + ringStep;
    const invZoom = 1 / camera.zoom;

    // Concentric rings
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.085)';
    ctx.lineWidth = 1 * invZoom;
    const ringCount = Math.min(40, Math.ceil(maxR / ringStep));
    for (let i = 1; i <= ringCount; i += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, i * ringStep, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Radial spokes every 15 degrees
    ctx.beginPath();
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(rad) * maxR, Math.sin(rad) * maxR);
    }
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.075)';
    ctx.stroke();

    // Principal polar axis (0° & 90°)
    ctx.strokeStyle = isDarkMode ? '#94a3b8' : '#475569';
    ctx.lineWidth = 1.5 * invZoom;
    ctx.beginPath();
    ctx.moveTo(-maxR, 0);
    ctx.lineTo(maxR, 0);
    ctx.moveTo(0, -maxR);
    ctx.lineTo(0, maxR);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws the structured notebook layout:
 * - Clean paper sheets for continuous pages (separated only by a horizontal dividing line)
 * - Distinct left margin rule (red) and right margin guide (dashed)
 * - Top and bottom horizontal margins for each page
 * - Ruled handwriting lines
 * - Page number indicator at the top right of each page and horizontal divider line at the end of each page
 */
export function drawNotebookLayout(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  isDarkMode: boolean,
  elements: BoardElement[],
  paperSize: NotebookPaperSize = 'a4',
  notebookTitle?: string
) {
  const config = getNotebookConfig(paperSize);
  const totalPages = computeTotalNotebookPages(elements, camera, viewportHeight, config);

  const safeZoom = Math.max(0.1, camera.zoom);
  const worldTop = -camera.y / safeZoom;
  const worldBottom = (viewportHeight - camera.y) / safeZoom;

  ctx.save();

  for (let p = 0; p < totalPages; p++) {
    const pageY = p * config.height;
    const pageBottom = pageY + config.height;

    // Viewport culling: only draw pages that intersect with visible viewport
    if (pageBottom < worldTop - 100 || pageY > worldBottom + 100) {
      continue;
    }

    // 1. Paper drop shadow
    if (!isDarkMode) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(2, pageY + 3, config.width + 4, config.height + 4);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
      ctx.fillRect(4, pageY + 6, config.width + 8, config.height + 6);
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(2, pageY + 2, config.width + 4, config.height + 4);
    }

    // 2. Paper background
    ctx.fillStyle = isDarkMode ? '#1e293b' : '#ffffff';
    ctx.fillRect(0, pageY, config.width, config.height);

    // 3. Subtle page border
    ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1 / safeZoom;
    ctx.strokeRect(0, pageY, config.width, config.height);

    // 4. Subtle notebook spine shading on the left edge (0 to 10px)
    const spineGrad = ctx.createLinearGradient(0, pageY, 10, pageY);
    spineGrad.addColorStop(0, isDarkMode ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.07)');
    spineGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spineGrad;
    ctx.fillRect(0, pageY, 10, config.height);

    // 5. Ruled lines (dòng kẻ ngang)
    const lineStartY = pageY + config.marginTop;
    const lineEndY = pageBottom - config.marginBottom;
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.22)' : 'rgba(59, 130, 246, 0.24)';
    ctx.lineWidth = 1 / safeZoom;
    ctx.beginPath();
    for (let y = lineStartY; y <= lineEndY; y += config.lineSpacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(config.width - config.marginRight, y);
    }
    ctx.stroke();

    // 6. Left vertical margin line (lề trái đỏ/hồng nhạt - đặc trưng vở kẻ ngang)
    ctx.strokeStyle = isDarkMode ? 'rgba(244, 63, 94, 0.65)' : 'rgba(239, 68, 68, 0.55)';
    ctx.lineWidth = 1.2 / safeZoom;
    ctx.beginPath();
    ctx.moveTo(config.marginLeft, pageY);
    ctx.lineTo(config.marginLeft, pageBottom);
    ctx.stroke();

    // 7. Right vertical margin line (lề phải nét đứt mờ)
    const rightMarginX = config.width - config.marginRight;
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 0.9 / safeZoom;
    ctx.setLineDash([4 / safeZoom, 4 / safeZoom]);
    ctx.beginPath();
    ctx.moveTo(rightMarginX, pageY);
    ctx.lineTo(rightMarginX, pageBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // 8. Page header (vùng lề trên: chỉ hiển thị tên sổ ghi chép)
    ctx.fillStyle = isDarkMode ? 'rgba(148, 163, 184, 0.65)' : 'rgba(100, 116, 139, 0.7)';
    ctx.font = '500 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayTitle = (notebookTitle && notebookTitle.trim()) || 'Vở ghi chép';
    ctx.fillText(displayTitle, config.marginLeft + 6, pageY + config.marginTop * 0.45);

    ctx.textAlign = 'right';
    ctx.fillText(`Trang ${p + 1}`, rightMarginX - 4, pageY + config.marginTop * 0.45);

    // 9. Horizontal dividing line at the end of page ("ngăn cách bằng dòng gạch ngang thôi")
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.55)' : 'rgba(100, 116, 139, 0.45)';
    ctx.lineWidth = 1.5 / safeZoom;
    ctx.setLineDash([6 / safeZoom, 4 / safeZoom]);
    ctx.beginPath();
    ctx.moveTo(0, pageBottom);
    ctx.lineTo(config.width, pageBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Page break badge centered on divider
    const badgeText = `Hết trang ${p + 1}`;
    ctx.font = '600 10.5px system-ui, -apple-system, sans-serif';
    const textMetrics = ctx.measureText(badgeText);
    const badgeW = textMetrics.width + 20;
    const badgeH = 18;
    const badgeX = (config.width - badgeW) / 2;
    const badgeY = pageBottom - badgeH / 2;

    ctx.fillStyle = isDarkMode ? '#0f172a' : '#f1f5f9';
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 1 / safeZoom;

    // Rounded pill rect
    const r = 9;
    ctx.beginPath();
    ctx.moveTo(badgeX + r, badgeY);
    ctx.lineTo(badgeX + badgeW - r, badgeY);
    ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + r);
    ctx.lineTo(badgeX + badgeW, badgeY + badgeH - r);
    ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - r, badgeY + badgeH);
    ctx.lineTo(badgeX + r, badgeY + badgeH);
    ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - r);
    ctx.lineTo(badgeX, badgeY + r);
    ctx.quadraticCurveTo(badgeX, badgeY, badgeX + r, badgeY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isDarkMode ? '#94a3b8' : '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, config.width / 2, pageBottom);
  }

  ctx.restore();
}

function drawSmoothStrokePolygon(ctx: CanvasRenderingContext2D, outlinePoints: number[][]) {
  if (outlinePoints.length === 0) return;

  ctx.beginPath();
  if (outlinePoints.length === 1) {
    ctx.arc(outlinePoints[0][0], outlinePoints[0][1], 1.5, 0, Math.PI * 2);
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

export function drawFreehandPoints(
  ctx: CanvasRenderingContext2D,
  points: [number, number, number][],
  color: string,
  strokeWidth: number,
  isHighlighter: boolean,
  isDarkMode: boolean,
  opacityMultiplier = 1
) {
  if (!points || points.length === 0) return;

  ctx.save();
  if (isHighlighter) {
    ctx.globalAlpha = (isDarkMode ? 0.5 : 0.36) * opacityMultiplier;
    ctx.globalCompositeOperation = isDarkMode ? 'screen' : 'multiply';
    const outlinePoints = getStroke(points, {
      size: Math.max(strokeWidth * 3.5, 16),
      thinning: 0.05,
      smoothing: 0.65,
      streamline: 0.55,
      simulatePressure: false,
      start: { cap: true, taper: 0 },
      end: { cap: true, taper: 0 },
    });
    ctx.fillStyle = color;
    drawSmoothStrokePolygon(ctx, outlinePoints);
  } else {
    ctx.globalAlpha = opacityMultiplier;
    const hasRealPressure = points.some((p) => p[2] > 0 && p[2] !== 0.5);
    const outlinePoints = getStroke(points, {
      size: Math.max(strokeWidth * 1.45, 2.5),
      thinning: 0.55,
      smoothing: 0.55,
      streamline: 0.5,
      simulatePressure: !hasRealPressure,
      start: { cap: true, taper: 0 },
      end: { cap: true, taper: 0 },
    });
    ctx.fillStyle = resolveColor(color, isDarkMode);
    drawSmoothStrokePolygon(ctx, outlinePoints);
  }
  ctx.restore();
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
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
  }
) {
  const {
    isDarkMode,
    assets,
    preloadedImages,
    dimmed = false,
    editingId,
    renderFormulasOnCanvas = false,
  } = options;
  const opacity = (el.opacity ?? 1) * (dimmed ? 0.25 : 1);

  if (el.type === 'stroke' || el.type === 'highlighter') {
    drawFreehandPoints(
      ctx,
      el.points,
      el.color,
      el.strokeWidth,
      el.type === 'highlighter',
      isDarkMode,
      opacity
    );
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
      // Shorten shaft slightly so stroke cap doesn't poke past sharp arrowhead tip
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

      // Subtle diagonal stripe hatch
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
        `${el.label || 'Che lời giải'} · Nhấp đúp để mở`,
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
      ctx.fillText('Đã mở (nhấp đúp để che lại)', el.x + 10, el.y + 6);
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
    const lines = wrapTextLines(ctx, el.text || 'Nhấp đúp để nhập chữ', maxW);
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

    // Subtle border & top strip
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
      const lines = wrapTextLines(ctx, el.text || 'Nhấp đúp để viết ghi chú...', Math.max(el.width - pad * 2, 40));
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
    const img = preloadedImages?.get(el.assetId) ?? (dataUrl ? getCachedImage(el.assetId, dataUrl) : null);

    ctx.save();
    drawRoundedRectPath(ctx, el.x, el.y, el.width, el.height, 8);
    ctx.clip();
    if (img) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, el.x, el.y, el.width, el.height);
    } else {
      ctx.fillStyle = isDarkMode ? '#1e293b' : '#e2e8f0';
      ctx.fillRect(el.x, el.y, el.width, el.height);
      ctx.fillStyle = isDarkMode ? '#94a3b8' : '#64748b';
      ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Đang tải ảnh...', el.x + el.width / 2, el.y + el.height / 2);
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

    // Format icon tile
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

    // File name & metadata
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

    // Metadata line
    const kb = el.fileSize / 1024;
    const sizeStr =
      el.fileSize < 1024
        ? `${el.fileSize} B`
        : kb < 1024
        ? `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
        : `${(kb / 1024).toFixed(1)} MB`;
    const metaText = el.pageCount
      ? `${badge.label} · ${el.pageCount} trang · ${sizeStr}`
      : `${badge.label} · ${sizeStr}`;

    ctx.fillStyle = isDarkMode ? '#94a3b8' : '#64748b';
    ctx.font = '500 11.5px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(metaText, textStartX, tileY + 26);

    // Optional snippet or action footer
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.07)';
    ctx.beginPath();
    ctx.moveTo(el.x + 16, el.y + el.height - 34);
    ctx.lineTo(el.x + el.width - 16, el.y + el.height - 34);
    ctx.stroke();

    ctx.fillStyle = isDarkMode ? '#818cf8' : '#4f46e5';
    ctx.font = '500 11.5px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Nhấp đúp để xem nhanh hoặc tải tệp', el.x + 16, el.y + el.height - 23);

    ctx.restore();
  }

  ctx.restore();
}

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

  // Subtle frosted whiteboard-eraser fill that warms slightly as shake-to-grow activates
  if (isActive) {
    const fillAlpha = 0.14 + clampedIntensity * 0.1;
    ctx.fillStyle = `rgba(239, 68, 68, ${fillAlpha.toFixed(3)})`;
  } else {
    ctx.fillStyle = isDarkMode
      ? 'rgba(248, 250, 252, 0.1)'
      : 'rgba(15, 23, 42, 0.06)';
  }
  ctx.fill();

  // Outer contrast halo so the square stays crisp over dark ink or light paper
  ctx.strokeStyle = isDarkMode ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 3 / zoom;
  ctx.stroke();

  // Inner crisp square border
  ctx.strokeStyle = isActive
    ? clampedIntensity > 0.35
      ? 'rgba(220, 38, 38, 0.96)'
      : 'rgba(239, 68, 68, 0.9)'
    : isDarkMode
    ? 'rgba(226, 232, 240, 0.85)'
    : 'rgba(51, 65, 85, 0.78)';
  ctx.lineWidth = (1.6 + clampedIntensity * 0.7) / zoom;
  ctx.stroke();

  // Precision center marker
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

  // Subtle translucent fill matching the actual ink or highlighter tint
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, displayRadius, 0, Math.PI * 2);
  ctx.fillStyle = resolved;
  ctx.globalAlpha = isHighlighter ? (isDrawing ? 0.25 : 0.36) : isDrawing ? 0.22 : 0.32;
  ctx.fill();

  // Outer contrast halo so the nib remains readable over any background or ink
  ctx.globalAlpha = 1;
  ctx.strokeStyle = isDarkMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 2.6 / zoom;
  ctx.stroke();

  // Crisp inner ring in ink color (or slate contrast for light highlighters)
  ctx.strokeStyle = isHighlighter
    ? isDarkMode
      ? 'rgba(248, 250, 252, 0.85)'
      : 'rgba(15, 23, 42, 0.65)'
    : resolved;
  ctx.lineWidth = 1.35 / zoom;
  ctx.stroke();

  // Precision center pinpoint for small/medium pen nibs when not actively dragging
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

    // Outer crimson glow
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.92})`;
    ctx.lineWidth = (3 + 7 * rawT) / zoom;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 18;
    ctx.stroke();

    // Hot bright core
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.strokeStyle = `rgba(255, 241, 242, ${alpha})`;
    ctx.lineWidth = (1.5 + 2.8 * rawT) / zoom;
    ctx.shadowBlur = 0;
    ctx.stroke();
  }

  // Bright tip at the most recent point
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

export interface ExportPngResult {
  blob: Blob;
  pixelWidth: number;
  pixelHeight: number;
  effectiveScale: number;
  wasClamped: boolean;
}

export type PdfPageLayout = 'fit' | 'a4-landscape' | 'a4-portrait';

export interface ExportPdfOptions {
  elements: BoardElement[];
  assets: Record<string, string>;
  isDarkMode: boolean;
  boardPattern: BoardPattern;
  boardType?: BoardType;
  notebookPaperSize?: NotebookPaperSize;
  includeBackground: boolean;
  includePattern: boolean;
  scale?: ExportQualityScale;
  layout?: PdfPageLayout;
  title?: string;
}

export interface ExportPdfResult {
  blob: Blob;
  pageCount: number;
  widthPt: number;
  heightPt: number;
}

export interface RenderOffscreenOptions {
  elements: BoardElement[];
  assets: Record<string, string>;
  isDarkMode: boolean;
  boardPattern: BoardPattern;
  boardType?: BoardType;
  notebookPaperSize?: NotebookPaperSize;
  includeBackground: boolean;
  includePattern: boolean;
  scale?: ExportQualityScale;
  customBounds?: { minX: number; minY: number; width: number; height: number; padding: number };
  title?: string;
}

export async function renderBoardToOffscreenCanvas(options: RenderOffscreenOptions): Promise<{
  canvas: HTMLCanvasElement;
  pixelWidth: number;
  pixelHeight: number;
  effectiveScale: number;
  wasClamped: boolean;
  width: number;
  height: number;
}> {
  const {
    elements,
    assets,
    isDarkMode,
    boardPattern,
    boardType,
    notebookPaperSize,
    includeBackground,
    includePattern,
    scale: requestedScale = 4,
    customBounds,
    title,
  } = options;

  // Ensure web fonts are loaded so exported typography is razor-sharp
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // fallback to system fonts if FontFaceSet rejects
    }
  }

  const { minX, minY, width, height, padding } = customBounds || computeBoardExportBounds(elements, 64);
  const { pixelWidth, pixelHeight, effectiveScale, wasClamped } =
    computeOptimalExportDimensions(width, height, requestedScale);

  const canvas = document.createElement('canvas');
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Không thể khởi tạo Canvas xuất dữ liệu.');

  // Preload all referenced images cleanly at full native resolution before drawing
  const preloadedImages = new Map<string, HTMLImageElement>();
  const imageEls = elements.filter((e) => e.type === 'image');
  await Promise.all(
    imageEls.map(async (el) => {
      if (el.type === 'image' && assets[el.assetId]) {
        try {
          const img = await loadImageAsync(assets[el.assetId]);
          preloadedImages.set(el.assetId, img);
        } catch {
          // ignore broken image
        }
      }
    })
  );

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(effectiveScale, effectiveScale);

  if (includeBackground) {
    ctx.fillStyle = getCanvasBackgroundColor(isDarkMode, boardType);
    ctx.fillRect(0, 0, width, height);
  }

  const exportCamera: Camera = {
    x: -minX + padding,
    y: -minY + padding,
    zoom: 1,
  };

  ctx.save();
  ctx.translate(exportCamera.x, exportCamera.y);

  if (includeBackground && includePattern) {
    if (boardType === 'notebook') {
      drawNotebookLayout(ctx, exportCamera, width, height, isDarkMode, elements, notebookPaperSize, title);
    } else if (boardPattern !== 'plain') {
      drawWorldBackgroundPattern(ctx, exportCamera, width, height, boardPattern, isDarkMode);
    }
  }

  const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  for (const el of sorted) {
    drawBoardElement(ctx, el, {
      isDarkMode,
      assets,
      preloadedImages,
      renderFormulasOnCanvas: true,
    });
  }

  ctx.restore();

  return {
    canvas,
    pixelWidth,
    pixelHeight,
    effectiveScale,
    wasClamped,
    width,
    height,
  };
}

export async function exportBoardToPng(options: {
  elements: BoardElement[];
  assets: Record<string, string>;
  isDarkMode: boolean;
  boardPattern: BoardPattern;
  boardType?: BoardType;
  notebookPaperSize?: NotebookPaperSize;
  includeBackground: boolean;
  includePattern: boolean;
  scale?: ExportQualityScale;
}): Promise<ExportPngResult> {
  const { canvas, pixelWidth, pixelHeight, effectiveScale, wasClamped } =
    await renderBoardToOffscreenCanvas(options);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Không thể nén ảnh PNG chất lượng cao.'));
        }
      },
      'image/png'
    );
  });

  return {
    blob,
    pixelWidth,
    pixelHeight,
    effectiveScale,
    wasClamped,
  };
}

export async function exportBoardToPdf(options: ExportPdfOptions): Promise<ExportPdfResult> {
  const {
    elements,
    boardType,
    notebookPaperSize,
    layout = 'fit',
    title,
  } = options;

  // Trường hợp 1: Vở ghi chép nhiều trang (Xuất từng trang A4 dọc đúng chuẩn trang vở)
  if (boardType === 'notebook' && layout !== 'fit') {
    const config = getNotebookConfig(notebookPaperSize);
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    const totalPages = Math.min(
      50,
      computeTotalNotebookPages(elements, camera, 800, config)
    );

    const a4WidthPt = 595.28;
    const a4HeightPt = 841.89;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true,
    });

    if (title) {
      doc.setProperties({
        title,
        creator: 'Bảng Trắng Thông Minh',
      });
    }

    for (let p = 0; p < totalPages; p++) {
      if (p > 0) {
        doc.addPage('a4', 'portrait');
      }

      const pageBounds = {
        minX: 0,
        minY: p * config.height,
        width: config.width,
        height: config.height,
        padding: 0,
      };

      const rendered = await renderBoardToOffscreenCanvas({
        ...options,
        scale: 2, // 2x gives 300+ DPI on A4 with fast compression
        customBounds: pageBounds,
      });

      doc.addImage(rendered.canvas, 'PNG', 0, 0, a4WidthPt, a4HeightPt, undefined, 'FAST');
    }

    const blob = doc.output('blob');
    return {
      blob,
      pageCount: totalPages,
      widthPt: a4WidthPt,
      heightPt: a4HeightPt,
    };
  }

  // Trường hợp 2: Bảng tiêu chuẩn, bảng toán, sơ đồ tư duy hoặc Vừa vặn nội dung
  const { canvas, pixelWidth, pixelHeight, width, height } =
    await renderBoardToOffscreenCanvas(options);

  let doc: jsPDF;
  let finalWidthPt: number;
  let finalHeightPt: number;

  if (layout === 'a4-landscape') {
    finalWidthPt = 841.89;
    finalHeightPt = 595.28;
    doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
      compress: true,
    });
    const margin = 24;
    const availW = finalWidthPt - margin * 2;
    const availH = finalHeightPt - margin * 2;
    const ratio = Math.min(availW / pixelWidth, availH / pixelHeight);
    const drawW = pixelWidth * ratio;
    const drawH = pixelHeight * ratio;
    const posX = (finalWidthPt - drawW) / 2;
    const posY = (finalHeightPt - drawH) / 2;
    doc.addImage(canvas, 'PNG', posX, posY, drawW, drawH, undefined, 'FAST');
  } else if (layout === 'a4-portrait') {
    finalWidthPt = 595.28;
    finalHeightPt = 841.89;
    doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true,
    });
    const margin = 24;
    const availW = finalWidthPt - margin * 2;
    const availH = finalHeightPt - margin * 2;
    const ratio = Math.min(availW / pixelWidth, availH / pixelHeight);
    const drawW = pixelWidth * ratio;
    const drawH = pixelHeight * ratio;
    const posX = (finalWidthPt - drawW) / 2;
    const posY = (finalHeightPt - drawH) / 2;
    doc.addImage(canvas, 'PNG', posX, posY, drawW, drawH, undefined, 'FAST');
  } else {
    // layout === 'fit': Khổ giấy PDF tự động ôm sát chính xác tỉ lệ nội dung vẽ
    const widthPt = Math.max(100, Math.min(14400, Math.round(width * 0.75)));
    const heightPt = Math.max(100, Math.min(14400, Math.round(height * 0.75)));
    finalWidthPt = widthPt;
    finalHeightPt = heightPt;

    const orientation = widthPt >= heightPt ? 'landscape' : 'portrait';
    doc = new jsPDF({
      orientation,
      unit: 'pt',
      format: [widthPt, heightPt],
      compress: true,
    });
    doc.addImage(canvas, 'PNG', 0, 0, widthPt, heightPt, undefined, 'FAST');
  }

  if (title) {
    doc.setProperties({
      title,
      creator: 'Bảng Trắng Thông Minh',
    });
  }

  const blob = doc.output('blob');
  return {
    blob,
    pageCount: 1,
    widthPt: finalWidthPt,
    heightPt: finalHeightPt,
  };
}
