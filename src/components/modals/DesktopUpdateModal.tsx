import React, { useEffect } from 'react';
import { AppLogo } from '../ui/AppLogo';
import { DesktopUpdateSession } from '../../hooks/useDesktopUpdate';
import { DOWNLOAD_LINKS, formatDownloadEta } from '../../services/appUpdater';
import { formatFileSize } from '../../engine/documentUtils';
import { detectUserOS } from '../../hooks/usePWAInstall';
import { useI18n } from '../../i18n/useI18n';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';

interface DesktopUpdateModalProps {
  session: DesktopUpdateSession | null;
  onCancel: () => void;
  onRetry: () => void;
  onClose: () => void;
}

function resolveBrowserDownloadUrl(fileName?: string): string {
  if (fileName === 'fzInK-Portable.exe') return DOWNLOAD_LINKS.windowsPortable;
  if (fileName === 'fzInK-macOS-arm64.dmg') return DOWNLOAD_LINKS.macosArm64Dmg;
  if (fileName === 'fzInK-macOS-x64.dmg') return DOWNLOAD_LINKS.macosX64Dmg;
  const os = detectUserOS();
  if (os === 'macos') return DOWNLOAD_LINKS.macosArm64Dmg;
  return DOWNLOAD_LINKS.windowsSetup;
}

function formatSpeed(speedBps: number): string {
  if (!Number.isFinite(speedBps) || speedBps <= 0) return '';
  return `${formatFileSize(speedBps)}/s`;
}

