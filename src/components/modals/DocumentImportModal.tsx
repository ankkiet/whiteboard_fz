import React, { useEffect, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  extractWordTextFromBuffer,
  inspectPdfBytes,
  readFileAsDataUrl,
  renderPdfPages,
  renderTextDocumentPages,
} from '../../engine/documentProcessor';
import {
  classifyFile,
  formatFileSize,
  paginatePlainText,
  parsePageSelection,
} from '../../engine/documentUtils';
import { useI18n } from '../../i18n/useI18n';
import { FileText, Layers, CreditCard, Lock, X, Loader2 } from 'lucide-react';

export interface PendingDocumentImport {
  file: File;
  worldDropPoint?: { x: number; y: number };
}

interface DocumentImportModalProps {
  pendingDoc: PendingDocumentImport | null;
  onClose: () => void;
}

export const DocumentImportModal: React.FC<DocumentImportModalProps> = ({
  pendingDoc,
  onClose,
}) => {
  const insertDocumentPages = useBoardStore((s) => s.insertDocumentPages);
  const insertFileCard = useBoardStore((s) => s.insertFileCard);
  const addToast = useBoardStore((s) => s.addToast);
  const { t } = useI18n();

  const [mode, setMode] = useState<'spread' | 'card'>('spread');
  const [layout, setLayout] = useState<'row' | 'grid'>('row');
  const [lockPages, setLockPages] = useState(true);
  const [pageRange, setPageRange] = useState('');
  const [totalPages, setTotalPages] = useState<number>(1);
  const [extractedText, setExtractedText] = useState<string>('');
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [analyzedFile, setAnalyzedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const file = pendingDoc?.file || null;
  const isAnalyzing = Boolean(file && analyzedFile !== file);
  const kind = file ? classifyFile(file.name, file.type) : 'other';
  const isPdf = kind === 'pdf';
  const isDocx = file ? file.name.toLowerCase().endsWith('.docx') : false;
  const isLegacyDoc = file ? file.name.toLowerCase().endsWith('.doc') && !isDocx : false;
  const canSpreadPages =
    !isAnalyzing &&
    !analysisError &&
    ((isPdf && pdfBytes !== null) || isDocx || kind === 'text');

  useEffect(() => {
    if (!file) {
      setAnalyzedFile(null);
      return;
    }
    let cancelled = false;

    const analyze = async () => {
      setAnalysisError(null);
      setPageRange('');
      setExtractedText('');
      setPdfBytes(null);
      setTotalPages(0);

      try {
        if (kind === 'pdf') {
          const buf = await file.arrayBuffer();
          const bytes = new Uint8Array(buf);
          const { pageCount } = await inspectPdfBytes(bytes);
          if (!cancelled) {
            setPdfBytes(bytes);
            setTotalPages(pageCount);
            setMode('spread');
          }
        } else if (file.name.toLowerCase().endsWith('.docx')) {
          const buf = await file.arrayBuffer();
          const text = await extractWordTextFromBuffer(buf);
          const pages = paginatePlainText(text, 64, 30);
          if (!cancelled) {
            setExtractedText(text);
            setTotalPages(pages.length);
            setMode('spread');
          }
        } else if (kind === 'text') {
          const text = await file.text();
          const pages = paginatePlainText(text, 64, 30);
          if (!cancelled) {
            setExtractedText(text);
            setTotalPages(pages.length);
            setMode('spread');
          }
        } else {
          if (!cancelled) {
            setTotalPages(0);
            setMode('card');
          }
        }
      } catch {
        if (!cancelled) {
          setAnalysisError(
            t(
              'Không thể tách trang tự động từ tệp này. Bạn vẫn có thể chèn dưới dạng thẻ tài liệu.',
              'Could not extract pages automatically from this file. You can still insert it as a document card.'
            )
          );
          setMode('card');
        }
      } finally {
        if (!cancelled) setAnalyzedFile(file);
      }
    };

    void analyze();
    return () => {
      cancelled = true;
    };
  }, [file, kind, t]);

  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, isProcessing, onClose]);

  if (!file || !pendingDoc) return null;

  const selectedPageNumbers = parsePageSelection(pageRange, totalPages);

  const handleConfirm = async () => {
    if (isAnalyzing) return;
    setIsProcessing(true);
    try {
      if (mode === 'spread' && canSpreadPages) {
        const pagesToRender =
          selectedPageNumbers.length > 0 ? selectedPageNumbers : [1];
        const cappedPages = pagesToRender.slice(0, 20);
        if (pagesToRender.length > 20) {
          addToast(
            t(
              'Giới hạn tối đa 20 trang mỗi lần trải để giữ bảng mượt 60fps.',
              'Maximum 20 pages per batch to keep the canvas smooth at 60fps.'
            ),
            'info'
          );
        }

        if (isPdf) {
          if (!pdfBytes) {
            throw new Error('PDF data not ready');
          }
          const renderScale = cappedPages.length >= 10 ? 1.65 : 2;
          const rendered = await renderPdfPages(pdfBytes, cappedPages, renderScale);
          insertDocumentPages(rendered, file.name, {
            layout,
            lockPages,
            worldOrigin: pendingDoc.worldDropPoint,
          });
        } else {
          const rendered = renderTextDocumentPages(file.name, extractedText, cappedPages);
          insertDocumentPages(rendered, file.name, {
            layout,
            lockPages,
            worldOrigin: pendingDoc.worldDropPoint,
          });
        }
        onClose();
      } else {
        const dataUrl = await readFileAsDataUrl(file);
        insertFileCard({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          fileCategory: kind === 'image' ? 'other' : kind,
          dataUrl,
          pageCount: totalPages > 0 ? totalPages : undefined,
          previewText: extractedText ? extractedText.slice(0, 50000) : undefined,
          worldDropPoint: pendingDoc.worldDropPoint,
        });
        onClose();
      }
    } catch {
      addToast(
        t('Có lỗi khi xử lý tài liệu. Vui lòng thử lại.', 'Failed to process document. Please try again.'),
        'error'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 text-slate-800 dark:text-slate-100 relative">
        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          aria-label={t('Đóng hộp thoại nhập tài liệu', 'Close document import dialog')}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-5 pr-8">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${
              isPdf ? 'bg-red-600' : kind === 'word' ? 'bg-blue-600' : 'bg-slate-700'
            }`}
          >
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 id="doc-import-title" className="text-base font-bold truncate">
              {file.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isPdf
                ? t('Tài liệu PDF', 'PDF Document')
                : kind === 'word'
                ? t('Tài liệu Word', 'Word Document')
                : t('Tệp tài liệu', 'Document File')}
              {' · '}
              {formatFileSize(file.size)}
              {totalPages > 0 &&
                !isAnalyzing &&
                ` · ${totalPages} ${t('trang', totalPages === 1 ? 'page' : 'pages')}`}
            </p>
          </div>
        </div>

        {isAnalyzing ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs font-medium">
              {t('Đang phân tích tài liệu...', 'Analyzing document...')}
            </span>
          </div>
        ) : (
          <>
            {isLegacyDoc && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300">
                {t(
                  'Định dạng Word cũ (.doc) sẽ được chèn dưới dạng thẻ tài liệu. Để trải trang trực tiếp lên bảng, hãy dùng định dạng .docx hoặc .pdf.',
                  'Legacy Word (.doc) files are inserted as a document card. Use .docx or .pdf to spread pages directly onto the board.'
                )}
              </div>
            )}

            {analysisError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
                {analysisError}
              </div>
            )}

            {/* Mode selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
              <button
                type="button"
                disabled={!canSpreadPages}
                onClick={() => setMode('spread')}
                className={`p-3.5 rounded-xl border text-left transition-colors ${
                  mode === 'spread'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{t('Trải trang lên bảng', 'Spread pages on board')}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t(
                    'Tách từng trang thành ảnh sắc nét để viết, gạch chân, khoanh tròn trực tiếp',
                    'Render each page as a crisp image to annotate, highlight, and draw on directly'
                  )}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('card')}
                className={`p-3.5 rounded-xl border text-left transition-colors ${
                  mode === 'card'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm mb-1">
                  <CreditCard className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                  <span>{t('Thẻ tài liệu', 'Document card')}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t(
                    'Đính kèm thẻ gọn gàng trên bảng, nhấp đúp để xem nhanh hoặc tải tệp gốc',
                    'Attach a compact card on the board — double-click to preview or download'
                  )}
                </p>
              </button>
            </div>

            {mode === 'spread' && canSpreadPages && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3 mb-5">
                {totalPages > 1 && (
                  <div>
                    <label
                      htmlFor="doc-page-range"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {t(
                        `Chọn trang cần trải (để trống = tất cả ${totalPages} trang)`,
                        `Pages to insert (blank = all ${totalPages} pages)`
                      )}
                    </label>
                    <input
                      id="doc-page-range"
                      type="text"
                      value={pageRange}
                      onChange={(e) => setPageRange(e.target.value)}
                      placeholder={t(
                        `Ví dụ: 1-${Math.min(3, totalPages)} hoặc 1, 2`,
                        `e.g. 1-${Math.min(3, totalPages)} or 1, 2`
                      )}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t('Bố cục sắp xếp', 'Page layout')}
                  </span>
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setLayout('row')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        layout === 'row'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {t('Hàng ngang', 'Horizontal row')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayout('grid')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        layout === 'grid'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {t('Lưới 2 cột', '2-column grid')}
                    </button>
                  </div>
                </div>

                <label className="flex items-center justify-between text-xs font-medium cursor-pointer">
                  <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    {t(
                      'Khóa trang làm nền để vẽ đè không bị xê dịch',
                      'Lock pages as background so annotations stay aligned'
                    )}
                  </span>
                  <input
                    type="checkbox"
                    checked={lockPages}
                    onChange={(e) => setLockPages(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                </label>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={
                  isProcessing ||
                  (mode === 'spread' && canSpreadPages && selectedPageNumbers.length === 0)
                }
                onClick={handleConfirm}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isProcessing
                    ? t('Đang chèn vào bảng...', 'Inserting onto board...')
                    : mode === 'spread'
                    ? t(
                        `Trải ${selectedPageNumbers.length} trang lên bảng`,
                        `Spread ${selectedPageNumbers.length} ${selectedPageNumbers.length === 1 ? 'page' : 'pages'}`
                      )
                    : t('Chèn thẻ tài liệu', 'Insert document card')}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
