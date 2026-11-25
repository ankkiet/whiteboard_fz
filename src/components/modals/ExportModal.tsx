import React, { useState, useEffect, useMemo } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { exportBoardToPng, exportBoardToPdf, PdfPageLayout } from '../../engine/boardExporter';
import {
  computeBoardExportBounds,
  computeOptimalExportDimensions,
  ExportQualityScale,
} from '../../engine/exportUtils';
import { getNotebookConfig, getNotebookContentPageIndices } from '../../engine/notebookEngine';
import { useI18n } from '../../i18n/useI18n';
import {
  X,
  Upload,
  Image as ImageIcon,
  FileJson,
  Cloud,
  FileText,
  Download,
  ChevronRight,
  Loader2,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDriveClick?: () => void;
}

type ExportFormat = 'png' | 'pdf';

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onOpenDriveClick,
}) => {
  const title = useBoardStore((s) => s.title);
  const elements = useBoardStore((s) => s.elements);
  const assets = useBoardStore((s) => s.assets);
  const isDarkMode = useBoardStore((s) => s.isDarkMode);
  const boardPattern = useBoardStore((s) => s.boardPattern);
  const boardType = useBoardStore((s) => s.boardType);
  const notebookPaperSize = useBoardStore((s) => s.notebookPaperSize);
  const importBoardData = useBoardStore((s) => s.importBoardData);
  const addToast = useBoardStore((s) => s.addToast);
  const { language, t } = useI18n();

  const [exportFormat, setExportFormat] = useState<ExportFormat>(
    boardType === 'notebook' ? 'pdf' : 'png'
  );
  const [exportScale, setExportScale] = useState<ExportQualityScale>(4);
  const [pdfLayout, setPdfLayout] = useState<PdfPageLayout>(
    boardType === 'notebook' ? 'a4-portrait' : 'fit'
  );
  const [includeBackground, setIncludeBackground] = useState(true);
  const [includePattern, setIncludePattern] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const isBusy = isExporting || isExportingPdf;

  const qualityOptions: { scale: ExportQualityScale; label: string; sub: string }[] = [
    { scale: 2, label: '2×', sub: 'HD' },
    { scale: 3, label: '3×', sub: '4K' },
    { scale: 4, label: '4×', sub: t('Tối đa', 'Max') },
  ];

  const pdfLayoutOptions: { id: PdfPageLayout; label: string }[] = [
    { id: 'fit', label: t('Vừa vặn', 'Fit content') },
    { id: 'a4-landscape', label: t('A4 ngang', 'A4 landscape') },
    { id: 'a4-portrait', label: t('A4 dọc', 'A4 portrait') },
  ];

  const exportDims = useMemo(() => {
    const bounds = computeBoardExportBounds(elements, 64);
    return computeOptimalExportDimensions(bounds.width, bounds.height, exportScale);
  }, [elements, exportScale]);

  const notebookContentPages = useMemo(() => {
    if (boardType !== 'notebook') return [];
    const config = getNotebookConfig(notebookPaperSize, language);
    return getNotebookContentPageIndices(elements, config, 50);
  }, [boardType, elements, notebookPaperSize, language]);

  useEffect(() => {
    if (!isOpen) return;
    setExportFormat(boardType === 'notebook' ? 'pdf' : 'png');
    setPdfLayout(boardType === 'notebook' ? 'a4-portrait' : 'fit');
  }, [isOpen, boardType]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isBusy, onClose]);

  if (!isOpen) return null;

  const safeFileName =
    (title || 'bang-trang')
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s+/g, '-')
      .toLowerCase() || 'bang-trang';

  const handleExportPNG = async () => {
    setIsExporting(true);
    try {
      const result = await exportBoardToPng({
        elements,
        assets,
        isDarkMode,
        boardPattern,
        boardType,
        notebookPaperSize,
        includeBackground,
        includePattern: includeBackground && includePattern,
        scale: exportScale,
      });
      const objectUrl = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.download = `${safeFileName}-${result.pixelWidth}x${result.pixelHeight}.png`;
      link.href = objectUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);

      addToast(
        t(
          `Đã tải ảnh PNG (${result.pixelWidth} × ${result.pixelHeight} px)`,
          `Downloaded PNG image (${result.pixelWidth} × ${result.pixelHeight} px)`
        ),
        'success'
      );
      onClose();
    } catch {
      addToast(
        t('Có lỗi khi xuất ảnh PNG. Vui lòng thử lại.', 'Failed to export PNG. Please try again.'),
        'error'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    try {
      const result = await exportBoardToPdf({
        elements,
        assets,
        isDarkMode,
        boardPattern,
        boardType,
        notebookPaperSize,
        includeBackground,
        includePattern: includeBackground && includePattern,
        scale: exportScale,
        layout: pdfLayout,
        title: title || t('Bảng trắng', 'Whiteboard'),
      });
      const objectUrl = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.download = `${safeFileName}.pdf`;
      link.href = objectUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);

      addToast(
        t(
          `Đã xuất tệp PDF (${result.pageCount} trang)`,
          `Exported PDF (${result.pageCount} ${result.pageCount === 1 ? 'page' : 'pages'})`
        ),
        'success'
      );
      onClose();
    } catch {
      addToast(
        t('Có lỗi khi xuất tệp PDF. Vui lòng thử lại.', 'Failed to export PDF. Please try again.'),
        'error'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrimaryExport = () => {
    if (exportFormat === 'pdf') {
      void handleExportPDF();
    } else {
      void handleExportPNG();
    }
  };

  const handleExportJSON = () => {
    const payload = {
      title,
      boardType,
      boardPattern,
      notebookPaperSize,
      elements,
      assets,
      version: 2,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${safeFileName}.whiteboard.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    addToast(
      t('Đã tải tệp sao lưu .whiteboard.json', 'Downloaded .whiteboard.json backup'),
      'success'
    );
    onClose();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!Array.isArray(json.elements)) {
          addToast(
            t('Tệp JSON không đúng định dạng bảng trắng.', 'Invalid whiteboard JSON file.'),
            'error'
          );
          return;
        }
        importBoardData({
          title: typeof json.title === 'string' ? json.title : undefined,
          boardType: typeof json.boardType === 'string' ? json.boardType : undefined,
          boardPattern: typeof json.boardPattern === 'string' ? json.boardPattern : undefined,
          notebookPaperSize:
            typeof json.notebookPaperSize === 'string' ? json.notebookPaperSize : undefined,
          elements: json.elements,
          assets: json.assets && typeof json.assets === 'object' ? json.assets : {},
        });
        onClose();
      } catch {
        addToast(t('Không thể đọc tệp JSON này.', 'Unable to read this JSON file.'), 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const pdfSummary =
    boardType === 'notebook' && pdfLayout !== 'fit'
      ? notebookContentPages.length > 0
        ? t(
            `Chỉ xuất ${notebookContentPages.length} trang có nội dung · Chuẩn A4 in ấn`,
            `Exports ${notebookContentPages.length} non-empty ${notebookContentPages.length === 1 ? 'page' : 'pages'} · Print-ready A4`
          )
        : t('1 trang trống · Chuẩn A4 in ấn', '1 blank page · Print-ready A4')
      : pdfLayout === 'fit'
      ? t('Tự động vừa khít khung nội dung trên bảng', 'Auto-fits the content bounds on the board')
      : pdfLayout === 'a4-landscape'
      ? t('Khổ A4 nằm ngang, phù hợp trình chiếu', 'A4 landscape, ideal for slides & screens')
      : t('Khổ A4 nằm dọc, phù hợp in ấn hoặc nộp bài', 'A4 portrait, ideal for printing & handouts');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl dark:shadow-none w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="export-modal-title"
              className="text-base font-medium text-slate-900 dark:text-slate-100 text-balance"
            >
              {t('Xuất & sao lưu bảng', 'Export & backup board')}
            </h2>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {language === 'en'
                ? `${elements.length} ${elements.length === 1 ? 'item' : 'items'} on board`
                : `${elements.length} đối tượng trên bảng`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label={t('Đóng hộp thoại xuất', 'Close export dialog')}
            className="size-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Format Switcher */}
          <div
            role="tablist"
            aria-label={t('Định dạng tệp xuất', 'Export file format')}
            className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80"
          >
            <button
              type="button"
              role="tab"
              aria-selected={exportFormat === 'png'}
              disabled={isBusy}
              onClick={() => setExportFormat('png')}
              className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                exportFormat === 'png'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ImageIcon className="size-3.5" />
              <span>{t('Ảnh PNG', 'PNG Image')}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={exportFormat === 'pdf'}
              disabled={isBusy}
              onClick={() => setExportFormat('pdf')}
              className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                exportFormat === 'pdf'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="size-3.5" />
              <span>{t('Tệp PDF', 'PDF Document')}</span>
            </button>
          </div>

          {/* Export Settings Panel */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 divide-y divide-slate-200/80 dark:divide-slate-800">
            {/* Resolution */}
            <div className="p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t('Độ phân giải', 'Resolution')}
                </span>
                <span
                  data-testid="export-resolution-readout"
                  className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400"
                >
                  {exportDims.pixelWidth} × {exportDims.pixelHeight} px
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label={t('Độ phân giải xuất', 'Export resolution')}
                className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-900/70"
              >
                {qualityOptions.map((opt) => {
                  const active = exportScale === opt.scale;
                  return (
                    <button
                      key={opt.scale}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={isBusy}
                      onClick={() => setExportScale(opt.scale)}
                      className={`py-1.5 px-2 rounded-md text-xs transition-colors cursor-pointer ${
                        active
                          ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span
                        className={`ml-1 text-[11px] font-normal ${
                          active
                            ? 'text-indigo-500/80 dark:text-indigo-300/80'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {opt.sub}
                      </span>
                    </button>
                  );
                })}
              </div>

              {exportDims.wasClamped && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug text-pretty">
                  {t(
                    `Bảng có kích thước rất lớn — tự động tối ưu ở mức ${exportDims.effectiveScale}× để đảm bảo an toàn trình duyệt.`,
                    `Board is very large — automatically scaled to ${exportDims.effectiveScale}× for safe browser export.`
                  )}
                </p>
              )}
            </div>

            {/* PDF Paper Layout (only shown for PDF) */}
            {exportFormat === 'pdf' && (
              <div className="p-3.5 space-y-2">
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t('Khổ giấy', 'Page layout')}
                </span>

                <div
                  role="radiogroup"
                  aria-label={t('Khổ giấy PDF', 'PDF page layout')}
                  className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-900/70"
                >
                  {pdfLayoutOptions.map((opt) => {
                    const active = pdfLayout === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={isBusy}
                        onClick={() => setPdfLayout(opt.id)}
                        className={`py-1.5 px-2 rounded-md text-xs transition-colors cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug text-pretty">
                  {pdfSummary}
                </p>
              </div>
            )}

            {/* Background Toggles */}
            <div className="p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t('Kèm màu nền bảng', 'Include board background')}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeBackground}
                  aria-label={t('Kèm màu nền bảng', 'Include board background')}
                  disabled={isBusy}
                  onClick={() => setIncludeBackground((prev) => !prev)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                    includeBackground ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block size-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      includeBackground ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div
                className={`flex items-center justify-between gap-3 transition-opacity ${
                  !includeBackground ? 'opacity-45' : ''
                }`}
              >
                <div className="min-w-0">
                  <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t('Kèm họa tiết nền', 'Include background pattern')}
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    {t('Ô ly, chấm bi hoặc dòng kẻ', 'Grid, dots, or ruled lines')}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeBackground && includePattern}
                  aria-label={t('Kèm họa tiết nền', 'Include background pattern')}
                  disabled={!includeBackground || isBusy}
                  onClick={() => setIncludePattern((prev) => !prev)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                    !includeBackground ? 'cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    includeBackground && includePattern
                      ? 'bg-indigo-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block size-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      includeBackground && includePattern ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Primary Export CTA */}
          <button
            type="button"
            disabled={isBusy}
            onClick={handlePrimaryExport}
            className="w-full h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            <span>
              {exportFormat === 'pdf'
                ? isExportingPdf
                  ? t('Đang xuất tệp PDF...', 'Exporting PDF...')
                  : t('Tải xuống tệp PDF', 'Download PDF')
                : isExporting
                ? t('Đang xuất ảnh PNG...', 'Exporting PNG...')
                : t(`Tải xuống ảnh PNG (${exportScale}×)`, `Download PNG (${exportScale}×)`)}
            </span>
          </button>

          {/* Secondary Section: Backup & Sync */}
          <div className="pt-1 space-y-2">
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('Sao lưu & đồng bộ', 'Backup & sync')}
            </h3>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {onOpenDriveClick && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    onClose();
                    onOpenDriveClick();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:opacity-50 transition-colors text-left cursor-pointer"
                >
                  <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Cloud className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">
                      {t('Lưu & mở trên Google Drive', 'Save & open on Google Drive')}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {t(
                        'Đồng bộ tệp dự án hoặc ảnh lên Drive',
                        'Sync project files or snapshots to Drive'
                      )}
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-slate-400 shrink-0" />
                </button>
              )}

              <button
                type="button"
                disabled={isBusy}
                onClick={handleExportJSON}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:opacity-50 transition-colors text-left cursor-pointer"
              >
                <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <FileJson className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">
                    {t('Sao lưu tệp dự án (.json)', 'Export project backup (.json)')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {t(
                      'Lưu toàn bộ đối tượng và ảnh đính kèm',
                      'Save all board elements and embedded images'
                    )}
                  </div>
                </div>
                <ChevronRight className="size-4 text-slate-400 shrink-0" />
              </button>

              <label
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left ${
                  isBusy ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
                }`}
              >
                <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <Upload className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">
                    {t('Nhập từ tệp sao lưu (.json)', 'Import from backup (.json)')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {t('Khôi phục bảng trắng từ máy tính', 'Restore a whiteboard from your computer')}
                  </div>
                </div>
                <ChevronRight className="size-4 text-slate-400 shrink-0" />
                <input
                  type="file"
                  accept=".json,application/json"
                  disabled={isBusy}
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
