import React, { useCallback, useEffect, useRef, useState } from 'react';
import { detectUserOS } from '../../hooks/usePWAInstall';
import { useBoardStore } from '../../store/useBoardStore';
import { useI18n } from '../../i18n/useI18n';
import {
  AppVersionManifest,
  UpdateCheckFailureReason,
  classifyDesktopUpdateKind,
  resolveOtaBundleUrl,
} from '../../engine/versionCheck';
import { formatFileSize } from '../../engine/documentUtils';
import {
  DESKTOP_APP_DOWNLOADED_EVENT,
  DOWNLOAD_LINKS,
  LATEST_DESKTOP_VERSION_FALLBACK,
  checkLatestVersionStatus,
  fetchLatestVersionManifest,
  getDownloadedBuildId,
  getDownloadedVersion,
  getInstalledNativeVersion,
  hasDesktopOtaSupport,
  isDesktopApp,
  triggerDirectDownload,
} from '../../services/appUpdater';
import { StartDesktopUpdateParams } from '../../hooks/useDesktopUpdate';
import {
  CheckCircle2,
  Download,
  Languages,
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
  const { t } = useI18n();
  const isDesktop = isDesktopApp();

  if (isDesktop) return null;

  return (
    <button
      type="button"
      data-testid="open-desktop-app-modal-button"
      onClick={onOpenModal}
      title={t(
        'Tải ứng dụng fzInK (.exe cho Windows / .dmg cho macOS)',
        'Download fzInK desktop app (.exe for Windows / .dmg for macOS)'
      )}
      aria-label={t('Tải ứng dụng về máy tính', 'Download desktop app')}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
        compact
          ? 'h-8 px-2.5 text-xs font-medium'
          : 'h-9 w-9 sm:w-auto sm:px-3 text-xs font-medium'
      }`}
    >
      <Download className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.75} />
      <span className={compact ? 'hidden xl:inline' : 'hidden sm:inline'}>
        {t('Tải ứng dụng', 'Download app')}
      </span>
    </button>
  );
};

interface HomeSettingsMenuProps {
  onOpenDesktopModal: () => void;
  onStartDesktopUpdate?: (params: StartDesktopUpdateParams) => void;
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
      updateKind: 'ota' | 'native';
      sourceOrigin?: string;
    }
  | { status: 'not-installed'; latestManifest: AppVersionManifest | null }
  | { status: 'check-failed'; reason: UpdateCheckFailureReason; portalUrl?: string };

export const HomeSettingsMenu: React.FC<HomeSettingsMenuProps> = ({
  onOpenDesktopModal,
  onStartDesktopUpdate,
  theme,
  onToggleTheme,
}) => {
  const addToast = useBoardStore((s) => s.addToast);
  const { language, setLanguage, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [latestDesktopVersion, setLatestDesktopVersion] = useState<string>(
    LATEST_DESKTOP_VERSION_FALLBACK
  );
  const [checkResult, setCheckResult] = useState<SettingsCheckState>({ status: 'idle' });
  const [hasUpdateBadge, setHasUpdateBadge] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isDesktop = isDesktopApp();

  const syncInitialBadge = useCallback(async () => {
    if (!isDesktop) return;
    const installedId = getDownloadedBuildId();
    const installedVer = getDownloadedVersion();
    const installedNativeVer = getInstalledNativeVersion();
    const status = await checkLatestVersionStatus();
    if (!status.ok) {
      setHasUpdateBadge(false);
      return;
    }
    const latest = status.manifest;
    if (latest.version) {
      setLatestDesktopVersion(latest.version);
    }
    const updateKind = classifyDesktopUpdateKind({
      installedVersion: installedVer,
      installedBuildId: installedId,
      installedNativeVersion: installedNativeVer,
      hasOtaBridge: hasDesktopOtaSupport(),
      latest,
    });
    if (updateKind !== 'none') {
      setHasUpdateBadge(true);
      setCheckResult({
        status: 'update-available',
        currentVersion: installedVer || installedId || 'v_fz.1.1.1.1.0',
        latestManifest: latest,
        updateKind,
        sourceOrigin: status.sourceOrigin,
      });
    } else {
      setHasUpdateBadge(false);
      setCheckResult({
        status: 'up-to-date',
        version: installedVer || latest.version,
        buildId: installedId || latest.buildId,
      });
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
          addToast(
            t(
              'Thiết bị đang ngoại tuyến. Vui lòng kiểm tra kết nối mạng.',
              'Device is offline. Please check your internet connection.'
            ),
            'info'
          );
        } else if (result.reason === 'auth-or-cors-blocked') {
          addToast(
            t(
              'Máy vẫn có mạng — cần mở trang web gốc trên trình duyệt để kiểm tra cập nhật.',
              'You are online — please open the web portal in your browser to check for updates.'
            ),
            'info'
          );
        } else if (result.reason === 'local-server-stopped') {
          addToast(
            t(
              'Không kết nối được máy chủ cục bộ để kiểm tra bản mới.',
              'Could not reach the local server to check for updates.'
            ),
            'info'
          );
        } else if (result.reason === 'no-update-origin') {
          addToast(
            t(
              'Bản cài đặt này chưa gắn địa chỉ trang web nguồn để kiểm tra tự động.',
              'This build does not have a source web origin configured for automatic update checks.'
            ),
            'info'
          );
        } else {
          addToast(
            t(
              'Máy chủ phiên bản tạm thời không phản hồi.',
              'The version server is temporarily unreachable.'
            ),
            'info'
          );
        }
        return;
      }

      const latest = result.manifest;
      const installedNativeVer = getInstalledNativeVersion();
      const updateKind = classifyDesktopUpdateKind({
        installedVersion: installedVer,
        installedBuildId: installedId,
        installedNativeVersion: installedNativeVer,
        hasOtaBridge: hasDesktopOtaSupport(),
        latest,
      });

      if (updateKind !== 'none') {
        setHasUpdateBadge(true);
        setCheckResult({
          status: 'update-available',
          currentVersion: installedVer || installedId || t('Bản cũ', 'Previous version'),
          latestManifest: latest,
          updateKind,
          sourceOrigin: result.sourceOrigin,
        });
        addToast(
          t(
            `Phát hiện phiên bản mới ${latest.version}`,
            `New version available: ${latest.version}`
          ),
          'success'
        );
      } else {
        setHasUpdateBadge(false);
        setCheckResult({
          status: 'up-to-date',
          version: installedVer || latest.version,
          buildId: installedId || latest.buildId,
        });
        addToast(
          t(
            `Ứng dụng đang ở phiên bản mới nhất (${installedVer || latest.version})`,
            `You are on the latest version (${installedVer || latest.version})`
          ),
          'success'
        );
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleOneClickDesktopUpdate = () => {
    if (checkResult.status === 'update-available' && onStartDesktopUpdate && typeof window !== 'undefined' && window.fzinkDesktopUpdater) {
      const originForOta =
        checkResult.sourceOrigin ||
        checkResult.latestManifest.updateOrigin ||
        window.__BTTM_EMBEDDED_BUILD__?.updateOrigin ||
        '';
      const resolvedOtaUrl =
        checkResult.updateKind === 'ota'
          ? resolveOtaBundleUrl(originForOta, checkResult.latestManifest.otaBundleUrl)
          : null;

      setIsOpen(false);
      onStartDesktopUpdate({
        currentVersion: checkResult.currentVersion,
        targetVersion: checkResult.latestManifest.version,
        targetBuildId: checkResult.latestManifest.buildId,
        notes: checkResult.latestManifest.notes,
        updateKind: resolvedOtaUrl ? 'ota' : 'native',
        otaBundleUrl: resolvedOtaUrl || undefined,
        otaBundleSha256: checkResult.latestManifest.otaBundleSha256,
      });
      return;
    }

    const userOs = detectUserOS();
    if (userOs === 'macos') {
      setIsOpen(false);
      onOpenDesktopModal();
    } else {
      addToast(
        t('Đang tải bộ cài đặt fzInK-Setup.exe', 'Downloading fzInK-Setup.exe installer'),
        'info'
      );
      triggerDirectDownload(DOWNLOAD_LINKS.windowsSetup, 'fzInK-Setup.exe');
    }
  };

  const currentVersionLabel =
    getDownloadedVersion() ||
    (typeof window !== 'undefined' && window.__BTTM_EMBEDDED_BUILD__?.version) ||
    LATEST_DESKTOP_VERSION_FALLBACK;

  const languageControl = (
    <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 min-w-0">
        <Languages className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.75} />
        <span className="truncate">{t('Ngôn ngữ', 'Language')}</span>
      </div>
      <div
        role="radiogroup"
        aria-label={t('Chọn ngôn ngữ hiển thị', 'Select display language')}
        className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 shrink-0"
      >
        {(
          [
            { id: 'vi' as const, label: 'Tiếng Việt' },
            { id: 'en' as const, label: 'English' },
          ] as const
        ).map((opt) => {
          const active = language === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`language-option-${opt.id}`}
              onClick={() => setLanguage(opt.id)}
              className={`h-7 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        data-testid="home-settings-button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-label={t('Cài đặt hệ thống', 'System settings')}
        title={t('Cài đặt hệ thống', 'System settings')}
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
          aria-label={t('Bảng cài đặt hệ thống', 'System settings panel')}
          className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-lg dark:shadow-none border border-slate-200 dark:border-slate-800 p-4 z-40 space-y-3" /* taste-skill-ignore */
        >
          {isDesktop ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    {t('Cài đặt & phiên bản', 'Settings & version')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {t('Ứng dụng máy tính', 'Desktop app')}
                  </div>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                  {currentVersionLabel}
                </span>
              </div>

              {languageControl}

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {t('Cập nhật ứng dụng', 'App updates')}
                  </span>
                  <button
                    type="button"
                    data-testid="check-update-button"
                    disabled={isChecking}
                    onClick={() => void handleCheckUpdateNow()}
                    className="h-7 px-2.5 rounded-lg bg-[#1d5fbf] hover:bg-[#174ea1] dark:bg-[#2a6fd1] dark:hover:bg-[#3b80e0] disabled:opacity-60 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {isChecking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
                    )}
                    <span>
                      {isChecking
                        ? t('Đang kiểm tra', 'Checking...')
                        : t('Kiểm tra cập nhật', 'Check for updates')}
                    </span>
                  </button>
                </div>

                {checkResult.status === 'up-to-date' && (
                  <div
                    data-testid="update-status-up-to-date"
                    className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
                    <span>
                      {t('Đang dùng bản mới nhất', 'Up to date')} (
                      <strong className="font-medium tabular-nums">{checkResult.version}</strong>)
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
                      <span>
                        {t(
                          `Đã có phiên bản mới ${checkResult.latestManifest.version}`,
                          `New version available: ${checkResult.latestManifest.version}`
                        )}
                      </span>
                    </div>
                    <div className="text-amber-800/90 dark:text-amber-300/90 tabular-nums">
                      {t('Hiện tại:', 'Current:')}{' '}
                      <span className="font-medium">{checkResult.currentVersion}</span> →{' '}
                      {t('Mới nhất:', 'Latest:')}{' '}
                      <span className="font-medium">{checkResult.latestManifest.version}</span>
                    </div>
                    <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                      {checkResult.updateKind === 'ota'
                        ? t(
                            `Cập nhật nhanh (OTA)${checkResult.latestManifest.otaBundleSize ? ` · ${formatFileSize(checkResult.latestManifest.otaBundleSize)}` : ''} · Áp dụng ngay không cần cài lại`,
                            `Quick update (OTA)${checkResult.latestManifest.otaBundleSize ? ` · ${formatFileSize(checkResult.latestManifest.otaBundleSize)}` : ''} · Applies without reinstalling`
                          )
                        : t(
                            'Cập nhật lớn · Cần tải và chạy bộ cài đặt mới',
                            'Major update · Requires downloading the new installer'
                          )}
                    </div>

                    <div className="space-y-1.5 pt-0.5">
                      <button
                        type="button"
                        data-testid="in-place-update-button"
                        onClick={handleOneClickDesktopUpdate}
                        className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>
                          {checkResult.updateKind === 'ota'
                            ? t('Cập nhật nhanh ngay', 'Quick update now')
                            : t('Cập nhật ngay', 'Update now')}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-testid="update-now-open-modal-button"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenDesktopModal();
                        }}
                        className="w-full h-8 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 hover:bg-amber-100/50 dark:hover:bg-slate-800 text-amber-900 dark:text-amber-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>{t('Chọn bộ cài khác (.exe / .dmg)', 'Choose another installer (.exe / .dmg)')}</span>
                      </button>
                    </div>
                  </div>
                )}

                {checkResult.status === 'not-installed' && (
                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 space-y-2 text-xs">
                    <div className="text-slate-700 dark:text-slate-200">
                      {t('Phiên bản mới nhất:', 'Latest version:')}{' '}
                      <strong className="font-medium tabular-nums">
                        {checkResult.latestManifest?.version || LATEST_DESKTOP_VERSION_FALLBACK}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenDesktopModal();
                      }}
                      className="w-full h-8 rounded-lg bg-[#1d5fbf] hover:bg-[#174ea1] dark:bg-[#2a6fd1] dark:hover:bg-[#3b80e0] text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>{t('Tải bộ cài (.exe / Mac)', 'Download installer (.exe / Mac)')}</span>
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
                      {t(
                        'Thiết bị đang ngoại tuyến. Hãy kết nối mạng để kiểm tra phiên bản mới.',
                        'Device is offline. Connect to the internet to check for updates.'
                      )}
                    </span>
                  </div>
                )}

                {checkResult.status === 'check-failed' &&
                  (checkResult.reason === 'no-update-origin' ||
                    checkResult.reason === 'server-unreachable' ||
                    checkResult.reason === 'auth-or-cors-blocked' ||
                    checkResult.reason === 'local-server-stopped') && (
                    <div
                      data-testid="update-status-unreachable"
                      className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-1.5"
                    >
                      <p>
                        {checkResult.reason === 'auth-or-cors-blocked'
                          ? t(
                              'Không thể kiểm tra trực tiếp từ ứng dụng, hãy mở trang web gốc trên trình duyệt để kiểm tra.',
                              'Cannot check directly from the app. Please open the web portal in your browser.'
                            )
                          : checkResult.reason === 'local-server-stopped'
                          ? t(
                              'Không kết nối được máy chủ cục bộ để kiểm tra phiên bản mới.',
                              'Could not reach the local server to check for updates.'
                            )
                          : t(
                              'Máy chủ kiểm tra phiên bản tạm thời không phản hồi. Vui lòng thử lại sau.',
                              'The update server is temporarily unreachable. Please try again later.'
                            )}
                      </p>
                      {checkResult.portalUrl && (
                        <a
                          href={checkResult.portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block font-medium text-[#1d5fbf] dark:text-[#669df6] hover:underline"
                        >
                          {t('Mở trang web fzInK', 'Open fzInK web portal')}
                        </a>
                      )}
                    </div>
                  )}
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="w-full h-9 flex items-center justify-between px-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
                >
                  <span>{t('Giao diện hiển thị', 'Appearance')}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {theme === 'dark' ? t('Chế độ tối', 'Dark mode') : t('Chế độ sáng', 'Light mode')}
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
                  <span>{t('Bộ cài đặt máy tính (.exe / .dmg)', 'Desktop installer (.exe / .dmg)')}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t('Tải lại', 'Re-download')}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    {t('Cài đặt hệ thống', 'System settings')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {t('Phiên bản web trực tuyến', 'Online web app')}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {t('Trực tuyến', 'Online')}
                </span>
              </div>

              {languageControl}

              <button
                type="button"
                onClick={onToggleTheme}
                className="w-full h-9 flex items-center justify-between px-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
              >
                <span>{t('Giao diện hiển thị', 'Appearance')}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {theme === 'dark' ? t('Chế độ tối', 'Dark mode') : t('Chế độ sáng', 'Light mode')}
                </span>
              </button>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-900 dark:text-slate-100">
                    <Laptop className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.75} />
                    <span>{t('Ứng dụng máy tính', 'Desktop app')}</span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {latestDesktopVersion}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t(
                    'Cài đặt trên Windows hoặc macOS để lưu trữ cục bộ và làm việc ngoại tuyến không cần mạng.',
                    'Install on Windows or macOS for local storage and reliable offline work.'
                  )}
                </p>
                <button
                  type="button"
                  data-testid="web-open-download-modal-button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenDesktopModal();
                  }}
                  className="w-full h-9 rounded-lg bg-[#1d5fbf] hover:bg-[#174ea1] dark:bg-[#2a6fd1] dark:hover:bg-[#3b80e0] text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                >
                  <Download className="w-4 h-4" strokeWidth={1.75} />
                  <span>{t('Tải bộ cài đặt (.exe / Mac)', 'Download installer (.exe / Mac)')}</span>
                </button>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                {t(
                  'Bản web luôn tự động cập nhật từ máy chủ',
                  'Web version stays automatically updated from the server'
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
