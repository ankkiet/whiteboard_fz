import React, { useEffect, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  dataUrlToUint8Array,
  RenderedPageAsset,
  renderPdfPages,
  renderTextDocumentPages,
} from '../../engine/documentProcessor';
import { formatFileSize } from '../../engine/documentUtils';
import { FileCardElement } from '../../types/board';
import { Download, FileText, Layers, Loader2, X } from 'lucide-react';

export const DocumentPreviewModal: React.FC = () => {
  const previewFileCardId = useBoardStore((s) => s.previewFileCardId);
  const setPreviewFileCardId = useBoardStore((s) => s.setPreviewFileCardId);
  const elements = useBoardStore((s) => s.elements);
  const assets = useBoardStore((s) => s.assets);
  const insertDocumentPages = useBoardStore((s) => s.insertDocumentPages);
  const addToast = useBoardStore((s) => s.addToast);

  const [pdfPreviewPages, setPdfPreviewPages] = useState<RenderedPageAsset[]>([]);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  const fileCard = previewFileCardId
    ? (elements.find(
        (el): el is FileCardElement => el.id === previewFileCardId && el.type === 'file-card'
      ) ?? null)
    : null;

  const assetDataUrl = fileCard ? assets[fileCard.assetId] || '' : '';

  useEffect(() => {
    if (!fileCard) {
      setPdfPreviewPages([]);
      return;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewFileCardId(null);
    };
    window.addEventListener('keydown', onKey);

    let cancelled = false;
    if (fileCard.fileCategory === 'pdf' && assetDataUrl) {
      setIsLoadingPdf(true);
      const bytes = dataUrlToUint8Array(assetDataUrl);
      const maxPreview = Math.min(fileCard.pageCount || 10, 10);
      const pageNums = Array.from({ length: maxPreview }, (_, i) => i + 1);
      renderPdfPages(bytes, pageNums, 1.35)
        .then((pages) => {
          if (!cancelled) setPdfPreviewPages(pages);
        })
        .catch(() => {
          if (!cancelled) setPdfPreviewPages([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoadingPdf(false);
        });
    } else {
      setPdfPreviewPages([]);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [fileCard?.id, fileCard?.fileCategory, fileCard?.pageCount, assetDataUrl, setPreviewFileCardId]);

  if (!fileCard) return null;

  const handleDownload = () => {
    if (!assetDataUrl) {
      addToast('Không tìm thấy dữ liệu tệp để tải xuống.', 'error');
      return;
    }
    const link = document.createElement('a');
    link.href = assetDataUrl;
    link.download = fileCard.fileName;
    link.click();
    addToast(`Đang tải xuống "${fileCard.fileName}"`, 'success');
  };

  const handleSpreadToBoard = async () => {
    try {
      if (fileCard.fileCategory === 'pdf' && assetDataUrl) {
        const bytes = dataUrlToUint8Array(assetDataUrl);
        const count = Math.min(fileCard.pageCount || 1, 20);
        const pageNums = Array.from({ length: count }, (_, i) => i + 1);
        const pages = await renderPdfPages(bytes, pageNums, 2.5);
        insertDocumentPages(pages, fileCard.fileName, {
          layout: 'row',
          lockPages: true,
          worldOrigin: { x: fileCard.x + fileCard.width + 40, y: fileCard.y },
        });
        setPreviewFileCardId(null);
      } else if (fileCard.previewText) {
        const pages = renderTextDocumentPages(fileCard.fileName, fileCard.previewText);
        insertDocumentPages(pages.slice(0, 20), fileCard.fileName, {
          layout: 'row',
          lockPages: true,
          worldOrigin: { x: fileCard.x + fileCard.width + 40, y: fileCard.y },
        });
        setPreviewFileCardId(null);
      }
    } catch {
      addToast('Không thể trải trang từ tài liệu này.', 'error');
    }
  };

  const canSpread =
    (fileCard.fileCategory === 'pdf' && Boolean(assetDataUrl)) ||
    Boolean(fileCard.previewText);

  const paragraphs = fileCard.previewText
    ? fileCard.previewText.split(/\n+/).filter((p) => p.trim().length > 0)
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setPreviewFileCardId(null);
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.75} />
            <div className="min-w-0">
              <h2 id="doc-preview-title" className="text-sm font-medium truncate">
                {fileCard.fileName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatFileSize(fileCard.fileSize)}
                {fileCard.pageCount ? ` · ${fileCard.pageCount} trang` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canSpread && (
              <button
                type="button"
                onClick={handleSpreadToBoard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Trải lên bảng</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải xuống</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewFileCardId(null)}
              aria-label="Đóng trình xem tài liệu"
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/60">
          {fileCard.fileCategory === 'pdf' ? (
            isLoadingPdf ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-xs">Đang hiển thị các trang PDF...</span>
              </div>
            ) : pdfPreviewPages.length > 0 ? (
              <div className="space-y-4 flex flex-col items-center">
                {pdfPreviewPages.map((pg) => (
                  <div
                    key={pg.pageNumber}
                    className="w-full max-w-xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                  >
                    <img
                      src={pg.dataUrl}
                      alt={`${fileCard.fileName} - Trang ${pg.pageNumber}`}
                      className="w-full h-auto block"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs text-slate-500 py-12">
                Không thể hiển thị xem trước PDF. Bạn có thể bấm nút Tải xuống ở trên.
              </p>
            )
          ) : paragraphs.length > 0 ? (
            <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-3 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {paragraphs.map((para, idx) => (
                <p key={idx} className="whitespace-pre-wrap">
                  {para}
                </p>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Tệp đính kèm sẵn sàng tải xuống
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Định dạng tệp này không hỗ trợ xem trước văn bản trực tiếp. Bấm &quot;Tải xuống&quot; để mở trên thiết bị của bạn.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
