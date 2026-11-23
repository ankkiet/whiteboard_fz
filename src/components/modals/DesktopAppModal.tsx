import React, { useState } from 'react';
import { detectUserOS, useOnlineStatus, usePWAInstall } from '../../hooks/usePWAInstall';
import { useBoardStore } from '../../store/useBoardStore';
import { AppLogo } from '../ui/AppLogo';
import {
  Download,
  X,
  Laptop,
  WifiOff,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  AppVersionManifest,
  PRODUCTION_UPDATE_ORIGIN,
  UpdateCheckFailureReason,
  UpdateCheckResult,
  buildUpdateOriginCandidates,
  classifyUpdateCheckFailure,
  normalizeOriginUrl,
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
    embeddedOrigin,
    PRODUCTION_UPDATE_ORIGIN
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

/**
 * Cập nhật ứng dụng trực tiếp tại chỗ (in-place hot update) mà không bắt người dùng tải lại tệp mới.
 * - Trên web/PWA: kích hoạt Service Worker cập nhật và tải lại trang.
 * - Trên desktop file:// (gói HTML độc lập / PE stub): tải gói cập nhật mới nhất từ máy chủ
 *   và nạp đè tài liệu tại chỗ ngay trong cửa sổ hiện tại.
 */
export async function applyInPlaceAppUpdate(
  sourceOrigin: string,
  manifest?: AppVersionManifest | null
): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Nếu đang mở từ web hoặc ứng dụng PWA
  if (window.location.protocol !== 'file:') {
    markDesktopAppAsDownloaded(manifest);
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
        }
      } catch {
        // bỏ qua nếu trình duyệt chặn service worker
      }
    }
    window.location.reload();
    return;
  }

  // 2. Nếu đang mở từ tệp cục bộ (file://)
  const origin = normalizeOriginUrl(sourceOrigin) || PRODUCTION_UPDATE_ORIGIN;
  const bundleUrl = `${origin}/desktop-app-bundle.html?t=${Date.now()}`;
  const res = await fetch(bundleUrl, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Tải gói cập nhật thất bại (mã phản hồi: ${res.status})`);
  }
  const html = await res.text();
  if (!html.includes('<!doctype html>') && !html.includes('<html')) {
    throw new Error('Dữ liệu gói cập nhật nhận được không hợp lệ.');
  }

  markDesktopAppAsDownloaded(manifest);

  // Nạp lại trực tiếp tài liệu an toàn trong cửa sổ hiện tại mà không bị chặn module script
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  document.title = doc.title;
  document.body.innerHTML = doc.body.innerHTML;

  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => el.remove());
  doc.querySelectorAll('style').forEach((st) => {
    document.head.appendChild(document.importNode(st, true));
  });

  const scripts = doc.querySelectorAll('script');
  scripts.forEach((s) => {
    const newScript = document.createElement('script');
    if (s.type) newScript.type = s.type;
    if (s.src) newScript.src = s.src;
    newScript.textContent = s.textContent;
    document.body.appendChild(newScript);
  });
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
    | {
        status: 'update-available';
        currentVersion: string;
        latestManifest: AppVersionManifest;
        sourceOrigin?: string;
      }
    | { status: 'not-installed'; latestManifest: AppVersionManifest | null }
    | { status: 'check-failed'; reason: UpdateCheckFailureReason; portalUrl?: string }
  >({ status: 'idle' });
  const [hasUpdateBadge, setHasUpdateBadge] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
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
      const ver = getDownloadedVersion() || 'v_fz.1.1.1.1.test.0';
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
        addToast(`Phiên bản mới nhất hiện tại là ${latest.version}. Bạn có thể tải về máy!`, 'info');
        return;
      }

      if (installedId && installedId !== latest.buildId) {
        setHasUpdateBadge(true);
        setCheckResult({
          status: 'update-available',
          currentVersion: installedVer || installedId,
          latestManifest: latest,
          sourceOrigin: result.sourceOrigin,
        });
        addToast(`Phát hiện bản cập nhật mới ${latest.version}!`, 'success');
      } else {
        setHasUpdateBadge(false);
        setCheckResult({
          status: 'up-to-date',
          version: latest.version,
          buildId: latest.buildId,
        });
        addToast(`Ứng dụng của bạn đang ở phiên bản mới nhất (${latest.version})!`, 'success');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleInPlaceUpdate = async () => {
    if (checkResult.status !== 'update-available') return;
    setIsApplyingUpdate(true);
    addToast('Đang cập nhật trực tiếp phiên bản mới...', 'info');
    try {
      await applyInPlaceAppUpdate(
        checkResult.sourceOrigin || PRODUCTION_UPDATE_ORIGIN,
        checkResult.latestManifest
      );
    } catch (err) {
      console.error('Failed to apply in-place update:', err);
      addToast('Không thể cập nhật trực tiếp tại chỗ. Bạn có thể tải bộ cài mới.', 'error');
      setIsApplyingUpdate(false);
    }
  };

  const currentVersionLabel =
    getDownloadedVersion() ||
    (typeof window !== 'undefined' && window.__BTTM_EMBEDDED_BUILD__?.version) ||
    'v_fz.1.1.1.1.test.0';
  const isDownloaded = hasDesktopAppBeenDownloaded();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        data-testid="home-settings-button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-label="Cài đặt & kiểm tra cập nhật"
        title="Cài đặt & kiểm tra cập nhật"
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
                Cài đặt & phiên bản ứng dụng
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {isDownloaded ? `Đã cài bản desktop (${currentVersionLabel})` : 'Đang dùng bản web'}
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
                  Bạn đang dùng bản mới nhất (<strong>{checkResult.version}</strong>).
                </span>
              </div>
            )}

            {checkResult.status === 'update-available' && (
              <div
                data-testid="update-status-available"
                className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 space-y-2.5 text-[11px]"
              >
                <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Đã có phiên bản mới: {checkResult.latestManifest.version}!</span>
                </div>
                <div className="text-amber-800/90 dark:text-amber-300/90">
                  Bản hiện tại: <span className="font-semibold">{checkResult.currentVersion}</span> → Bản mới nhất: <span className="font-semibold">{checkResult.latestManifest.version}</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    data-testid="in-place-update-button"
                    disabled={isApplyingUpdate}
                    onClick={() => void handleInPlaceUpdate()}
                    className="w-full h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    {isApplyingUpdate ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang cập nhật trực tiếp tại chỗ...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Cập nhật trực tiếp ngay (Không cần tải lại tệp)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    data-testid="update-now-open-modal-button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenDesktopModal();
                    }}
                    className="w-full h-7 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 hover:bg-amber-100/50 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-200 font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Hoặc tải bộ cài mới (.exe / Mac)</span>
                  </button>
                </div>
              </div>
            )}

            {checkResult.status === 'not-installed' && (
              <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 space-y-2 text-[11px]">
                <div className="text-indigo-900 dark:text-indigo-200">
                  Phiên bản mới nhất: <strong>{checkResult.latestManifest?.version || 'v_fz.1.1.1.1.test.0'}</strong>
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

export const GITHUB_REPO = 'ankkiet/whiteboard_fz';
export const DESKTOP_RELEASE_BASE = `https://github.com/${GITHUB_REPO}/releases/latest/download`;
export const DESKTOP_RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases`;

export const DOWNLOAD_LINKS = {
  windowsSetup: `${DESKTOP_RELEASE_BASE}/BangTrangThongMinh-Setup.exe`,
  windowsPortable: `${DESKTOP_RELEASE_BASE}/BangTrangThongMinh-Portable.exe`,
  macosDmg: `${DESKTOP_RELEASE_BASE}/BangTrangThongMinh-macOS.dmg`,
  macosZip: `${DESKTOP_RELEASE_BASE}/BangTrangThongMinh-macOS.zip`,
};

// Standard market SVG logos for Windows & macOS (matching official branding specs)
const WindowsLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 1024 1024"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path fill="#0078D4" d="M0 0h486v485H0zM538 0h486v485H538zM0 538h486v486H0zM538 538h486v486H538z" />
  </svg>
);

const AppleLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 814 1000"
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
  </svg>
);

function triggerDirectDownload(url: string, fileName: string) {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
  }, 1000);
}

export const DesktopAppModal: React.FC<DesktopAppModalProps> = ({ isOpen, onClose }) => {
  const addToast = useBoardStore((s) => s.addToast);
  const { isInstallable, install } = usePWAInstall();

  if (!isOpen) return null;

  const os = detectUserOS();

  const handleDownloadWindowsSetup = () => {
    addToast('Đang tải bộ cài đặt BangTrangThongMinh-Setup.exe...', 'info');
    triggerDirectDownload(DOWNLOAD_LINKS.windowsSetup, 'BangTrangThongMinh-Setup.exe');
    markDesktopAppAsDownloaded();
  };

  const handleDownloadWindowsPortable = () => {
    addToast('Đang tải bản Portable (BangTrangThongMinh-Portable.exe)...', 'info');
    triggerDirectDownload(DOWNLOAD_LINKS.windowsPortable, 'BangTrangThongMinh-Portable.exe');
    markDesktopAppAsDownloaded();
  };

  const handleDownloadMacDmg = () => {
    addToast('Đang tải ứng dụng macOS (BangTrangThongMinh-macOS.dmg)...', 'info');
    triggerDirectDownload(DOWNLOAD_LINKS.macosDmg, 'BangTrangThongMinh-macOS.dmg');
    markDesktopAppAsDownloaded();
  };

  const handleDownloadMacZip = () => {
    addToast('Đang tải bản nén macOS (BangTrangThongMinh-macOS.zip)...', 'info');
    triggerDirectDownload(DOWNLOAD_LINKS.macosZip, 'BangTrangThongMinh-macOS.zip');
    markDesktopAppAsDownloaded();
  };

  const handleInstallPWA = async () => {
    const success = await install();
    if (success) {
      addToast('Đã bắt đầu cài đặt ứng dụng vào máy tính!', 'success');
      markDesktopAppAsDownloaded();
      onClose();
    }
  };

  return (
    <div
      data-testid="desktop-app-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Tải ứng dụng máy tính"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-text"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <AppLogo size={44} className="rounded-2xl shadow-md shadow-indigo-600/20" />
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Tải ứng dụng máy tính
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ứng dụng máy tính độc lập chính thức cho Windows và macOS, hoạt động hoàn toàn ngoại tuyến
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-desktop-app-modal-button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4">
          {/* 2 Platform Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Windows Card */}
            <div
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                os !== 'macos'
                  ? 'border-indigo-500/60 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-slate-900/90 shadow-sm ring-1 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-center shrink-0">
                    <WindowsLogoIcon className="w-6 h-6" />
                  </div>
                  {os !== 'macos' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-semibold tracking-wide">
                      Hệ điều hành của bạn
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Windows
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Windows 10 / 11 (64-bit)
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  data-testid="download-windows-exe-button"
                  onClick={handleDownloadWindowsSetup}
                  className="w-full h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold text-xs inline-flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Tải bộ cài đặt (.exe Setup)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadWindowsPortable}
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Bản chạy ngay (.exe Portable)</span>
                </button>
                <div className="text-[11px] font-mono text-center text-slate-400 dark:text-slate-500">
                  BangTrangThongMinh-Setup.exe
                </div>
              </div>
            </div>

            {/* macOS Card */}
            <div
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                os === 'macos'
                  ? 'border-indigo-500/60 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-slate-900/90 shadow-sm ring-1 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-center shrink-0">
                    <AppleLogoIcon className="w-6 h-6 text-slate-900 dark:text-white" />
                  </div>
                  {os === 'macos' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-semibold tracking-wide">
                      Hệ điều hành của bạn
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    macOS
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Apple Silicon & Intel (Universal)
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  data-testid="download-macos-app-button"
                  onClick={handleDownloadMacDmg}
                  className="w-full h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 active:scale-[0.99] text-white font-semibold text-xs inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Tải gói cài đặt (.dmg)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMacZip}
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Gói ứng dụng (.zip)</span>
                </button>
                <div className="text-[11px] font-mono text-center text-slate-400 dark:text-slate-500">
                  BangTrangThongMinh-macOS.dmg
                </div>
              </div>
            </div>
          </div>

          {/* Quick PWA Option */}
          {isInstallable && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Laptop className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">
                  Dùng ngay không cần tải bộ cài đặt lớn?
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleInstallPWA()}
                className="h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <span>Cài đặt nhanh (PWA)</span>
              </button>
            </div>
          )}

          {/* Minimalist Trust & Privacy Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Ứng dụng máy tính độc lập • Tự tạo icon Desktop • Hoạt động 100% ngoại tuyến</span>
            </div>
            <a
              href={DESKTOP_RELEASES_PAGE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              <span>GitHub Releases</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

