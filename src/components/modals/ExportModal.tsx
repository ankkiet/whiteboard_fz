import React, { useState, useEffect, useMemo } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { exportBoardToPng, exportBoardToPdf, PdfPageLayout } from '../../engine/renderer';
import {
  computeBoardExportBounds,
  computeOptimalExportDimensions,
  ExportQualityScale,
} from '../../engine/exportUtils';
import { X, Upload, Image as ImageIcon, FileJson, Sparkles, Cloud, FileText } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDriveClick?: () => void;
}

const QUALITY_OPTIONS: { scale: ExportQualityScale; label: string; sub: string }[] = [
  { scale: 2, label: '2x', sub: 'Chuẩn HD' },
  { scale: 3, label: '3x', sub: 'In ấn 4K' },
  { scale: 4, label: '4x', sub: 'Tối đa' },
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

  const [exportScale, setExportScale] = useState<ExportQualityScale>(4);
  const [pdfLayout, setPdfLayout] = useState<PdfPageLayout>(boardType === 'notebook' ? 'a4-portrait' : 'fit');
  const [includeBackground, setIncludeBackground] = useState(true);
  const [includePattern, setIncludePattern] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const exportDims = useMemo(() => {
    const bounds = computeBoardExportBounds(elements, 64);
    return computeOptimalExportDimensions(bounds.width, bounds.height, exportScale);
  }, [elements, exportScale]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isExporting, onClose]);

  if (!isOpen) return null;

  const safeFileName = (title || 'bang-trang')
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
        `Đã tải ảnh PNG siêu nét (${result.pixelWidth} × ${result.pixelHeight} px)`,
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

      addToast(
        `Đã xuất tệp PDF thành công (${result.pageCount} trang)`,
        'success'
      );
      onClose();
    } catch {
      addToast('Có lỗi khi xuất tệp PDF. Vui lòng thử lại.', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportJSON = () => {
    const payload = {
      title,
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isExporting) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 text-slate-800 dark:text-slate-100 relative max-h-[92vh] overflow-y-auto scrollbar-none">
        <button
          type="button"
          onClick={onClose}
          disabled={isExporting || isExportingPdf}
          aria-label="Đóng hộp thoại xuất"
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 id="export-modal-title" className="text-lg font-bold mb-1">
          Xuất & sao lưu bảng
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          {elements.length} đối tượng trên bảng · Xuất ảnh PNG & tệp PDF chất lượng cao
        </p>

        {/* PNG export options */}
        <div className="mb-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Độ phân giải xuất ảnh
              </span>
              <span
                data-testid="export-resolution-readout"
                className="text-[11px] font-mono font-medium text-indigo-600 dark:text-indigo-400"
              >
                {exportDims.pixelWidth} × {exportDims.pixelHeight} px
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {QUALITY_OPTIONS.map((opt) => {
                const active = exportScale === opt.scale;
                return (
                  <button
                    key={opt.scale}
                    type="button"
                    onClick={() => setExportScale(opt.scale)}
                    aria-pressed={active}
                    className={`py-2 px-2 rounded-lg border text-center transition-colors ${
                      active
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                  >
                    <div className="text-xs font-bold leading-tight">{opt.label}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        active ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {opt.sub}
                    </div>
                  </button>
                );
              })}
            </div>

            {exportDims.wasClamped && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 leading-snug">
                Bảng có kích thước rất lớn — tự động tối ưu ở mức {exportDims.effectiveScale}x (tối đa an toàn của trình duyệt).
              </p>
            )}
          </div>

          <div className="border-t border-slate-200/80 dark:border-slate-700/70 pt-2.5 space-y-2.5">
            <label className="flex items-center justify-between text-xs font-medium cursor-pointer">
              <span>Kèm màu nền bảng</span>
              <input
                type="checkbox"
                checked={includeBackground}
                onChange={(e) => setIncludeBackground(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded"
              />
            </label>
            <label
              className={`flex items-center justify-between text-xs font-medium cursor-pointer ${
                !includeBackground ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <span>Kèm họa tiết nền (ô ly / chấm bi / dòng kẻ)</span>
              <input
                type="checkbox"
                checked={includePattern}
                disabled={!includeBackground}
                onChange={(e) => setIncludePattern(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded"
              />
            </label>
          </div>

          <div className="border-t border-slate-200/80 dark:border-slate-700/70 pt-2.5">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              Khổ giấy khi xuất tệp PDF
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'fit' as const, label: 'Vừa vặn', sub: 'Theo nội dung' },
                { id: 'a4-landscape' as const, label: 'A4 Ngang', sub: 'Thuyết trình' },
                { id: 'a4-portrait' as const, label: 'A4 Dọc', sub: 'Tài liệu in' },
              ].map((opt) => {
                const active = pdfLayout === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPdfLayout(opt.id)}
                    aria-pressed={active}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-colors ${
                      active
                        ? 'border-rose-600 bg-rose-600 text-white shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-rose-300 dark:hover:border-rose-700'
                    }`}
                  >
                    <div className="text-xs font-bold leading-tight">{opt.label}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        active ? 'text-rose-100' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {opt.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {/* Nút xuất PDF */}
          <button
            type="button"
            disabled={isExporting || isExportingPdf}
            onClick={handleExportPDF}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-medium transition-colors text-left cursor-pointer shadow-sm"
          >
            <div className="p-2 rounded-lg bg-white/15 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {isExportingPdf
                  ? 'Đang kết xuất tệp PDF...'
                  : 'Tải xuống tệp PDF'}
              </div>
              <div className="text-xs text-rose-100">
                {boardType === 'notebook' && pdfLayout !== 'fit'
                  ? 'Tài liệu nhiều trang · Chuẩn A4 in ấn hoặc nộp bài'
                  : `Định dạng vector & ảnh sắc nét · Khổ ${
                      pdfLayout === 'fit'
                        ? 'vừa vặn nội dung'
                        : pdfLayout === 'a4-landscape'
                        ? 'A4 nằm ngang'
                        : 'A4 nằm dọc'
                    }`}
              </div>
            </div>
          </button>

          <button
            type="button"
            disabled={isExporting || isExportingPdf}
            onClick={handleExportPNG}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium transition-colors text-left cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-white/15 shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {isExporting
                  ? 'Đang kết xuất ảnh chất lượng cao...'
                  : `Tải xuống ảnh PNG (${
                      exportScale === 4
                        ? '4x Ultra HD'
                        : exportScale === 3
                        ? '3x In ấn 4K'
                        : '2x HD'
                    })`}
              </div>
              <div className="text-xs text-indigo-100">
                Lossless PNG · {exportDims.pixelWidth} × {exportDims.pixelHeight} px · Không vỡ nét
              </div>
            </div>
          </button>

          {onOpenDriveClick && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDriveClick();
              }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0">
                <Cloud className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Lưu & Mở trên Google Drive</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Đồng bộ tệp dự án hoặc ảnh PNG 4x lên Drive của bạn
                </div>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportJSON}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors text-left"
          >
            <div className="p-2 rounded-lg bg-slate-800 dark:bg-slate-700 text-white shrink-0">
              <FileJson className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Sao lưu tệp dự án (.json)</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Lưu toàn bộ đối tượng và ảnh đính kèm để mở lại sau
              </div>
            </div>
          </button>

          <label className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer text-left">
            <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Nhập từ tệp sao lưu (.json)</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Khôi phục bảng trắng từ máy tính của bạn
              </div>
            </div>
            <input type="file" accept=".json,application/json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};
