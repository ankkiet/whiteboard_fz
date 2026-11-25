import {
  BoardElement,
  BoardPattern,
  BoardType,
  Camera,
  NotebookPaperSize,
} from '../types/board';
import { loadImageAsync } from './imageCache';
import {
  computeBoardExportBounds,
  computeOptimalExportDimensions,
  ExportQualityScale,
} from './exportUtils';
import { getNotebookConfig, getNotebookContentPageIndices } from './notebookEngine';
import {
  drawNotebookLayout,
  drawWorldBackgroundPattern,
  getCanvasBackgroundColor,
} from './renderBackground';
import { drawBoardElement } from './renderer';
import { tr } from '../i18n';

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

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // fallback to system fonts if FontFaceSet rejects
    }
  }

  const { minX, minY, width, height, padding } =
    customBounds || computeBoardExportBounds(elements, 64);
  const { pixelWidth, pixelHeight, effectiveScale, wasClamped } =
    computeOptimalExportDimensions(width, height, requestedScale);

  const canvas = document.createElement('canvas');
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(tr('Không thể khởi tạo Canvas xuất dữ liệu.', 'Could not initialize export canvas.'));

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

  if (includeBackground) {
    if (boardType === 'notebook') {
      drawNotebookLayout(
        ctx,
        exportCamera,
        width,
        height,
        isDarkMode,
        elements,
        notebookPaperSize,
        title,
        includePattern ? boardPattern : 'plain'
      );
    } else if (includePattern && boardPattern !== 'plain') {
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
          reject(new Error(tr('Không thể nén ảnh PNG chất lượng cao.', 'Could not encode high-resolution PNG.')));
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
  // Dynamically load jsPDF only when exporting PDF to keep initial app bundles light
  const { jsPDF } = await import('jspdf');
  const {
    elements,
    boardType,
    notebookPaperSize,
    layout = 'fit',
    title,
  } = options;

  if (boardType === 'notebook' && layout !== 'fit') {
    const config = getNotebookConfig(notebookPaperSize);
    const contentPages = getNotebookContentPageIndices(elements, config, 50);
    const pagesToExport = contentPages.length > 0 ? contentPages : [0];

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
        creator: 'fzInK',
      });
    }

    for (let i = 0; i < pagesToExport.length; i++) {
      const p = pagesToExport[i];
      if (i > 0) {
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
        scale: 2,
        customBounds: pageBounds,
      });

      doc.addImage(rendered.canvas, 'PNG', 0, 0, a4WidthPt, a4HeightPt, undefined, 'FAST');
    }

    const blob = doc.output('blob');
    return {
      blob,
      pageCount: pagesToExport.length,
      widthPt: a4WidthPt,
      heightPt: a4HeightPt,
    };
  }

  const { canvas, pixelWidth, pixelHeight, width, height } =
    await renderBoardToOffscreenCanvas(options);

  let doc: InstanceType<typeof jsPDF>;
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
      creator: 'fzInK',
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
