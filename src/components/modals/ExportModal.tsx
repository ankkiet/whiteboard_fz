import React, { useState, useEffect, useMemo } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { exportBoardToPng, exportBoardToPdf, PdfPageLayout } from '../../engine/renderer';
import {
  computeBoardExportBounds,
  computeOptimalExportDimensions,
  ExportQualityScale,
} from '../../engine/exportUtils';
import { getNotebookConfig, getNotebookContentPageIndices } from '../../engine/notebookEngine';
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

const QUALITY_OPTIONS: { scale: ExportQualityScale; label: string; sub: string }[] = [
  { scale: 2, label: '2×', sub: 'HD' },
  { scale: 3, label: '3×', sub: '4K' },
  { scale: 4, label: '4×', sub: 'Tối đa' },
];

const PDF_LAYOUT_OPTIONS: { id: PdfPageLayout; label: string }[] = [
  { id: 'fit', label: 'Vừa vặn' },
  { id: 'a4-landscape', label: 'A4 ngang' },
  { id: 'a4-portrait', label: 'A4 dọc' },
];

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

  const exportDims = useMemo(() => {
    const bounds = computeBoardExportBounds(elements, 64);
    return computeOptimalExportDimensions(bounds.width, bounds.height, exportScale);
  }, [elements, exportScale]);

  const notebookContentPages = useMemo(() => {
    if (boardType !== 'notebook') return [];
    const config = getNotebookConfig(notebookPaperSize);
    return getNotebookContentPageIndices(elements, config, 50);
  }, [boardType, elements, notebookPaperSize]);

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
        `Đã tải ảnh PNG (${result.pixelWidth} × ${result.pixelHeight} px)`,
        'success'
      );
      onClose();
    } catch {
      addToast('Có lỗi khi xuất ảnh PNG. Vui lòng thử lại.', 'error');
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
        title: title || 'Bảng trắng',
      });
      const objectUrl = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.download = `${safeFileName}.pdf`;
      link.href = objectUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);

      addToast(`Đã xuất tệp PDF (${result.pageCount} trang)`, 'success');
      onClose();
    } catch {
      addToast('Có lỗi khi xuất tệp PDF. Vui lòng thử lại.', 'error');
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
    addToast('Đã tải tệp sao lưu .whiteboard.json', 'success');
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
          addToast('Tệp JSON không đúng định dạng bảng trắng.', 'error');
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
        addToast('Không thể đọc tệp JSON này.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const pdfSummary =
    boardType === 'notebook' && pdfLayout !== 'fit'
      ? notebookContentPages.length > 0
        ? `Chỉ xuất ${notebookContentPages.length} trang có nội dung · Chuẩn A4 in ấn`
        : '1 trang trống · Chuẩn A4 in ấn'
      : pdfLayout === 'fit'
      ? 'Tự động vừa khít khung nội dung trên bảng'
      : pdfLayout === 'a4-landscape'
      ? 'Khổ A4 nằm ngang, phù hợp trình chiếu'
      : 'Khổ A4 nằm dọc, phù hợp in ấn hoặc nộp bài';

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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-[440px] overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="export-modal-title"
              className="text-base font-bold text-slate-900 dark:text-white text-balance"
            >
              Xuất & sao lưu bảng
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {elements.length} đối tượng trên bảng
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Đóng hộp thoại xuất"
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
            aria-label="Định dạng tệp xuất"
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
              <span>Ảnh PNG</span>
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
              <span>Tệp PDF</span>
            </button>
          </div>

          {/* Export Settings Panel */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 divide-y divide-slate-200/80 dark:divide-slate-800">
            {/* Resolution */}
            <div className="p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Độ phân giải
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
                aria-label="Độ phân giải xuất"
                className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-900/70"
              >
                {QUALITY_OPTIONS.map((opt) => {
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
                  Bảng có kích thước rất lớn — tự động tối ưu ở mức {exportDims.effectiveScale}× để đảm bảo an toàn trình duyệt.
                </p>
              )}
            </div>

            {/* PDF Paper Layout (only shown for PDF) */}
            {exportFormat === 'pdf' && (
              <div className="p-3.5 space-y-2">
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Khổ giấy
                </span>

                <div
                  role="radiogroup"
                  aria-label="Khổ giấy PDF"
                  className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-900/70"
                >
                  {PDF_LAYOUT_OPTIONS.map((opt) => {
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
                  Kèm màu nền bảng
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeBackground}
                  aria-label="Kèm màu nền bảng"
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
                    Kèm họa tiết nền
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Ô ly, chấm bi hoặc dòng kẻ
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeBackground && includePattern}
                  aria-label="Kèm họa tiết nền"
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
                  ? 'Đang xuất tệp PDF...'
                  : 'Tải xuống tệp PDF'
                : isExporting
                ? 'Đang xuất ảnh PNG...'
                : `Tải xuống ảnh PNG (${exportScale}×)`}
            </span>
          </button>

          {/* Secondary Section: Backup & Sync */}
          <div className="pt-1 space-y-2">
            <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Sao lưu & đồng bộ
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
                      Lưu & mở trên Google Drive
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Đồng bộ tệp dự án hoặc ảnh lên Drive
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
                    Sao lưu tệp dự án (.json)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Lưu toàn bộ đối tượng và ảnh đính kèm
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
                    Nhập từ tệp sao lưu (.json)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Khôi phục bảng trắng từ máy tính
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
