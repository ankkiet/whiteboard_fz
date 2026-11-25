import {
  BoardElement,
  BoardPattern,
  BoardType,
  Camera,
  NotebookPaperSize,
} from '../types/board';
import { MATH_UNIT_PX } from './mathUtils';
import {
  computeTotalNotebookPages,
  getNotebookConfig,
  normalizeNotebookPaperStyle,
} from './notebookEngine';
import { tr } from '../i18n';

export const ADAPTIVE_INK = '#1e293b';

export function resolveColor(color: string, isDarkMode: boolean): string {
  if (
    isDarkMode &&
    (color.toLowerCase() === '#1e293b' ||
      color.toLowerCase() === '#0f172a' ||
      color.toLowerCase() === '#000000')
  ) {
    return '#f1f5f9';
  }
  if (!isDarkMode && color.toLowerCase() === '#f1f5f9') {
    return '#1e293b';
  }
  return color;
}

export function getCanvasBackgroundColor(isDarkMode: boolean, boardType?: BoardType): string {
  if (boardType === 'notebook') {
    return isDarkMode ? '#0f0f10' : '#f1f1f3';
  }
  return isDarkMode ? '#141415' : '#fafafa';
}

export function drawRoundedRectPath(
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
    ctx.strokeStyle = isDarkMode ? 'rgba(237, 237, 237, 0.065)' : 'rgba(23, 23, 23, 0.055)';
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

    const majorStep = step * 5;
    const majorStartX = Math.floor(worldLeft / majorStep) * majorStep;
    const majorStartY = Math.floor(worldTop / majorStep) * majorStep;
    ctx.strokeStyle = isDarkMode ? 'rgba(237, 237, 237, 0.13)' : 'rgba(23, 23, 23, 0.105)';
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
    ctx.fillStyle = isDarkMode ? 'rgba(237, 237, 237, 0.22)' : 'rgba(23, 23, 23, 0.16)';
    const radius = Math.max(1.2 / camera.zoom, 0.9);
    for (let x = startX; x <= worldRight; x += step) {
      for (let y = startY; y <= worldBottom; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === 'lined') {
    ctx.strokeStyle = isDarkMode ? 'rgba(237, 237, 237, 0.11)' : 'rgba(59, 130, 246, 0.14)';
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

    ctx.strokeStyle = isDarkMode ? 'rgba(237, 237, 237, 0.055)' : 'rgba(23, 23, 23, 0.05)';
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

    const majorStartX = Math.floor(worldLeft / majorWorldStep) * majorWorldStep;
    const majorStartY = Math.floor(worldTop / majorWorldStep) * majorWorldStep;
    ctx.strokeStyle = isDarkMode ? 'rgba(237, 237, 237, 0.12)' : 'rgba(23, 23, 23, 0.095)';
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

      const tipY = worldTop + 8 * invZoom;
      ctx.beginPath();
      ctx.moveTo(0, tipY);
      ctx.lineTo(-arrowHalfW, tipY + arrowLen);
      ctx.lineTo(arrowHalfW, tipY + arrowLen);
      ctx.closePath();
      ctx.fill();
    }

    const fontSize = 11 * invZoom;
    ctx.font = `500 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillStyle = labelColor;

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
        const unitVal = Math.round(-y / unitPx);
        if (unitVal === 0) continue;
        ctx.moveTo(-tickHalf, y);
        ctx.lineTo(tickHalf, y);
        ctx.fillText(String(unitVal), -8 * invZoom, y);
      }
      ctx.stroke();

      ctx.font = `italic 600 ${14 * invZoom}px Georgia, "Times New Roman", serif`;
      ctx.fillStyle = axisColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('y', 10 * invZoom, worldTop + 12 * invZoom);
    }

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
    const slope = dy / dx;
    const spanY = worldBottom - worldTop;
    const extraX = spanY / slope + dx * 2;

    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.beginPath();

    const vStart = Math.floor(worldLeft / dx) * dx;
    for (let x = vStart; x <= worldRight; x += dx) {
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x, worldBottom);
    }

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

    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.085)';
    ctx.lineWidth = 1 * invZoom;
    const ringCount = Math.min(40, Math.ceil(maxR / ringStep));
    for (let i = 1; i <= ringCount; i += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, i * ringStep, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(rad) * maxR, Math.sin(rad) * maxR);
    }
    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.075)';
    ctx.stroke();

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

export function drawNotebookLayout(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  isDarkMode: boolean,
  elements: BoardElement[],
  paperSize: NotebookPaperSize = 'a4',
  notebookTitle?: string,
  paperPattern: BoardPattern = 'lined'
) {
  const config = getNotebookConfig(paperSize);
  const paperStyle = normalizeNotebookPaperStyle(paperPattern);
  const totalPages = computeTotalNotebookPages(elements, camera, viewportHeight, config);

  const safeZoom = Math.max(0.1, camera.zoom);
  const worldTop = -camera.y / safeZoom;
  const worldBottom = (viewportHeight - camera.y) / safeZoom;

  ctx.save();

  for (let p = 0; p < totalPages; p++) {
    const pageY = p * config.height;
    const pageBottom = pageY + config.height;

    if (pageBottom < worldTop - 100 || pageY > worldBottom + 100) {
      continue;
    }

    if (!isDarkMode) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(2, pageY + 3, config.width + 4, config.height + 4);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
      ctx.fillRect(4, pageY + 6, config.width + 8, config.height + 6);
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(2, pageY + 2, config.width + 4, config.height + 4);
    }

    ctx.fillStyle = isDarkMode ? '#1e293b' : '#ffffff';
    ctx.fillRect(0, pageY, config.width, config.height);

    ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1 / safeZoom;
    ctx.strokeRect(0, pageY, config.width, config.height);

    const spineGrad = ctx.createLinearGradient(0, pageY, 10, pageY);
    spineGrad.addColorStop(0, isDarkMode ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.07)');
    spineGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spineGrad;
    ctx.fillRect(0, pageY, 10, config.height);

    const lineStartY = pageY + config.marginTop;
    const lineEndY = pageBottom - config.marginBottom;
    const rightMarginX = config.width - config.marginRight;
    const step = config.lineSpacing;

    if (paperStyle === 'lined') {
      ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.22)' : 'rgba(59, 130, 246, 0.24)';
      ctx.lineWidth = 1 / safeZoom;
      ctx.beginPath();
      for (let y = lineStartY; y <= lineEndY; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(rightMarginX, y);
      }
      ctx.stroke();
    } else if (paperStyle === 'grid') {
      const rowCount = Math.floor((lineEndY - lineStartY) / step);
      const lastGridY = lineStartY + rowCount * step;
      const subStep = step / 2;

      if (subStep * safeZoom >= 7) {
        ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.10)' : 'rgba(59, 130, 246, 0.11)';
        ctx.lineWidth = 0.75 / safeZoom;
        ctx.beginPath();
        for (let y = lineStartY + subStep; y < lastGridY; y += step) {
          ctx.moveTo(0, y);
          ctx.lineTo(rightMarginX, y);
        }
        for (let x = config.marginLeft + subStep; x < rightMarginX; x += step) {
          ctx.moveTo(x, lineStartY);
          ctx.lineTo(x, lastGridY);
        }
        for (let x = config.marginLeft - subStep; x > 0; x -= step) {
          ctx.moveTo(x, lineStartY);
          ctx.lineTo(x, lastGridY);
        }
        ctx.stroke();
      }

      ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.24)' : 'rgba(59, 130, 246, 0.26)';
      ctx.lineWidth = 1 / safeZoom;
      ctx.beginPath();
      for (let y = lineStartY; y <= lastGridY + 0.5; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(rightMarginX, y);
      }
      for (let x = config.marginLeft; x <= rightMarginX + 0.5; x += step) {
        ctx.moveTo(x, lineStartY);
        ctx.lineTo(x, lastGridY);
      }
      for (let x = config.marginLeft - step; x > 0; x -= step) {
        ctx.moveTo(x, lineStartY);
        ctx.lineTo(x, lastGridY);
      }
      ctx.stroke();
    } else if (paperStyle === 'dots') {
      const dotStep = step;
      const radius = Math.max(1.1 / safeZoom, 0.85);
      ctx.fillStyle = isDarkMode ? 'rgba(148, 163, 184, 0.34)' : 'rgba(59, 130, 246, 0.32)';
      for (let y = lineStartY; y <= lineEndY; y += dotStep) {
        for (let x = config.marginLeft; x <= rightMarginX; x += dotStep) {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.strokeStyle = isDarkMode ? 'rgba(244, 63, 94, 0.65)' : 'rgba(239, 68, 68, 0.55)';
    ctx.lineWidth = 1.2 / safeZoom;
    ctx.beginPath();
    ctx.moveTo(config.marginLeft, pageY);
    ctx.lineTo(config.marginLeft, pageBottom);
    ctx.stroke();

    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 0.9 / safeZoom;
    ctx.setLineDash([4 / safeZoom, 4 / safeZoom]);
    ctx.beginPath();
    ctx.moveTo(rightMarginX, pageY);
    ctx.lineTo(rightMarginX, pageBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = isDarkMode ? 'rgba(148, 163, 184, 0.65)' : 'rgba(100, 116, 139, 0.7)';
    ctx.font = '500 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayTitle = (notebookTitle && notebookTitle.trim()) || tr('Vở ghi chép', 'Notebook');
    ctx.fillText(displayTitle, config.marginLeft + 6, pageY + config.marginTop * 0.45);

    ctx.textAlign = 'right';
    ctx.fillText(`${tr('Trang', 'Page')} ${p + 1}`, rightMarginX - 4, pageY + config.marginTop * 0.45);

    ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.55)' : 'rgba(100, 116, 139, 0.45)';
    ctx.lineWidth = 1.5 / safeZoom;
    ctx.setLineDash([6 / safeZoom, 4 / safeZoom]);
    ctx.beginPath();
    ctx.moveTo(0, pageBottom);
    ctx.lineTo(config.width, pageBottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
