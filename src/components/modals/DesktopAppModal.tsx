import React, { useState } from 'react';
import { detectUserOS, useOnlineStatus } from '../../hooks/usePWAInstall';
import {
  buildMacOSDesktopAppZip,
  buildMacOSSelfExtractingCommand,
  buildWindowsDesktopZip,
  buildWindowsExeInstaller,
} from '../../engine/desktopPackager';
import { useBoardStore } from '../../store/useBoardStore';
import {
  Download,
  X,
  Laptop,
  WifiOff,
  CheckCircle2,
  Monitor,
  Apple,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Info,
} from 'lucide-react';
import {
  AppVersionManifest,
  UpdateCheckFailureReason,
  UpdateCheckResult,
  buildUpdateOriginCandidates,
  classifyUpdateCheckFailure,
} from '../../engine/versionCheck';

export type { AppVersionManifest };

interface DesktopAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      data-testid="pwa-offline-indicator"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>Đang ngoại tuyến — Dữ liệu bảng vẫn tự động lưu trên máy</span>
    </div>
  );
};

const DESKTOP_APP_DOWNLOADED_KEY = 'bttm_desktop_app_downloaded_v1';
const DESKTOP_APP_DOWNLOADED_BUILD_ID_KEY = 'bttm_desktop_app_build_id_v1';
const DESKTOP_APP_DOWNLOADED_VERSION_KEY = 'bttm_desktop_app_version_v1';
const DESKTOP_APP_DOWNLOADED_EVENT = 'bttm:desktop-app-downloaded';

declare global {
  interface Window {
    __BTTM_EMBEDDED_BUILD__?: AppVersionManifest;
    __BTTM_VERSION_CALLBACK__?: (manifest: AppVersionManifest) => void;
  }
}

export function getDownloadedBuildId(): string | null {
  if (typeof window === 'undefined') return null;
  if (window.__BTTM_EMBEDDED_BUILD__?.buildId) {
    return window.__BTTM_EMBEDDED_BUILD__.buildId;
  }
  try {
    return window.localStorage.getItem(DESKTOP_APP_DOWNLOADED_BUILD_ID_KEY);
  } catch {
    return null;
  }
}

export function getDownloadedVersion(): string | null {
  if (typeof window === 'undefined') return null;
  if (window.__BTTM_EMBEDDED_BUILD__?.version) {
    return window.__BTTM_EMBEDDED_BUILD__.version;
  }
  try {
    return window.localStorage.getItem(DESKTOP_APP_DOWNLOADED_VERSION_KEY);
  } catch {
    return null;
  }
}

export function hasDesktopAppBeenDownloaded(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'file:') return true;
  try {
    return window.localStorage.getItem(DESKTOP_APP_DOWNLOADED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markDesktopAppAsDownloaded(manifest?: AppVersionManifest | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DESKTOP_APP_DOWNLOADED_KEY, 'true');
    if (manifest?.buildId) {
      window.localStorage.setItem(DESKTOP_APP_DOWNLOADED_BUILD_ID_KEY, manifest.buildId);
    }
    if (manifest?.version) {
      window.localStorage.setItem(DESKTOP_APP_DOWNLOADED_VERSION_KEY, manifest.version);
    }
  } catch {
    // ignore storage quota errors
  }
  window.dispatchEvent(new CustomEvent(DESKTOP_APP_DOWNLOADED_EVENT));
}

function fetchVersionViaJsonp(origin: string, timeoutMs = 4500): Promise<AppVersionManifest | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const script = document.createElement('script');
    const prevCallback = window.__BTTM_VERSION_CALLBACK__;

    const cleanup = () => {
      window.__BTTM_VERSION_CALLBACK__ = prevCallback;
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    }, timeoutMs);

    window.__BTTM_VERSION_CALLBACK__ = (manifest: AppVersionManifest) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      resolve(manifest?.buildId ? manifest : null);
    };

    script.async = true;
    script.src = `${origin}/app-version.js?t=${Date.now()}`;
    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      resolve(null);
    };
    document.head.appendChild(script);
  });
}