export const DesktopUpdateModal: React.FC<DesktopUpdateModalProps> = ({
  session,
  onCancel,
  onRetry,
  onClose,
}) => {
  const { language, t } = useI18n();

  const isBusy =
    session !== null &&
    (session.status === 'saving' ||
      session.status === 'preparing' ||
      session.status === 'downloading' ||
      session.status === 'launching');

  useEffect(() => {
    if (!session) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, isBusy, onClose]);

  if (!session) return null;

  const progress = session.progress;
  const receivedBytes = progress?.receivedBytes ?? 0;
  const totalBytes = progress?.totalBytes ?? 0;
  const speedBps = progress?.speedBps ?? 0;
  const percent = progress?.percent ?? 0;
  const hasKnownPercent = percent >= 0;

  const step1Done =
    session.status !== 'saving' && session.status !== 'preparing';
  const step2Done =
    session.status === 'launching' || session.status === 'completed';
  const step3Done = session.status === 'completed';

  const speedLabel = formatSpeed(speedBps);
  const etaLabel =
    session.status === 'downloading' && totalBytes > 0 && speedBps > 0
      ? formatDownloadEta(receivedBytes, totalBytes, speedBps, language)
      : '';

  const browserDownloadUrl = resolveBrowserDownloadUrl(session.fileName);

  return (
    <div
      data-testid="desktop-update-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desktop-update-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm select-text"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <AppLogo size={40} className="rounded-xl shrink-0" />
            <div className="min-w-0">
              <h2 id="desktop-update-title" className="text-base font-semibold truncate">
                {session.status === 'completed'
                  ? t('Tải cập nhật hoàn tất', 'Update ready')
                  : session.status === 'error'
                  ? t('Cập nhật chưa thành công', 'Update failed')
                  : t('Đang cập nhật ứng dụng', 'Updating application')}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                <span>{session.currentVersion}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  {session.targetVersion}
                </span>
              </div>
            </div>
          </div>

          {!isBusy && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('Đóng', 'Close')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {session.notes && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {session.notes}
            </div>
          )}

          {/* 3-step checklist */}
          <div className="space-y-3">
            {/* Step 1: Save & connect */}
            <div className="flex items-center gap-3 text-xs">
              {step1Done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : session.status === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
              )}
              <span
                className={
                  step1Done
                    ? 'text-slate-600 dark:text-slate-300'
                    : 'font-medium text-slate-900 dark:text-slate-100'
                }
              >
                {session.status === 'saving'
                  ? t('Đang lưu dữ liệu bảng viết hiện tại...', 'Saving current board data...')
                  : step1Done
                  ? t('Đã lưu dữ liệu bảng và kết nối máy chủ', 'Board saved & server connected')
                  : t('Đang kết nối máy chủ tải về...', 'Connecting to update server...')}
              </span>
            </div>

            {/* Step 2: Download */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  {step2Done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : session.status === 'downloading' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-700 shrink-0" />
                  )}
                  <span
                    className={`truncate ${
                      session.status === 'downloading'
                        ? 'font-medium text-slate-900 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {session.fileName
                      ? t(`Tải gói cài đặt (${session.fileName})`, `Download installer (${session.fileName})`)
                      : t('Tải gói cài đặt mới', 'Download new installer')}
                  </span>
                </div>

                {session.status === 'downloading' && hasKnownPercent && (
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0">
                    {percent}%
                  </span>
                )}
              </div>

              {(session.status === 'downloading' ||
                session.status === 'launching' ||
                session.status === 'completed') && (
                <div className="pl-7 space-y-1.5">
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    {hasKnownPercent ? (
                      <div
                        className={`h-full transition-[width] duration-150 ${
                          step2Done ? 'bg-emerald-600' : 'bg-indigo-600'
                        }`}
                        style={{
                          width: `${step2Done ? 100 : Math.max(2, percent)}%`,
                        }}
                      />
                    ) : (
                      <div className="h-full w-1/3 bg-indigo-600 animate-pulse rounded-full" />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>
                      {totalBytes > 0
                        ? `${formatFileSize(receivedBytes)} / ${formatFileSize(totalBytes)}`
                        : receivedBytes > 0
                        ? formatFileSize(receivedBytes)
                        : t('Đang khởi tạo luồng tải...', 'Starting download stream...')}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      {speedLabel && <span>{speedLabel}</span>}
                      {etaLabel && <span>· {etaLabel}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Launch installer */}
            <div className="flex items-center gap-3 text-xs">
              {step3Done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : session.status === 'launching' ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-700 shrink-0" />
              )}
              <span
                className={
                  session.status === 'launching' || step3Done
                    ? 'font-medium text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400'
                }
              >
                {session.status === 'completed'
                  ? session.platform === 'darwin'
                    ? t(
                        'Đã mở tệp .dmg — kéo fzInK vào Applications để hoàn tất',
                        'Opened .dmg — drag fzInK into Applications to finish'
                      )
                    : session.launched
                    ? t(
                        'Đã mở trình cài đặt — ứng dụng sẽ tự đóng trong giây lát',
                        'Installer launched — closing app to finish updating'
                      )
                    : t(
                        `Đã tải xong ${session.fileName || ''} vào thư mục Downloads`,
                        `Downloaded ${session.fileName || ''} to your Downloads folder`
                      )
                  : t('Mở trình cài đặt và áp dụng bản mới', 'Launch installer & apply update')}
              </span>
            </div>
          </div>

          {session.status === 'error' && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold">
                  {t('Không thể hoàn tất tải cập nhật', 'Could not complete update download')}
                </div>
                <p className="leading-relaxed">{session.errorMessage}</p>
              </div>
            </div>
          )}

          {/* Footer info & actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {isBusy
                  ? t('Tạm khóa thao tác bảng để bảo vệ dữ liệu', 'Board locked safely during update')
                  : t('Dữ liệu bảng của bạn đã được lưu an toàn', 'Your board data is safely saved')}
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {isBusy && session.status !== 'launching' && (
                <button
                  type="button"
                  data-testid="cancel-desktop-update-button"
                  onClick={onCancel}
                  className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  {t('Hủy cập nhật', 'Cancel update')}
                </button>
              )}

              {session.status === 'error' && (
                <>
                  <a
                    href={browserDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>{t('Tải qua trình duyệt', 'Download in browser')}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    {t('Quay lại', 'Back')}
                  </button>
                  <button
                    type="button"
                    data-testid="retry-desktop-update-button"
                    onClick={onRetry}
                    className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('Thử lại', 'Retry')}</span>
                  </button>
                </>
              )}

              {session.status === 'completed' && (!session.launched || session.platform === 'darwin') && (
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {t('Đóng & quay lại ứng dụng', 'Close & return to app')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
