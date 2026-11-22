import React, { useState, useRef, useEffect } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { DriveSyncStatus, formatSyncTime } from '../../services/driveSyncUtils';
import { BoardType } from '../../types/board';
import {
  Undo2,
  Redo2,
  Download,
  Trash2,
  Home,
  Cloud,
  Check,
  Loader2,
  AlertCircle,
  Sigma,
} from 'lucide-react';

interface TopLeftBarProps {
  onHomeClick: () => void;
  onExportClick: () => void;
  onDriveClick: () => void;
  isDriveConnected?: boolean;
  syncStatus?: DriveSyncStatus;
  lastSyncedAt?: string | null;
  autoSaveEnabled?: boolean;
  boardType?: BoardType;
  isMathPanelOpen?: boolean;
  onToggleMathPanel?: () => void;
}

export const TopLeftBar: React.FC<TopLeftBarProps> = ({
  onHomeClick,
  onExportClick,
  onDriveClick,
  isDriveConnected = false,
  syncStatus = 'idle',
  lastSyncedAt = null,
  autoSaveEnabled = true,
  boardType = 'basic',
  isMathPanelOpen = false,
  onToggleMathPanel,
}) => {
  const title = useBoardStore((s) => s.title);
  const setTitle = useBoardStore((s) => s.setTitle);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const historyIndex = useBoardStore((s) => s.historyIndex);
  const historyLength = useBoardStore((s) => s.history.length);
  const clearBoard = useBoardStore((s) => s.clearBoard);
  const elementCount = useBoardStore((s) => s.elements.length);

  const [confirmClear, setConfirmClear] = useState(false);
  const clearPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmClear) return;
    const onOutside = (e: MouseEvent) => {
      if (clearPopoverRef.current && !clearPopoverRef.current.contains(e.target as Node)) {
        setConfirmClear(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [confirmClear]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLength - 1;

  return (
    <div
      data-testid="top-left-bar"
      className="pointer-events-auto min-w-0 flex items-center gap-1 sm:gap-1.5 lg:gap-2 bg-white/92 dark:bg-slate-900/92 backdrop-blur-md px-1.5 sm:px-2.5 lg:px-3 py-1.5 rounded-2xl shadow-lg shadow-slate-900/5 dark:shadow-black/30 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 transition-colors"
    >
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <button
          type="button"
          data-testid="back-to-home-button"
          onClick={onHomeClick}
          title="Về trang chủ xem tất cả bảng đã lưu"
          aria-label="Về trang chủ"
          className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white shrink-0 transition-colors cursor-pointer"
        >
          <Home className="w-4 h-4" />
        </button>
        <input
          type="text"
          aria-label="Tên bảng trắng"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="hidden sm:block font-semibold text-sm bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 px-2 py-1 rounded-lg outline-none transition-colors w-24 md:w-28 lg:w-36 xl:w-44 min-w-0 truncate"
          placeholder="Tên bảng trắng..."
        />
      </div>

      <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          title="Hoàn tác (Ctrl+Z)"
          aria-label="Hoàn tác"
          className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:hover:bg-transparent transition-colors text-slate-700 dark:text-slate-200"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title="Làm lại (Ctrl+Shift+Z)"
          aria-label="Làm lại"
          className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:hover:bg-transparent transition-colors text-slate-700 dark:text-slate-200"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

      <button
        type="button"
        onClick={onDriveClick}
        title={
          !isDriveConnected
            ? 'Lưu & mở bảng trên Google Drive'
            : syncStatus === 'saving'
            ? 'Đang tự động lưu lên Google Drive...'
            : syncStatus === 'pending'
            ? 'Có thay đổi mới, sắp tự động lưu lên Google Drive...'
            : syncStatus === 'saved'
            ? `Đã lưu lên Google Drive${lastSyncedAt ? ` lúc ${formatSyncTime(lastSyncedAt)}` : ''}`
            : syncStatus === 'error'
            ? 'Lỗi đồng bộ Google Drive — bấm để xem chi tiết'
            : autoSaveEnabled
            ? 'Google Drive (Tự động lưu đang bật)'
            : 'Google Drive (Tự động lưu đang tắt)'
        }
        aria-label="Google Drive"
        className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl font-medium text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          isDriveConnected && syncStatus === 'error'
            ? 'bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300'
            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200'
        }`}
      >
        {isDriveConnected && syncStatus === 'saving' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
        ) : isDriveConnected && syncStatus === 'saved' ? (
          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : isDriveConnected && syncStatus === 'error' ? (
          <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
        ) : (
          <Cloud className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
        )}
        <span className="hidden lg:inline">
          {!isDriveConnected
            ? 'Drive'
            : syncStatus === 'saving'
            ? 'Đang lưu...'
            : syncStatus === 'pending'
            ? 'Chờ lưu...'
            : syncStatus === 'saved'
            ? 'Đã lưu'
            : syncStatus === 'error'
            ? 'Lỗi lưu'
            : 'Drive'}
        </span>
      </button>

      <button
        type="button"
        onClick={onExportClick}
        title="Xuất ảnh PNG hoặc sao lưu tệp JSON"
        aria-label="Xuất ảnh PNG"
        className="flex items-center gap-1.5 px-2 lg:px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-medium text-xs hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Xuất PNG</span>
      </button>

      {boardType === 'math' && onToggleMathPanel && (
        <button
          type="button"
          data-testid="toggle-math-panel-button"
          onClick={onToggleMathPanel}
          aria-pressed={isMathPanelOpen}
          title={isMathPanelOpen ? 'Ẩn bảng công cụ Toán học' : 'Mở bảng công cụ Toán học'}
          aria-label="Công cụ Toán học"
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl font-semibold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isMathPanelOpen
              ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700'
              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200'
          }`}
        >
          <Sigma className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden xl:inline">Toán</span>
        </button>
      )}

      {elementCount > 0 && (
        <div className="relative hidden sm:block" ref={clearPopoverRef}>
          <button
            type="button"
            onClick={() => setConfirmClear((v) => !v)}
            title="Xóa toàn bộ bảng"
            aria-label="Xóa toàn bộ bảng"
            aria-expanded={confirmClear}
            className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {confirmClear && (
            <div className="absolute left-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3.5 z-30">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1">
                Xóa toàn bộ bảng trắng?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Bạn vẫn có thể nhấn Hoàn tác (Ctrl+Z) nếu đổi ý.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearBoard();
                    setConfirmClear(false);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Xóa tất cả
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