export async function checkLatestVersionStatus(): Promise<UpdateCheckResult> {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'server-unreachable' };
  }

  const embeddedOrigin = window.__BTTM_EMBEDDED_BUILD__?.updateOrigin;
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;

  if (!isOnline) {
    return {
      ok: false,
      reason: 'offline',
      portalUrl: embeddedOrigin || undefined,
    };
  }

  const candidates = buildUpdateOriginCandidates(
    window.location.protocol,
    window.location.origin,
    embeddedOrigin
  );

  if (candidates.length === 0) {
    return { ok: false, reason: 'no-update-origin' };
  }

  const httpStatuses: number[] = [];
  let hadNetworkOrCorsError = false;

  for (const origin of candidates) {
    let blockedByAuth = false;
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`${origin}/app-version.json?t=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        httpStatuses.push(res.status);
        if (res.ok) {
          const data = (await res.json()) as AppVersionManifest;
          if (data?.buildId) {
            return { ok: true, manifest: data, sourceOrigin: origin };
          }
        } else if (res.status === 401 || res.status === 403) {
          blockedByAuth = true;
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    } catch {
      hadNetworkOrCorsError = true;
    }

    // Fallback to CORS-free <script> JSONP in case fetch was blocked by CORS headers
    if (!blockedByAuth) {
      const jsonpManifest = await fetchVersionViaJsonp(origin);
      if (jsonpManifest?.buildId) {
        return { ok: true, manifest: jsonpManifest, sourceOrigin: origin };
      }
    }
  }

  const classification = classifyUpdateCheckFailure({
    isOnline: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    protocol: window.location.protocol,
    primaryOrigin: candidates[0],
    httpStatuses,
    hadNetworkOrCorsError,
  });

  return {
    ok: false,
    ...classification,
  };
}

export async function fetchLatestVersionManifest(): Promise<AppVersionManifest | null> {
  const result = await checkLatestVersionStatus();
  return result.ok ? result.manifest : null;
}

export const PWAInstallTriggerButton: React.FC<{
  onOpenModal: () => void;
  compact?: boolean;
}> = ({ onOpenModal, compact = false }) => {
  const [isDownloaded, setIsDownloaded] = useState<boolean>(() => hasDesktopAppBeenDownloaded());

  React.useEffect(() => {
    const syncState = () => {
      setIsDownloaded(hasDesktopAppBeenDownloaded());
    };
    window.addEventListener(DESKTOP_APP_DOWNLOADED_EVENT, syncState);
    window.addEventListener('storage', syncState);

    return () => {
      window.removeEventListener(DESKTOP_APP_DOWNLOADED_EVENT, syncState);
      window.removeEventListener('storage', syncState);
    };
  }, []);

  // Hide completely once downloaded — updates and re-downloads live inside the Home Settings gear menu!
  if (isDownloaded) return null;

  return (
    <button
      type="button"
      data-testid="open-desktop-app-modal-button"
      onClick={onOpenModal}
      title="Tải ứng dụng Bảng Trắng Thông Minh (.exe cho Windows / .app cho macOS)"
      aria-label="Tải ứng dụng về máy tính"
      className={`inline-flex items-center gap-1.5 rounded-xl border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
        compact
          ? 'px-2.5 py-1.5 text-xs font-semibold bg-indigo-50/90 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80'
          : 'h-9 px-3.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
      }`}
    >
      <Download className="w-3.5 h-3.5 shrink-0" />
      <span className={compact ? 'hidden xl:inline' : ''}>Tải ứng dụng (.exe / Mac)</span>
    </button>
  );
};

export const HomeSettingsMenu: React.FC<{
  onOpenDesktopModal: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}> = ({ onOpenDesktopModal, theme, onToggleTheme }) => {
  const addToast = useBoardStore((s) => s.addToast);
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<
    | { status: 'idle' }
    | { status: 'up-to-date'; version: string; buildId: string }
    | { status: 'update-available'; currentVersion: string; latestManifest: AppVersionManifest }
    | { status: 'not-installed'; latestManifest: AppVersionManifest | null }
    | { status: 'check-failed'; reason: UpdateCheckFailureReason; portalUrl?: string }
  >({ status: 'idle' });
  const [hasUpdateBadge, setHasUpdateBadge] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const syncInitialBadge = React.useCallback(async () => {
    const downloaded = hasDesktopAppBeenDownloaded();
    const installedId = getDownloadedBuildId();
    const latest = await fetchLatestVersionManifest();
    if (downloaded && installedId && latest?.buildId && latest.buildId !== installedId) {
      setHasUpdateBadge(true);
      setCheckResult({
        status: 'update-available',
        currentVersion: getDownloadedVersion() || installedId,
        latestManifest: latest,
      });
    } else {
      setHasUpdateBadge(false);
    }
  }, []);

  React.useEffect(() => {
    void syncInitialBadge();
    const onDownloaded = () => {
      setHasUpdateBadge(false);
      const ver = getDownloadedVersion() || '1.2';
      const id = getDownloadedBuildId() || '';
      setCheckResult({ status: 'up-to-date', version: ver, buildId: id });
    };
    window.addEventListener(DESKTOP_APP_DOWNLOADED_EVENT, onDownloaded);
    return () => window.removeEventListener(DESKTOP_APP_DOWNLOADED_EVENT, onDownloaded);
  }, [syncInitialBadge]);

  React.useEffect(() => {
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
      const downloaded = hasDesktopAppBeenDownloaded();
      const installedId = getDownloadedBuildId();
      const installedVer = getDownloadedVersion();

      if (!result.ok) {
        setCheckResult({
          status: 'check-failed',
          reason: result.reason,
          portalUrl: result.portalUrl,
        });
        if (result.reason === 'offline') {
          addToast('Thiết bị đang ngoại tuyến (Offline). Vui lòng kiểm tra kết nối mạng.', 'info');
        } else if (result.reason === 'auth-or-cors-blocked') {
          addToast('Máy vẫn có mạng — cần mở trang web gốc trên trình duyệt để kiểm tra cập nhật.', 'info');
        } else if (result.reason === 'local-server-stopped') {
          addToast('Không kết nối được máy chủ cục bộ (localhost) để kiểm tra bản mới.', 'info');
        } else if (result.reason === 'no-update-origin') {
          addToast('Bản cài đặt này chưa gắn địa chỉ trang web nguồn để kiểm tra tự động.', 'info');
        } else {
          addToast('Máy vẫn có mạng nhưng máy chủ phiên bản tạm thời không phản hồi.', 'info');
        }
        return;
      }

      const latest = result.manifest;

      if (!downloaded) {
        setCheckResult({ status: 'not-installed', latestManifest: latest });
        addToast(`Phiên bản mới nhất hiện tại là v${latest.version}. Bạn có thể tải về máy!`, 'info');
        return;
      }

      if (installedId && installedId !== latest.buildId) {
        setHasUpdateBadge(true);
        setCheckResult({
          status: 'update-available',
          currentVersion: installedVer || installedId,
          latestManifest: latest,
        });
        addToast(`Phát hiện bản cập nhật mới v${latest.version}!`, 'success');
      } else {
        setHasUpdateBadge(false);
        setCheckResult({
          status: 'up-to-date',
          version: latest.version,
          buildId: latest.buildId,
        });
        addToast(`Ứng dụng của bạn đang ở phiên bản mới nhất (v${latest.version})!`, 'success');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const currentVersionLabel =
    getDownloadedVersion() ||
    (typeof window !== 'undefined' && window.__BTTM_EMBEDDED_BUILD__?.version) ||
    'Bản Web trực tuyến';
  const isDownloaded = hasDesktopAppBeenDownloaded();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        data-testid="home-settings-button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-label="Cài đặt & Kiểm tra cập nhật"
        title="Cài đặt & Kiểm tra cập nhật"
        className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
          isOpen
            ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {hasUpdateBadge && (
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
          aria-label="Bảng cài đặt và kiểm tra cập nhật"
          className="absolute right-0 mt-2 w-[340px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3.5 z-40 space-y-3"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                Cài đặt & Phiên bản ứng dụng
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {isDownloaded ? `Đã cài bản Desktop (${currentVersionLabel})` : 'Đang dùng bản Web'}
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
              {currentVersionLabel}
            </span>
          </div>

          {/* Check for Updates Section */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Cập nhật phần mềm
              </span>
              <button
                type="button"
                data-testid="check-update-button"
                disabled={isChecking}
                onClick={() => void handleCheckUpdateNow()}
                className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isChecking ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                <span>{isChecking ? 'Đang kiểm tra...' : 'Kiểm tra cập nhật'}</span>
              </button>
            </div>

            {checkResult.status === 'up-to-date' && (
              <div
                data-testid="update-status-up-to-date"
                className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-2 text-[11px] text-emerald-800 dark:text-emerald-300"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Bạn đang dùng bản mới nhất (<strong>v{checkResult.version}</strong>).
                </span>
              </div>
            )}

            {checkResult.status === 'update-available' && (
              <div
                data-testid="update-status-available"
                className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 space-y-2 text-[11px]"
              >
                <div className="text-amber-900 dark:text-amber-200 font-semibold">
                  Đã có phiên bản mới: v{checkResult.latestManifest.version}!
                </div>
                <div className="text-amber-700 dark:text-amber-300/90">
                  Bản hiện tại trên máy: {checkResult.currentVersion}
                </div>
                <button
                  type="button"
                  data-testid="update-now-open-modal-button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenDesktopModal();
                  }}
                  className="w-full h-8 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải bản cập nhật v{checkResult.latestManifest.version} ngay</span>
                </button>
              </div>
            )}

            {checkResult.status === 'not-installed' && (
              <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 space-y-2 text-[11px]">
                <div className="text-indigo-900 dark:text-indigo-200">
                  Phiên bản mới nhất: <strong>v{checkResult.latestManifest?.version || '1.2'}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenDesktopModal();
                  }}
                  className="w-full h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Mở hộp thoại tải bộ cài (.exe / Mac)</span>
                </button>
              </div>
            )}

            {checkResult.status === 'check-failed' && checkResult.reason === 'offline' && (
              <div
                data-testid="update-status-offline"
                className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-200"
              >
                <WifiOff className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>
                  Thiết bị đang ngoại tuyến — Hãy kết nối Internet để kiểm tra phiên bản mới.
                </span>
              </div>
            )}

            {checkResult.status === 'check-failed' && checkResult.reason === 'auth-or-cors-blocked' && (
              <div
                data-testid="update-status-auth-blocked"
                className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/70 space-y-2 text-[11px]"
              >
                <div className="flex items-start gap-1.5 font-semibold text-sky-900 dark:text-sky-200">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                  <span>Máy vẫn có mạng, nhưng tệp trên máy không thể tự đọc máy chủ riêng tư</span>
                </div>
                <p className="text-sky-800/90 dark:text-sky-300/90 leading-relaxed">
                  Ứng dụng đang mở từ tệp cục bộ nên máy chủ AI Studio yêu cầu phiên đăng nhập trình duyệt để xem bản mới. Hãy mở trang web gốc để kiểm tra và tải bản cập nhật.
                </p>
                {checkResult.portalUrl && (
                  <a
                    href={checkResult.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="open-update-portal-link"
                    className="w-full h-8 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span>Mở trang web gốc để kiểm tra cập nhật</span>
                  </a>
                )}
              </div>
            )}

            {checkResult.status === 'check-failed' && checkResult.reason === 'local-server-stopped' && (
              <div
                data-testid="update-status-local-stopped"
                className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300"
              >
                <div className="font-semibold">Máy chủ cục bộ ({checkResult.portalUrl}) hiện không chạy.</div>
                <div>Hãy bật lại máy chủ phát triển hoặc mở trang web gốc trên trình duyệt.</div>
              </div>
            )}

            {checkResult.status === 'check-failed' &&
              (checkResult.reason === 'no-update-origin' || checkResult.reason === 'server-unreachable') && (
                <div
                  data-testid="update-status-unreachable"
                  className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed"
                >
                  {checkResult.reason === 'no-update-origin'
                    ? 'Bản cài đặt trên máy chưa gắn địa chỉ web gốc để kiểm tra tự động. Hãy tải lại bộ cài mới từ trang web.'
                    : 'Máy vẫn trực tuyến nhưng máy chủ kiểm tra phiên bản tạm thời không phản hồi. Vui lòng thử lại sau.'}
                </div>
              )}
          </div>

          {/* Quick Preferences & Re-download option */}
          <div className="space-y-1 pt-0.5">
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span>Giao diện hiển thị</span>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                {theme === 'dark' ? 'Chế độ Tối' : 'Chế độ Sáng'}
              </span>
            </button>

            <button
              type="button"
              data-testid="settings-open-installer-modal-button"
              onClick={() => {
                setIsOpen(false);
                onOpenDesktopModal();
              }}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span>Bộ cài đặt máy tính (.exe / .app)</span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {isDownloaded ? 'Tải lại' : 'Tải về'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

let cachedOfflineBundleHtml: string | null = null;

async function fetchOfflineAppBundleWithOrigin(): Promise<{
  html: string;
  manifest: AppVersionManifest | null;
}> {
  const versionResult = await checkLatestVersionStatus();
  const manifest = versionResult.ok ? versionResult.manifest : null;
  const embeddedOrigin = typeof window !== 'undefined' ? window.__BTTM_EMBEDDED_BUILD__?.updateOrigin : undefined;
  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

  if (!cachedOfflineBundleHtml) {
    const bundleCandidates = isFileProtocol
      ? buildUpdateOriginCandidates('file:', '', embeddedOrigin)
      : [''];
    let fetchedText: string | null = null;
    for (const origin of bundleCandidates) {
      try {
        const res = await fetch(`${origin}/desktop-app-bundle.html?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          fetchedText = await res.text();
          break;
        }
      } catch {
        // try next candidate
      }
    }
    if (!fetchedText) {
      throw new Error(
        isFileProtocol && embeddedOrigin
          ? 'PORTAL_REQUIRED'
          : 'Không thể tải gói ứng dụng độc lập.'
      );
    }
    cachedOfflineBundleHtml = fetchedText;
  }

  let html = cachedOfflineBundleHtml;
  const targetOrigin =
    typeof window !== 'undefined' && window.location.protocol.startsWith('http')
      ? window.location.origin
      : embeddedOrigin;

  if (targetOrigin) {
    const enrichedManifest: AppVersionManifest = {
      version: manifest?.version || '1.2.0',
      buildId: manifest?.buildId || 'latest',
      notes: manifest?.notes,
      updateOrigin: targetOrigin,
    };
    html = html.replace(
      /window\.__BTTM_EMBEDDED_BUILD__=\{[^<]*\};/,
      `window.__BTTM_EMBEDDED_BUILD__=${JSON.stringify(enrichedManifest)};`
    );
  }
  return { html, manifest };
}

