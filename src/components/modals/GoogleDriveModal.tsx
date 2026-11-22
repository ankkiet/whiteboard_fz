import React, { useEffect, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { formatFileSize } from '../../engine/documentUtils';
import { GoogleDriveWorkspaceState } from '../../hooks/useGoogleDriveWorkspace';
import {
  APP_DRIVE_FOLDER_NAME,
  DriveWhiteboardFile,
  formatDriveModifiedTime,
  isWhiteboardProjectFile,
} from '../../services/googleDriveUtils';
import { formatSyncTime } from '../../services/driveSyncUtils';
import { GoogleSignInButton } from '../home/GoogleSignInButton';
import {
  X,
  Cloud,
  CloudUpload,
  Image as ImageIcon,
  RefreshCw,
  Folder,
  FolderOpen,
  Trash2,
  LogOut,
  Loader2,
  FileJson,
  ExternalLink,
  AlertTriangle,
  Save,
  KeyRound,
} from 'lucide-react';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  drive: GoogleDriveWorkspaceState;
  onOpenAuthBridgeClick?: () => void;
}

type ConfirmAction =
  | { type: 'overwrite'; file: DriveWhiteboardFile }
  | { type: 'delete'; file: DriveWhiteboardFile }
  | { type: 'open'; file: DriveWhiteboardFile };

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  drive,
  onOpenAuthBridgeClick,
}) => {
  const elements = useBoardStore((s) => s.elements);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

  useEffect(() => {
    if (isOpen && !drive.needsAuth) {
      void drive.refreshFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, drive.needsAuth]);

  useEffect(() => {
    if (!isOpen) {
      setConfirmAction(null);
      drive.clearError();
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !drive.busyAction) {
        if (confirmAction) {
          setConfirmAction(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, drive.busyAction, confirmAction, onClose]);

  if (!isOpen) return null;

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);

    if (action.type === 'overwrite') {
      await drive.overwriteBoard(action.file);
      return;
    }

    if (action.type === 'delete') {
      await drive.deleteFile(action.file);
      return;
    }

    if (action.type === 'open') {
      const ok = await drive.openBoardFile(action.file, { resetHistory: false });
      if (ok) onClose();
    }
  };

  const handleRequestOpen = (file: DriveWhiteboardFile) => {
    if (elements.length > 0) {
      setConfirmAction({ type: 'open', file });
    } else {
      void (async () => {
        const ok = await drive.openBoardFile(file, { resetHistory: false });
        if (ok) onClose();
      })();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drive-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !drive.busyAction && !confirmAction) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl max-h-[86vh] flex flex-col text-slate-800 dark:text-slate-100 relative overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="drive-modal-title" className="text-base font-bold truncate">
                Lưu trữ Google Drive
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Tự động lưu gọn vào thư mục &ldquo;{APP_DRIVE_FOLDER_NAME}&rdquo; trên Drive
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(drive.busyAction)}
            aria-label="Đóng hộp thoại Google Drive"
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {drive.error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 space-y-2.5"
            >
              <p className="leading-relaxed">{drive.error.message}</p>
              {drive.error.actionUrl && (
                <a
                  href={drive.error.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                >
                  <span>{drive.error.actionLabel || 'Mở bảng điều khiển'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {drive.needsAuth ? (
            isFileProtocol ? (
              <div className="py-6 flex flex-col items-center text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Bản cài đặt tệp cục bộ hoạt động ngoại tuyến
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Theo quy định an toàn bảo mật của Google OAuth, giao thức tệp cục bộ (file://) không được phép thực hiện đăng nhập Google. Bảng vẽ của bạn vẫn được lưu trữ tự động trên ổ cứng máy tính.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Để đồng bộ dữ liệu lên Google Drive, bạn hãy bấm nút bên dưới để mở trình duyệt lấy mã kết nối an toàn về máy.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuthBridgeClick?.();
                    }}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Đăng nhập tự động qua trình duyệt</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <CloudUpload className="w-7 h-7" />
                </div>
                <div className="max-w-sm space-y-1.5">
                  <h3 className="text-sm font-bold">Kết nối tài khoản Google của bạn</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Ứng dụng chỉ truy cập các tệp bảng trắng do chính bạn tạo và lưu qua ứng dụng này trên Google Drive.
                  </p>
                </div>

                <GoogleSignInButton
                  testId="google-signin-button"
                  onClick={() => void drive.signIn()}
                  isLoading={drive.isLoggingIn}
                />
              </div>
            )
          ) : (
            <>
              {/* Account strip */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  {drive.user?.photoURL ? (
                    <img
                      src={drive.user.photoURL}
                      alt={drive.user.displayName || 'Google account'}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {(drive.user?.displayName || drive.user?.email || 'G')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">
                      {drive.user?.displayName || 'Tài khoản Google'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {drive.user?.email || 'Đã kết nối Google Drive'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void drive.signOut()}
                  disabled={Boolean(drive.busyAction)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>

              {/* Auto-save setting & real sync state */}
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Tự động lưu lên Google Drive
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {!drive.autoSaveEnabled
                      ? 'Đang tắt · Bấm nút bên dưới để lưu thủ công'
                      : drive.syncStatus === 'saving'
                      ? 'Đang đồng bộ lên Google Drive...'
                      : drive.syncStatus === 'pending'
                      ? 'Phát hiện thay đổi · Tự động lưu sau 2,5 giây...'
                      : drive.syncStatus === 'saved' && drive.lastSyncedAt
                      ? `Đã tự động lưu lúc ${formatSyncTime(drive.lastSyncedAt)}`
                      : drive.syncStatus === 'error'
                      ? 'Tự động lưu gặp lỗi · Hãy kiểm tra kết nối và thử lại'
                      : 'Tự động đồng bộ sau 2,5 giây ngừng chỉnh sửa'}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {drive.autoSaveEnabled &&
                    (drive.syncStatus === 'pending' || drive.syncStatus === 'error') && (
                      <button
                        type="button"
                        disabled={Boolean(drive.busyAction)}
                        onClick={() => void drive.flushAutoSaveNow()}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Lưu ngay
                      </button>
                    )}

                  <button
                    type="button"
                    role="switch"
                    data-testid="drive-autosave-toggle"
                    aria-checked={drive.autoSaveEnabled}
                    aria-label="Bật hoặc tắt tự động lưu lên Google Drive"
                    onClick={() => drive.setAutoSaveEnabled(!drive.autoSaveEnabled)}
                    className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                      drive.autoSaveEnabled
                        ? 'bg-indigo-600'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        drive.autoSaveEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Dedicated Folder Info & Optional Organize Action */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 min-w-0">
                  <Folder className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">
                    Thư mục lưu:{' '}
                    <strong className="font-semibold text-slate-900 dark:text-slate-100">
                      {drive.appFolder?.name || APP_DRIVE_FOLDER_NAME}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {drive.unorganizedCount > 0 && (
                    <button
                      type="button"
                      disabled={Boolean(drive.busyAction)}
                      onClick={() => void drive.organizeFilesIntoFolder()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {drive.busyAction === 'organize' && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <span>Gom {drive.unorganizedCount} tệp cũ</span>
                    </button>
                  )}
                  {drive.appFolder?.webViewLink && (
                    <a
                      href={drive.appFolder.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <span>Mở thư mục</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Save actions */}
              <div className="space-y-2.5">
                {drive.activeDriveFile && (
                  <button
                    type="button"
                    disabled={Boolean(drive.busyAction)}
                    onClick={() =>
                      setConfirmAction({ type: 'overwrite', file: drive.activeDriveFile! })
                    }
                    className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-white/15 shrink-0">
                        {drive.busyAction === `overwrite:${drive.activeDriveFile.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">
                          Cập nhật tệp đang mở: {drive.activeDriveFile.name}
                        </div>
                        <div className="text-[11px] text-emerald-100">
                          Ghi đè phiên bản mới nhất của bảng lên tệp hiện có trên Drive
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={Boolean(drive.busyAction)}
                    onClick={() => void drive.saveNewBoard()}
                    className="flex items-center gap-2.5 p-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white transition-colors text-left cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-white/15 shrink-0">
                      {drive.busyAction === 'save-new' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CloudUpload className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">
                        {drive.busyAction === 'save-new' ? 'Đang lưu...' : 'Lưu bản dự án mới'}
                      </div>
                      <div className="text-[11px] text-indigo-100 truncate tabular-nums">
                        .whiteboard.json ({elements.length} đối tượng)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(drive.busyAction)}
                    onClick={() => void drive.savePngSnapshot()}
                    className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 disabled:opacity-60 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition-colors text-left cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shrink-0">
                      {drive.busyAction === 'save-png' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">
                        {drive.busyAction === 'save-png' ? 'Đang xuất 4×...' : 'Lưu ảnh PNG 4×'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Ảnh chất lượng cao nhất lên Drive
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Saved files list */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    Tệp bảng trắng của bạn trên Google Drive ({drive.files.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => void drive.refreshFiles()}
                    disabled={drive.isLoadingFiles || Boolean(drive.busyAction)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${drive.isLoadingFiles ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                  </button>
                </div>

                {drive.isLoadingFiles && drive.files.length === 0 ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    <span className="text-xs">Đang tải danh sách tệp từ Google Drive...</span>
                  </div>
                ) : drive.files.length === 0 ? (
                  <div className="py-7 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                    Chưa có tệp bảng trắng nào trên Google Drive. Bấm{' '}
                    <strong>Lưu bản dự án mới</strong> ở trên để lưu bảng hiện tại.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200/80 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {drive.files.map((file) => {
                      const isBoard = isWhiteboardProjectFile(file);
                      const isCurrent = drive.activeDriveFile?.id === file.id;
                      const sizeNum = file.size ? Number(file.size) : 0;

                      return (
                        <div
                          key={file.id}
                          className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                            isCurrent
                              ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                              : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isBoard
                                  ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400'
                                  : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {isBoard ? (
                                <FileJson className="w-4 h-4" />
                              ) : (
                                <ImageIcon className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">{file.name}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                                {formatDriveModifiedTime(file.modifiedTime)}
                                {sizeNum > 0 ? ` · ${formatFileSize(sizeNum)}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isBoard ? (
                              <>
                                <button
                                  type="button"
                                  disabled={Boolean(drive.busyAction)}
                                  onClick={() => handleRequestOpen(file)}
                                  title="Mở bảng này từ Google Drive"
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 text-xs font-medium transition-colors cursor-pointer"
                                >
                                  {drive.busyAction === `open:${file.id}` ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <FolderOpen className="w-3.5 h-3.5" />
                                  )}
                                  <span>Mở</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={Boolean(drive.busyAction)}
                                  onClick={() => setConfirmAction({ type: 'overwrite', file })}
                                  title="Ghi đè bảng hiện tại lên tệp này"
                                  aria-label={`Ghi đè ${file.name}`}
                                  className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Xem ảnh trên Google Drive"
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Xem</span>
                                </a>
                              )
                            )}

                            <button
                              type="button"
                              disabled={Boolean(drive.busyAction)}
                              onClick={() => setConfirmAction({ type: 'delete', file })}
                              title="Xóa tệp khỏi Google Drive"
                              aria-label={`Xóa ${file.name}`}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                            >
                              {drive.busyAction === `delete:${file.id}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Explicit Confirmation Overlay for Overwrite / Delete / Replace-Open */}
        {confirmAction && (
          <div className="absolute inset-0 z-10 bg-slate-950/50 flex items-center justify-center p-5">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm w-full p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    confirmAction.type === 'delete'
                      ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold">
                    {confirmAction.type === 'delete'
                      ? 'Xóa tệp khỏi Google Drive?'
                      : confirmAction.type === 'overwrite'
                      ? 'Ghi đè tệp trên Google Drive?'
                      : 'Mở bảng từ Google Drive?'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed break-words">
                    {confirmAction.type === 'delete'
                      ? `Bạn có chắc muốn xóa vĩnh viễn "${confirmAction.file.name}" khỏi Google Drive? Thao tác này không thể hoàn tác.`
                      : confirmAction.type === 'overwrite'
                      ? `Nội dung cũ của tệp "${confirmAction.file.name}" trên Google Drive sẽ bị thay thế bằng bảng trắng hiện tại (${elements.length} đối tượng).`
                      : `Tệp "${confirmAction.file.name}" sẽ thay thế nội dung bảng hiện tại (bạn vẫn có thể nhấn Hoàn tác Ctrl+Z nếu cần).`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void executeConfirmedAction()}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-colors cursor-pointer ${
                    confirmAction.type === 'delete'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {confirmAction.type === 'delete'
                    ? 'Xác nhận xóa'
                    : confirmAction.type === 'overwrite'
                    ? 'Xác nhận ghi đè'
                    : 'Mở bảng'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
