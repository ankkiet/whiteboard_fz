import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { paginatePlainText } from './documentUtils';

export { dataUrlToUint8Array, readFileAsDataUrl } from './documentUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface RenderedPageAsset {
  dataUrl: string;
  width: number;
  height: number;
  pageNumber: number;
}

/**
 * Encodes a white-backed document page canvas to compact WebP (falling back to JPEG)
 * so 20+ rendered pages use a fraction of the RAM and IndexedDB space of raw PNG.
 */
function encodePageCanvasDataUrl(canvas: HTMLCanvasElement, quality = 0.9): string {
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) {
    return webp;
  }
  return canvas.toDataURL('image/jpeg', 0.92);
}

function yieldToMainThread(): Promise<void> {
  if (typeof MessageChannel !== 'undefined') {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(null);
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function inspectPdfBytes(bytes: Uint8Array): Promise<{ pageCount: number }> {
  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  await loadingTask.destroy();
  return { pageCount };
}

export async function renderPdfPages(
  bytes: Uint8Array,
  pageNumbers: number[],
  scale = 2
): Promise<RenderedPageAsset[]> {
  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const results: RenderedPageAsset[] = [];

  try {
    for (let i = 0; i < pageNumbers.length; i++) {
      const pageNum = pageNumbers[i];
      if (pageNum < 1 || pageNum > pdf.numPages) continue;
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        page.cleanup();
        continue;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;

      results.push({
        dataUrl: encodePageCanvasDataUrl(canvas, 0.9),
        width: Math.round(viewport.width / scale),
        height: Math.round(viewport.height / scale),
        pageNumber: pageNum,
      });
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();

      if (i + 1 < pageNumbers.length) {
        await yieldToMainThread();
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  return results;
}

export async function extractWordTextFromBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value || '').trim();
}

/**
 * Renders extracted Word/Text document content into crisp A4-proportioned page PNGs
 * so users can spread pages onto the whiteboard and annotate directly on top.
 */
export function renderTextDocumentPages(
  fileName: string,
  plainText: string,
  selectedPages?: number[]
): RenderedPageAsset[] {
  const allPages = paginatePlainText(plainText, 64, 30);
  const totalPages = allPages.length;
  const pageNums =
    selectedPages && selectedPages.length > 0
      ? selectedPages.filter((p) => p >= 1 && p <= totalPages)
      : Array.from({ length: totalPages }, (_, i) => i + 1);

  const pageW = 595; // A4 pt width
  const pageH = 842; // A4 pt height
  const dpr = 2;

  return pageNums.map((pageNum) => {
    const lines = allPages[pageNum - 1] || [];
    const canvas = document.createElement('canvas');
    canvas.width = pageW * dpr;
    canvas.height = pageH * dpr;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.scale(dpr, dpr);

      // Paper sheet background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageW, pageH);

      // Subtle header strip
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, pageW, 56);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 56);
      ctx.lineTo(pageW, 56);
      ctx.stroke();

      // Header title & page number
      ctx.fillStyle = '#1e293b';
      ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(fileName.slice(0, 52), 44, 28);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Trang ${pageNum} / ${totalPages}`, pageW - 44, 28);
      ctx.textAlign = 'left';

      // Body text lines
      ctx.fillStyle = '#0f172a';
      ctx.font = '400 13.5px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textBaseline = 'top';
      let y = 84;
      const lineHeight = 23;
      for (const line of lines) {
        if (line) {
          ctx.fillText(line, 44, y);
        }
        y += lineHeight;
      }
    }

    const dataUrl = encodePageCanvasDataUrl(canvas, 0.9);
    canvas.width = 0;
    canvas.height = 0;

    return {
      dataUrl,
      width: pageW,
      height: pageH,
      pageNumber: pageNum,
    };
  });
}