export const DesktopAppModal: React.FC<DesktopAppModalProps> = ({ isOpen, onClose }) => {
  const addToast = useBoardStore((s) => s.addToast);
  const [busyTarget, setBusyTarget] = useState<'win-exe' | 'win-zip' | 'mac-cmd' | 'mac-app' | null>(null);
  const [portalRequiredUrl, setPortalRequiredUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const os = detectUserOS();

  const handleDownloadFailure = (err: unknown, fallbackMsg: string) => {
    const embeddedOrigin =
      typeof window !== 'undefined' ? window.__BTTM_EMBEDDED_BUILD__?.updateOrigin : undefined;
    if (err instanceof Error && err.message === 'PORTAL_REQUIRED' && embeddedOrigin) {
      setPortalRequiredUrl(embeddedOrigin);
      addToast('Hãy mở trang web gốc trên trình duyệt để tải bộ cài mới nhất.', 'info');
      return;
    }
    addToast(fallbackMsg, 'error');
  };

  const handleDownloadWindowsExe = async () => {
    try {
      setPortalRequiredUrl(null);
      setBusyTarget('win-exe');
      const { html, manifest } = await fetchOfflineAppBundleWithOrigin();
      const exeBytes = buildWindowsExeInstaller(html);
      const blob = new Blob([exeBytes.buffer as ArrayBuffer], {
        type: 'application/vnd.microsoft.portable-executable',
      });
      triggerBlobDownload(blob, 'BangTrangThongMinh-Setup.exe');
      markDesktopAppAsDownloaded(manifest);
      addToast('Đã tải BangTrangThongMinh-Setup.exe phiên bản mới nhất!', 'success');
      onClose();
    } catch (err) {
      handleDownloadFailure(err, 'Có lỗi khi tạo bộ cài .exe, vui lòng thử lại.');
    } finally {
      setBusyTarget(null);
    }
  };

  const handleDownloadWindowsZip = async () => {
    try {
      setPortalRequiredUrl(null);
      setBusyTarget('win-zip');
      const { html, manifest } = await fetchOfflineAppBundleWithOrigin();
      const zipBytes = buildWindowsDesktopZip(html);
      const blob = new Blob([zipBytes.buffer as ArrayBuffer], {
        type: 'application/zip',
      });
      triggerBlobDownload(blob, 'BangTrangThongMinh-Windows-Portable.zip');
      markDesktopAppAsDownloaded(manifest);
      addToast('Đã tải gói BangTrangThongMinh-Windows-Portable.zip phiên bản mới nhất!', 'success');
      onClose();
    } catch (err) {
      handleDownloadFailure(err, 'Có lỗi khi đóng gói bản Windows .zip, vui lòng thử lại.');
    } finally {
      setBusyTarget(null);
    }
  };

  const handleDownloadMacInstallerCommand = async () => {
    try {
      setPortalRequiredUrl(null);
      setBusyTarget('mac-cmd');
      const { html, manifest } = await fetchOfflineAppBundleWithOrigin();
      const cmdBytes = buildMacOSSelfExtractingCommand(html);
      const blob = new Blob([cmdBytes.buffer as ArrayBuffer], {
        type: 'application/x-sh',
      });
      triggerBlobDownload(blob, 'BangTrangThongMinh-Installer.command');
      markDesktopAppAsDownloaded(manifest);
      addToast('Đã tải bộ cài tự động BangTrangThongMinh-Installer.command mới nhất!', 'success');
      onClose();
    } catch (err) {
      handleDownloadFailure(err, 'Có lỗi khi tạo bộ cài macOS, vui lòng thử lại.');
    } finally {
      setBusyTarget(null);
    }
  };

  const handleDownloadMacAppZip = async () => {
    try {
      setPortalRequiredUrl(null);
      setBusyTarget('mac-app');
      const { html, manifest } = await fetchOfflineAppBundleWithOrigin();
      const bytes = buildMacOSDesktopAppZip(html);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' });
      triggerBlobDownload(blob, 'BangTrangThongMinh-macOS.app.zip');
      markDesktopAppAsDownloaded(manifest);
      addToast('Đã tải gói ứng dụng BangTrangThongMinh.app mới nhất!', 'success');
      onClose();
    } catch (err) {
      handleDownloadFailure(err, 'Có lỗi khi đóng gói bản macOS, vui lòng thử lại.');
    } finally {
      setBusyTarget(null);
    }
  };

  return (
    <div
      data-testid="desktop-app-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Tải ứng dụng về máy tính Windows (.exe) hoặc macOS (.app / .command)"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs select-text"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Laptop className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight truncate">
                Tải ứng dụng Desktop (Windows .EXE & macOS .APP)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Kiến trúc Win32 C thuần & macOS Bundle sạch 100% — Không chứa PowerShell hay script ngầm
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-desktop-app-modal-button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Direct Download Cards */}
        <div className="p-5 space-y-4">
          {portalRequiredUrl && (
            <div
              data-testid="modal-portal-required-banner"
              className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="text-sky-900 dark:text-sky-200">
                <strong>Cần mở từ trình duyệt đã đăng nhập:</strong> Tệp chạy trên máy không thể tự tải gói cập nhật từ máy chủ riêng tư.
              </div>
              <a
                href={portalRequiredUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở trang web gốc để tải</span>
              </a>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Windows .EXE Card */}
            <div
              className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all ${
                os !== 'macos'
                  ? 'border-indigo-500/80 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                    <Monitor className="w-5 h-5" />
                  </div>
                  {os !== 'macos' && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                      Máy của bạn
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Windows 10 / 11 (64-bit)
                  </h3>
                  <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                    BangTrangThongMinh-Setup.exe
                  </p>
                </div>
                <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Nhị phân Win32 thuần (Không gọi PowerShell/CMD)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Có PE CheckSum chuẩn Microsoft, 100% Offline</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Gói .ZIP kèm bản không cảnh báo SmartScreen</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  data-testid="download-windows-exe-button"
                  disabled={busyTarget !== null}
                  onClick={() => void handleDownloadWindowsExe()}
                  className="w-full h-10 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  {busyTarget === 'win-exe' ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Download className="w-4 h-4 shrink-0" />
                  )}
                  <span>Tải trực tiếp file .EXE</span>
                </button>
                <button
                  type="button"
                  data-testid="download-windows-zip-button"
                  disabled={busyTarget !== null}
                  onClick={() => void handleDownloadWindowsZip()}
                  className="w-full h-8 px-2.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {busyTarget === 'win-zip' ? (
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <span>Tải gói Portable (.zip — Tránh trình duyệt chặn)</span>
                </button>
              </div>
            </div>

            {/* macOS .APP / .COMMAND Card */}
            <div
              className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all ${
                os === 'macos'
                  ? 'border-indigo-500/80 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-xs">
                    <Apple className="w-5 h-5" />
                  </div>
                  {os === 'macos' && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                      Máy của bạn
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    macOS (Apple Silicon & Intel)
                  </h3>
                  <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                    BangTrangThongMinh.app
                  </p>
                </div>
                <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Ứng dụng gốc chuẩn macOS (.app)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Tự động chép vào Desktop & Applications</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  data-testid="download-macos-app-button"
                  disabled={busyTarget !== null}
                  onClick={() => void handleDownloadMacAppZip()}
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-60 text-white dark:text-slate-900 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  {busyTarget === 'mac-app' ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Download className="w-4 h-4 shrink-0" />
                  )}
                  <span>Tải gói ứng dụng (.app.zip)</span>
                </button>
                <button
                  type="button"
                  data-testid="download-macos-command-button"
                  disabled={busyTarget !== null}
                  onClick={() => void handleDownloadMacInstallerCommand()}
                  className="w-full h-8 px-2.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {busyTarget === 'mac-cmd' ? (
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  ) : (
                    <Download className="w-3 h-3 shrink-0" />
                  )}
                  <span>Tải bộ cài 1-File macOS (.command)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-[11.5px] text-slate-700 dark:text-slate-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Chứng nhận an toàn & Vì sao Windows SmartScreen hỏi xác nhận file .exe mới:</span>
            </div>
            <div>
              • <strong>Đã loại bỏ hoàn toàn lệnh ngầm:</strong> File <code>.exe</code> chỉ dùng API đọc/ghi tệp chuẩn của Windows (<code>CreateFileA</code>, <code>ShellExecuteA</code>) và có mã kiểm tra <code>PE CheckSum</code> chuẩn — <strong>không dùng PowerShell hay CMD ẩn</strong> nên không bị phần mềm diệt virus báo nhầm là mã độc.
            </div>
            <div>
              • <strong>Cách vượt qua thông báo &ldquo;Unknown Publisher&rdquo;:</strong> Mọi file <code>.exe</code> cá nhân chưa mua chứng chỉ số EV của Microsoft ($300–$500/năm) đều hiện bảng xác nhận màu xanh khi tải từ trình duyệt. Bạn hãy tải <strong>Gói Portable (.zip)</strong> ở trên hoặc bấm <strong>More info (Thêm thông tin)</strong> → <strong>Run anyway (Vẫn chạy)</strong>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

