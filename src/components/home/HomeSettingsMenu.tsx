import React, { useCallback, useEffect, useRef, useState } from 'react';
import { detectUserOS } from '../../hooks/usePWAInstall';
import { useBoardStore } from '../../store/useBoardStore';
import {
  AppVersionManifest,
  UpdateCheckFailureReason,
  shouldPromptDesktopUpdate,
} from '../../engine/versionCheck';
import {
  DESKTOP_APP_DOWNLOADED_EVENT,
  DOWNLOAD_LINKS,
  DesktopUpdaterProgress,
  LATEST_DESKTOP_VERSION_FALLBACK,
  checkLatestVersionStatus,
  fetchLatestVersionManifest,
  getDownloadedBuildId,
  getDownloadedVersion,
  isDesktopApp,
  triggerDirectDownload,
} from '../../services/appUpdater';
import {
  CheckCircle2,
  Download,
  Laptop,
  Loader2,
  RefreshCw,
  Settings,
  WifiOff,
} from 'lucide-react';

export const PWAInstallTriggerButton: React.FC<{
  onOpenModal: () => void;
  compact?: boolean;
}> = ({ onOpenModal, compact = false }) => {
  const isDesktop = isDesktopApp();

  if (isDesktop) return null;

  return (
    <button
      type="button"
      data-testid="open-desktop-app-modal-button"
      onClick={onOpenModal}
      title="Tải ứng dụng fzInK (.exe cho Windows / .dmg cho macOS)"
      aria-label="Tải ứng dụng về máy tính"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
        compact
          ? 'h-8 px-2.5 text-xs font-medium'
          : 'h-9 w-9 sm:w-auto sm:px-3 text-xs font-medium'
      }`}
    >
      <Download className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.75} />
      <span className={compact ? 'hidden xl:inline' : 'hidden sm:inline'}>Tải ứng dụng</span>
    </button>
  );
};

interface HomeSettingsMenuProps {
  onOpenDesktopModal: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

type SettingsCheckState =
  | { status: 'idle' }
  | { status: 'up-to-date'; version: string; buildId: string }
  | {
      status: 'update-available';
      currentVersion: string;
      latestManifest: AppVersionManifest;
      sourceOrigin?: string;
    }
  | { status: 'not-installed'; latestManifest: AppVersionManifest | null }
  | { status: 'check-failed'; reason: UpdateCheckFailureReason; portalUrl?: string };

export const HomeSettingsMenu: React.FC<HomeSettingsMenuProps> = ({
  onOpenDesktopModal,
  theme,
  onToggleTheme,
}) => {
  const addToast = useBoardStore((s) => s.addToast);
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [latestDesktopVersion, setLatestDesktopVersion] = useState<string>(
    LATEST_DESKTOP_VERSION_FALLBACK
  );
  const [checkResult, setCheckResult] = useState<SettingsCheckState>({ status: 'idle' });
  const [hasUpdateBadge, setHasUpdateBadge] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DesktopUpdaterProgress | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isDesktop = isDesktopApp();

  const syncInitialBadge = useCallback(async () => {
    if (!isDesktop) return;
    const installedId = getDownloadedBuildId();
    const installedVer = getDownloadedVersion();
    const latest = await fetchLatestVersionManifest();
    if (latest?.version) {
      setLatestDesktopVersion(latest.version);
    }
    const isUpdateAvailable = shouldPromptDesktopUpdate({
      installedVersion: installedVer,
      installedBuildId: installedId,
      latest,
    });
    if (isUpdateAvailable && latest) {
      setHasUpdateBadge(true);
      setCheckResult({
        status: 'update-available',
        currentVersion: installedVer || installedId || 'v_fz.1.1.1.1.0',
        latestManifest: latest,
      });
    } else if (latest) {
      setHasUpdateBadge(false);
      setCheckResult({
        status: 'up-to-date',
        version: installedVer || latest.version,
        buildId: installedId || latest.buildId,
      });
    } else {
      setHasUpdateBadge(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (isDesktop) {
      void syncInitialBadge();
      const onDownloaded = () => {
        setHasUpdateBadge(false);
        const ver = getDownloadedVersion() || LATEST_DESKTOP_VERSION_FALLBACK;
        const id = getDownloadedBuildId() || '';
        setCheckResult({ status: 'up-to-date', version: ver, buildId: id });
      };
      window.addEventListener(DESKTOP_APP_DOWNLOADED_EVENT, onDownloaded);
      return () => window.removeEventListener(DESKTOP_APP_DOWNLOADED_EVENT, onDownloaded);
    }

    void fetchLatestVersionManifest().then((manifest) => {
      if (manifest?.version) {
        setLatestDesktopVersion(manifest.version);
      }
    });
  }, [isDesktop, syncInitialBadge]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCheckUpdateNow = async () => {
    setIsChecking(true);
    try {
      const result = await checkLatestVersionStatus();
      const installedId = getDownloadedBuildId();
      const installedVer = getDownloadedVersion();

      if (!result.ok) {
        setCheckResult({
          status: 'check-failed',
          reason: result.reason,
          portalUrl: result.portalUrl,
        });
        if (result.reason === 'offline') {
          addToast('Thiết bị đang ngoại tuyến. Vui lòng kiểm tra kết nối mạng.', 'info');
        } else if (result.reason === 'auth-or-cors-blocked') {
          addToast('Máy vẫn có mạng — cần mở trang web gốc trên trình duyệt để kiểm tra cập nhật.', 'info');
        } else if (result.reason === 'local-server-stopped') {
          addToast('Không kết nối được máy chủ cục bộ để kiểm tra bản mới.', 'info');
        } else if (result.reason === 'no-update-origin') {
          addToast('Bản cài đặt này chưa gắn địa chỉ trang web nguồn để kiểm tra tự động.', 'info');
        } else {
          addToast('Máy chủ phiên bản tạm thời không phản hồi.', 'info');
        }
        return;
      }

      const latest = result.manifest;
      const isUpdateAvailable = shouldPromptDesktopUpdate({
        installedVersion: installedVer,
        installedBuildId: installedId,
        latest,
      });

      if (isUpdateAvailable) {
        setHasUpdateBadge(true);
        setCheckResult({
          status: 'update-available',
          currentVersion: installedVer || installedId || 'Bản cũ',
          latestManifest: latest,
          sourceOrigin: result.sourceOrigin,
        });
        addToast(`Phát hiện phiên bản mới ${latest.version}`, 'success');
      } else {
        setHasUpdateBadge(false);
        setCheckResult({
          status: 'up-to-date',
          version: installedVer || latest.version,
          buildId: installedId || latest.buildId,
        });
        addToast(`Ứng dụng đang ở phiên bản mới nhất (${installedVer || latest.version})`, 'success');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleOneClickDesktopUpdate = async () => {
    if (typeof window !== 'undefined' && window.fzinkDesktopUpdater) {
      setIsApplyingUpdate(true);
      setDownloadProgress({ phase: 'downloading', percent: 0 });
      const unsubscribe = window.fzinkDesktopUpdater.onProgress((payload) => {
        setDownloadProgress(payload);
      });
      try {
        const res = await window.fzinkDesktopUpdater.downloadAndInstall();
        if (res.ok) {
          addToast(
            res.launched
              ? `Đã tải xong ${res.fileName} và đang mở trình cài đặt`
              : `Đã tải xong ${res.fileName} vào thư mục Downloads`,
            'success'
          );
          setIsOpen(false);
        } else {
          addToast(res.error || 'Không thể tải tự động. Hãy chọn bộ cài thủ công.', 'error');
        }
      } finally {
        unsubscribe();
        setIsApplyingUpdate(false);
        setDownloadProgress(null);
      }
      return;
    }

    const userOs = detectUserOS();
    if (userOs === 'macos') {
      setIsOpen(false);
      onOpenDesktopModal();
    } else {
      addToast('Đang tải bộ cài đặt fzInK-Setup.exe', 'info');
      triggerDirectDownload(DOWNLOAD_LINKS.windowsSetup, 'fzInK-Setup.exe');
    }
  };

  const currentVersionLabel =
    getDownloadedVersion() ||
    (typeof window !== 'undefined' && window.__BTTM_EMBEDDED_BUILD__?.version) ||
    LATEST_DESKTOP_VERSION_FALLBACK;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        data-testid="home-settings-button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-label="Cài đặt hệ thống"
        title="Cài đặt hệ thống"
        className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer shrink-0 ${
          isOpen
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        <Settings className="w-4 h-4" strokeWidth={1.75} />
        {isDesktop && hasUpdateBadge && (
          <span
            data-testid="settings-update-badge"
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900"
          />
        )}
      </button>

      {isOpen && (
        <div
          data-testid="home-settings-dropdown"
          role="dialog"
          aria-label="Bảng cài đặt hệ thống"
          className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-lg dark:shadow-none border border-slate-200 dark:border-slate-800 p-4 z-40 space-y-3"
        >
          {isDesktop ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    Cài đặt & phiên bản
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Ứng dụng máy tính
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                  {currentVersionLabel}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Cập nhật ứng dụng
                  </span>
                  <button
                    type="button"
                    data-testid="check-update-button"
                    disabled={isChecking || isApplyingUpdate}
                    onClick={() => void handleCheckUpdateNow()}
                    className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {isChecking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
                    )}
                    <span>{isChecking ? 'Đang kiểm tra' : 'Kiểm tra cập nhật'}</span>
                  </button>
                </div>

                {checkResult.status === 'up-to-date' && (
                  <div
                    data-testid="update-status-up-to-date"
                    className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
                    <span>
                      Đang dùng bản mới nhất (<strong className="font-mono font-medium">{checkResult.version}</strong>)
                    </span>
                  </div>
                )}

                {checkResult.status === 'update-available' && (
                  <div
                    data-testid="update-status-available"
                    className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" strokeWidth={1.75} />
                      <span>Đã có phiên bản mới {checkResult.latestManifest.version}</span>
                    </div>
                    <div className="text-amber-800/90 dark:text-amber-300/90">
                      Hiện tại: <span className="font-mono font-medium">{checkResult.currentVersion}</span> → Mới nhất:{' '}
                      <span className="font-mono font-medium">{checkResult.latestManifest.version}</span>
                    </div>

                    <div className="space-y-1.5 pt-0.5">
                      <button
                        type="button"
                        data-testid="in-place-update-button"
                        disabled={isApplyingUpdate}
                        onClick={() => void handleOneClickDesktopUpdate()}
                        className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                      >
                        {isApplyingUpdate ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>
                              {downloadProgress?.phase === 'launching'
                                ? 'Đang mở trình cài đặt'
                                : downloadProgress && downloadProgress.percent > 0
                                ? `Đang tải cập nhật (${downloadProgress.percent}%)`
                                : 'Đang tải bản cập nhật'}
                            </span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Cập nhật ngay</span>
                          </>
                        )}
                      </button>

                      {isApplyingUpdate && downloadProgress && downloadProgress.percent > 0 && (
                        <div className="w-full h-1.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 transition-[width] duration-150"
                            style={{ width: `${downloadProgress.percent}%` }}
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        data-testid="update-now-open-modal-button"
                        disabled={isApplyingUpdate}
                        onClick={() => {
                          setIsOpen(false);
                          onOpenDesktopModal();
                        }}
                        className="w-full h-8 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 hover:bg-amber-100/50 dark:hover:bg-slate-800 text-amber-900 dark:text-amber-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>Chọn bộ cài khác (.exe / .dmg)</span>
                      </button>
                    </div>
                  </div>
                )}

                {checkResult.status === 'not-installed' && (
                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 space-y-2 text-xs">
                    <div className="text-slate-700 dark:text-slate-200">
                      Phiên bản mới nhất:{' '}
                      <strong className="font-mono font-medium">
                        {checkResult.latestManifest?.version || LATEST_DESKTOP_VERSION_FALLBACK}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenDesktopModal();
                      }}
                      className="w-full h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Tải bộ cài (.exe / Mac)</span>
                    </button>
                  </div>
                )}

                {checkResult.status === 'check-failed' && checkResult.reason === 'offline' && (
                  <div
                    data-testid="update-status-offline"
                    className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200"
                  >
                    <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
                    <span>
                      Thiết bị đang ngoại tuyến — Kết nối mạng để kiểm tra phiên bản mới.
                    </span>
                  </div>
                )}

                {checkResult.status === 'check-failed' &&
                  (checkResult.reason === 'no-update-origin' || checkResult.reason === 'server-unreachable') && (
                    <div
                      data-testid="update-status-unreachable"
                      className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed"
                    >
                      Máy chủ kiểm tra phiên bản tạm thời không phản hồi. Vui lòng thử lại sau.
                    </div>
                  )}
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="w-full h-9 flex items-center justify-between px-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
                >
                  <span>Giao diện hiển thị</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {theme === 'dark' ? 'Chế độ tối' : 'Chế độ sáng'}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="settings-open-installer-modal-button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenDesktopModal();
                  }}
                  className="w-full h-9 flex items-center justify-between px-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
                >
                  <span>Bộ cài đặt máy tính (.exe / .dmg)</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Tải lại
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    Cài đặt hệ thống
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Phiên bản web trực tuyến
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Trực tuyến
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-900 dark:text-slate-100">
                    <Laptop className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.75} />
                    <span>Ứng dụng máy tính</span>
                  </div>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {latestDesktopVersion}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Cài đặt trên Windows hoặc macOS để lưu trữ cục bộ và làm việc ngoại tuyến không cần mạng.
                </p>
                <button
                  type="button"
                  data-testid="web-open-download-modal-button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenDesktopModal();
                  }}
                  className="w-full h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                >
                  <Download className="w-4 h-4" strokeWidth={1.75} />
                  <span>Tải bộ cài đặt (.exe / Mac)</span>
                </button>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                Bản web luôn tự động cập nhật từ máy chủ
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
