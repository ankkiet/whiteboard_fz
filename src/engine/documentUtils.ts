import { FileCategory } from '../types/board';

export type IncomingFileKind = 'image' | FileCategory;

export function classifyFile(fileName: string, mimeType = ''): IncomingFileKind {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  if (
    lowerMime.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/.test(lowerName)
  ) {
    return 'image';
  }
  if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    lowerMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerMime === 'application/msword' ||
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc')
  ) {
    return 'word';
  }
  if (
    lowerMime.includes('spreadsheet') ||
    lowerMime.includes('excel') ||
    /\.(xlsx?|csv)$/.test(lowerName)
  ) {
    return 'sheet';
  }
  if (
    lowerMime.includes('presentation') ||
    lowerMime.includes('powerpoint') ||
    /\.(pptx?)$/.test(lowerName)
  ) {
    return 'slide';
  }
  if (lowerMime.startsWith('text/') || /\.(txt|md|json|log)$/.test(lowerName)) {
    return 'text';
  }
  return 'other';
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/**
 * Parses a human page range specification such as "1-3, 5, 8-10" or "" / "all"
 * into a sorted, deduplicated list of valid 1-based page numbers within [1, totalPages].
 */
export function parsePageSelection(input: string, totalPages: number): number[] {
  if (totalPages <= 0) return [];
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || trimmed === 'all' || trimmed === 'tất cả') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  const tokens = trimmed.split(/[,;]+/);

  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;

    if (token.includes('-')) {
      const [startStr, endStr] = token.split('-').map((s) => s.trim());
      const startNum = Number.parseInt(startStr, 10);
      const endNum = Number.parseInt(endStr, 10);
      if (Number.isNaN(startNum) || Number.isNaN(endNum)) continue;
      const lo = Math.max(1, Math.min(startNum, endNum));
      const hi = Math.min(totalPages, Math.max(startNum, endNum));
      for (let p = lo; p <= hi; p++) {
        pages.add(p);
      }
    } else {
      const pageNum = Number.parseInt(token, 10);
      if (!Number.isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        pages.add(pageNum);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Splits plain text into estimated A4 pages (lines per page) for rendering Word/Text documents
 * onto the whiteboard canvas.
 */
export function paginatePlainText(
  text: string,
  charsPerLine = 68,
  linesPerPage = 32
): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [['(Tài liệu không có nội dung văn bản)']];

  const wrappedLines: string[] = [];
  const paragraphs = normalized.split('\n');

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      wrappedLines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= charsPerLine) {
        current += ' ' + word;
      } else {
        wrappedLines.push(current);
        current = word;
      }
    }
    if (current) wrappedLines.push(current);
  }

  const pages: string[][] = [];
  for (let i = 0; i < wrappedLines.length; i += linesPerPage) {
    pages.push(wrappedLines.slice(i, i + linesPerPage));
  }
  return pages.length > 0 ? pages : [['']];
}
