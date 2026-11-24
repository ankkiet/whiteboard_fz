import React, { useEffect, useRef, useState } from 'react';
import { detectUserOS, useOnlineStatus, usePWAInstall } from '../../hooks/usePWAInstall';
import { detectMacArchitecture, MacArch } from '../../engine/macArch';
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
  RefreshCw,
  Settings,
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

const OFFLINE_BANNER_DURATION_MS = 4000;

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [visible, setVisible] = useState(!isOnline);

  useEffect(() => {
    if (isOnline) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, OFFLINE_BANNER_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOnline]);

  if (isOnline || !visible) return null;

  const isDesktop = isDesktopApp();

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pwa-offline-indicator"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 pl-3 pr-2 py-1.5 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        {isDesktop
          ? 'Đang ngoại tuyến — Dữ liệu bảng vẫn tự động lưu trên máy'
          : 'Đang ngoại tuyến — Dữ liệu bảng vẫn đang lưu trên trình duyệt'}
      </span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Đóng thông báo ngoại tuyến"
        className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-black/15 transition-colors cursor-pointer shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
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
  // On packaged Desktop App (Electron / file://), the embedded build manifest reflects the true binary on disk.
  if (isDesktopApp() && window.__BTTM_EMBEDDED_BUILD__?.buildId) {
    return window.__BTTM_EMBEDDED_BUILD__.buildId;
  }
  try {
    const stored = window.localStorage.getItem(DESKTOP_APP_DOWNLOADED_BUILD_ID_KEY);
    if (stored) return stored;
  } catch {}
  if (window.__BTTM_EMBEDDED_BUILD__?.buildId) {
    return window.__BTTM_EMBEDDED_BUILD__.buildId;
  }
  return null;
}

export function getDownloadedVersion(): string | null {
  if (typeof window === 'undefined') return null;
  // On packaged Desktop App (Electron / file://), always trust the embedded version inside app.asar first.
  if (isDesktopApp() && window.__BTTM_EMBEDDED_BUILD__?.version) {
    return window.__BTTM_EMBEDDED_BUILD__.version;
  }
  try {
    const stored = window.localStorage.getItem(DESKTOP_APP_DOWNLOADED_VERSION_KEY);
    if (stored) return stored;
  } catch {}
  if (window.__BTTM_EMBEDDED_BUILD__?.version) {
    return window.__BTTM_EMBEDDED_BUILD__.version;
  }
  if (window.location.protocol === 'file:') {
    return 'v_fz.1.1.1.1.0';
  }
  return null;
}

export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'file:') return true;
  if (typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)) return true;
  if (Boolean((window as any).process?.versions?.electron)) return true;
  return false;
}

export function hasDesktopAppBeenDownloaded(): boolean {
  if (typeof window === 'undefined') return false;
  if (isDesktopApp()) return true;
  return false;
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
  const isDesktop = isDesktopApp();

  // Khi đang mở trên ứng dụng máy tính (Desktop App / Electron), ẩn nút tải về
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

export const HomeSettingsMenu: React.FC<{
  onOpenDesktopModal: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}> = ({ onOpenDesktopModal, theme, onToggleTheme }) => {
  const addToast = useBoardStore((s) => s.addToast);
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [latestDesktopVersion, setLatestDesktopVersion] = useState<string>('v_fz.1.1.1.1.7');
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

  const isDesktop = isDesktopApp();

  const syncInitialBadge = React.useCallback(async () => {
    if (!isDesktop) return;
    const installedId = getDownloadedBuildId();
    const installedVer = getDownloadedVersion();
    const latest = await fetchLatestVersionManifest();
    if (latest?.version) {
      setLatestDesktopVersion(latest.version);
    }
    const isUpdateAvailable = Boolean(
      latest &&
        ((installedId && latest.buildId && installedId !== latest.buildId) ||
          (installedVer && latest.version && installedVer !== latest.version) ||
          (!installedId && installedVer && latest.version && installedVer !== latest.version))
    );
    if (isUpdateAvailable && latest) {
      setHasUpdateBadge(true);
      setCheckResult({
        status: 'update-available',
        currentVersion: installedVer || installedId || 'v_fz.1.1.1.1.0',
        latestManifest: latest,
      });
    } else {
      setHasUpdateBadge(false);
    }
  }, [isDesktop]);

  React.useEffect(() => {
    if (isDesktop) {
      void syncInitialBadge();
      const onDownloaded = () => {
        setHasUpdateBadge(false);
        const ver = getDownloadedVersion() || 'v_fz.1.1.1.1.7';
        const id = getDownloadedBuildId() || '';
        setCheckResult({ status: 'up-to-date', version: ver, buildId: id });
      };
      window.addEventListener(DESKTOP_APP_DOWNLOADED_EVENT, onDownloaded);
      return () => window.removeEventListener(DESKTOP_APP_DOWNLOADED_EVENT, onDownloaded);
    } else {
      void fetchLatestVersionManifest().then((manifest) => {
        if (manifest?.version) {
          setLatestDesktopVersion(manifest.version);
        }
      });
    }
  }, [isDesktop, syncInitialBadge]);

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

      const isUpdateAvailable = Boolean(
        (installedId && latest.buildId && installedId !== latest.buildId) ||
        (installedVer && latest.version && installedVer !== latest.version) ||
        (!installedId && installedVer && latest.version && installedVer !== latest.version)
      );

      if (isUpdateAvailable) {
        setHasUpdateBadge(true);
        setCheckResult({
          status: 'update-available',
          currentVersion: installedVer || installedId || 'Bản cũ',
          latestManifest: latest,
          sourceOrigin: result.sourceOrigin,
        });
        addToast(`Phát hiện bản cập nhật mới ${latest.version}`, 'success');
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
    'v_fz.1.1.1.1.7';

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
            /* =================== GIAO DIỆN DESKTOP APP =================== */
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

              {/* Check for Updates Section */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Cập nhật ứng dụng
                  </span>
                  <button
                    type="button"
                    data-testid="check-update-button"
                    disabled={isChecking}
                    onClick={() => void handleCheckUpdateNow()}
                    className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
                  >
                    {isChecking ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                    )}
                    <span>{isChecking ? 'Đang kiểm tra' : 'Kiểm tra'}</span>
                  </button>
                </div>

                {checkResult.status === 'up-to-date' && (
                  <div
                    data-testid="update-status-up-to-date"
                    className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300"
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
                    className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 space-y-2 text-xs"
                  >
                    <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" strokeWidth={1.75} />
                      <span>
                        {checkResult.currentVersion !== checkResult.latestManifest.version
                          ? `Đã có phiên bản mới ${checkResult.latestManifest.version}`
                          : `Đã có bản vá mới cho ${checkResult.latestManifest.version}`}
                      </span>
                    </div>
                    <div className="text-amber-800/90 dark:text-amber-300/90">
                      {checkResult.currentVersion !== checkResult.latestManifest.version ? (
                        <>
                          Hiện tại: <span className="font-mono font-medium">{checkResult.currentVersion}</span> → Mới nhất: <span className="font-mono font-medium">{checkResult.latestManifest.version}</span>
                        </>
                      ) : (
                        <>
                          Phiên bản <span className="font-mono font-medium">{checkResult.latestManifest.version}</span> đã có bản dựng mới
                        </>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {isDesktop ? (
                        <>
                          <button
                            type="button"
                            data-testid="update-now-open-modal-button"
                            onClick={() => {
                              setIsOpen(false);
                              onOpenDesktopModal();
                            }}
                            className="w-full h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Tải bộ cài cập nhật (.exe / .dmg)</span>
                          </button>
                          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-snug">
                            Chạy tệp cài đặt mới để cập nhật ứng dụng trên máy tính.
                          </p>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            data-testid="in-place-update-button"
                            disabled={isApplyingUpdate}
                            onClick={() => void handleInPlaceUpdate()}
                            className="w-full h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                          >
                            {isApplyingUpdate ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Đang cập nhật trực tiếp</span>
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
                                <span>Cập nhật trực tiếp ngay</span>
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
                            className="w-full h-8 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 hover:bg-amber-100/50 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Hoặc tải bộ cài (.exe / Mac)</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {checkResult.status === 'not-installed' && (
                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 space-y-2 text-xs">
                    <div className="text-slate-700 dark:text-slate-200">
                      Phiên bản mới nhất: <strong className="font-mono font-medium">{checkResult.latestManifest?.version || 'v_fz.1.1.1.1.7'}</strong>
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

              {/* Quick Preferences & Re-download */}
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
            /* =================== GIAO DIỆN WEB TRỰC TUYẾN =================== */
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

              {/* Desktop App Card */}
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

export const GITHUB_REPO = 'ankkiet/whiteboard_fz';
export const DESKTOP_RELEASE_BASE = `https://github.com/${GITHUB_REPO}/releases/latest/download`;
export const DESKTOP_RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases`;

export const DOWNLOAD_LINKS = {
  windowsSetup: `${DESKTOP_RELEASE_BASE}/fzInK-Setup.exe`,
  windowsPortable: `${DESKTOP_RELEASE_BASE}/fzInK-Portable.exe`,
  macosArm64Dmg: `${DESKTOP_RELEASE_BASE}/fzInK-macOS-arm64.dmg`,
  macosArm64Zip: `${DESKTOP_RELEASE_BASE}/fzInK-macOS-arm64.zip`,
  macosX64Dmg: `${DESKTOP_RELEASE_BASE}/fzInK-macOS-x64.dmg`,
  macosX64Zip: `${DESKTOP_RELEASE_BASE}/fzInK-macOS-x64.zip`,
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
  const isCrossOrigin =
    typeof window !== 'undefined' &&
    /^https?:\/\//i.test(url) &&
    !url.startsWith(window.location.origin);

  if (isCrossOrigin) {
    // Mở tách khỏi Service Worker của trang để trình duyệt tải thẳng bằng trình quản lý tải gốc (giống bấm trực tiếp trên GitHub)
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  } else {
    a.download = fileName;
  }

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
  const os = detectUserOS();
  const [macArch, setMacArch] = useState<MacArch>('arm64');
  const [detectedMacArch, setDetectedMacArch] = useState<MacArch | null>(null);
  const userPickedMacArchRef = useRef(false);

  useEffect(() => {
    if (!isOpen || os !== 'macos') return;
    let cancelled = false;
    void detectMacArchitecture().then((result) => {
      if (cancelled || !result.detected) return;
      setDetectedMacArch(result.arch);
      if (!userPickedMacArchRef.current) {
        setMacArch(result.arch);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, os]);

  if (!isOpen) return null;

  const macDmgFileName = `fzInK-macOS-${macArch}.dmg`;
  const macZipFileName = `fzInK-macOS-${macArch}.zip`;
  const macDmgUrl = macArch === 'arm64' ? DOWNLOAD_LINKS.macosArm64Dmg : DOWNLOAD_LINKS.macosX64Dmg;
  const macZipUrl = macArch === 'arm64' ? DOWNLOAD_LINKS.macosArm64Zip : DOWNLOAD_LINKS.macosX64Zip;

  const handleSelectMacArch = (arch: MacArch) => {
    userPickedMacArchRef.current = true;
    setMacArch(arch);
  };

  const handleDownloadWindowsSetup = () => {
    addToast('Đang tải bộ cài đặt fzInK-Setup.exe...', 'info');
    triggerDirectDownload(DOWNLOAD_LINKS.windowsSetup, 'fzInK-Setup.exe');
    markDesktopAppAsDownloaded();
  };

  const handleDownloadWindowsPortable = () => {
    addToast('Đang tải bản Portable (fzInK-Portable.exe)...', 'info');
    triggerDirectDownload(DOWNLOAD_LINKS.windowsPortable, 'fzInK-Portable.exe');
    markDesktopAppAsDownloaded();
  };

  const handleDownloadMacDmg = () => {
    addToast(`Đang tải ứng dụng macOS (${macDmgFileName})...`, 'info');
    triggerDirectDownload(macDmgUrl, macDmgFileName);
    markDesktopAppAsDownloaded();
  };

  const handleDownloadMacZip = () => {
    addToast(`Đang tải bản nén macOS (${macZipFileName})...`, 'info');
    triggerDirectDownload(macZipUrl, macZipFileName);
    markDesktopAppAsDownloaded();
  };

  const handleInstallPWA = async () => {
    const success = await install();
    if (success) {
      addToast('Đã bắt đầu cài đặt ứng dụng vào máy tính', 'success');
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs select-text"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-none overflow-hidden text-slate-900 dark:text-slate-100"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo size={40} className="rounded-xl" />
            <div>
              <h2 className="text-base font-medium text-slate-900 dark:text-slate-100">
                Tải ứng dụng máy tính
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ứng dụng độc lập cho Windows và macOS, hoạt động hoàn toàn ngoại tuyến
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-desktop-app-modal-button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4">
          {/* 2 Platform Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Windows Card */}
            <div
              className={`p-4 rounded-xl border flex flex-col justify-between transition-colors duration-150 ${
                os !== 'macos'
                  ? 'border-indigo-500/70 bg-white dark:bg-slate-900'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                    <WindowsLogoIcon className="w-5 h-5" />
                  </div>
                  {os !== 'macos' && (
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Hệ điều hành của bạn
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">
                    Windows
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Windows 10 / 11 (64-bit)
                  </p>
                </div>

                <div className="mt-3 p-2.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-400 leading-snug">
                  Gồm bản cài đặt tự tạo biểu tượng màn hình và bản Portable chạy ngay
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  data-testid="download-windows-exe-button"
                  onClick={handleDownloadWindowsSetup}
                  className="w-full h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-medium text-xs inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span>Tải bộ cài đặt (.exe Setup)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadWindowsPortable}
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                >
                  <span>Bản chạy ngay (.exe Portable)</span>
                </button>
                <div className="text-xs font-mono text-center text-slate-400 dark:text-slate-500">
                  fzInK-Setup.exe
                </div>
              </div>
            </div>

            {/* macOS Card */}
            <div
              className={`p-4 rounded-xl border flex flex-col justify-between transition-colors duration-150 ${
                os === 'macos'
                  ? 'border-indigo-500/70 bg-white dark:bg-slate-900'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                    <AppleLogoIcon className="w-5 h-5 text-slate-900 dark:text-slate-100" />
                  </div>
                  {os === 'macos' && (
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Hệ điều hành của bạn
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">
                    macOS
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {os === 'macos' && detectedMacArch
                      ? `Tự nhận diện: ${detectedMacArch === 'arm64' ? 'Apple Silicon (M1–M4)' : 'chip Intel (x64)'}`
                      : 'macOS 11 trở lên · Apple Silicon & Intel'}
                  </p>
                </div>

                {/* Mac CPU architecture selector */}
                <div
                  role="radiogroup"
                  aria-label="Chọn kiến trúc chip macOS"
                  className="mt-3 grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70"
                >
                  {(
                    [
                      { id: 'arm64' as const, label: 'Apple Silicon', sub: 'M1–M4' },
                      { id: 'x64' as const, label: 'Intel', sub: 'x64' },
                    ]
                  ).map((option) => {
                    const isSelected = macArch === option.id;
                    const isAutoMatched = os === 'macos' && detectedMacArch === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        data-testid={`mac-arch-${option.id}-button`}
                        onClick={() => handleSelectMacArch(option.id)}
                        className={`px-2 py-1.5 rounded-md text-left transition-colors duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-medium leading-tight truncate">
                            {option.label}
                          </span>
                          {isAutoMatched && (
                            <span
                              title="Phù hợp với máy Mac của bạn"
                              className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                            />
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-400 dark:text-slate-500 leading-tight mt-0.5">
                          {isAutoMatched ? `${option.sub} · Máy này` : option.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  data-testid="download-macos-app-button"
                  onClick={handleDownloadMacDmg}
                  className="w-full h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 active:scale-[0.98] text-white font-medium text-xs inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span>Tải gói cài đặt (.dmg)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMacZip}
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                >
                  <span>Gói ứng dụng (.zip)</span>
                </button>
                <div className="text-xs font-mono text-center text-slate-400 dark:text-slate-500 truncate">
                  {macDmgFileName}
                </div>
              </div>
            </div>
          </div>

          {/* Quick PWA Option */}
          {isInstallable && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.75} />
                <span className="text-slate-700 dark:text-slate-300">
                  Dùng ngay không cần tải bộ cài đặt lớn?
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleInstallPWA()}
                className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span>Cài đặt nhanh (PWA)</span>
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
              <span className="truncate">Ứng dụng độc lập · Lưu cục bộ · Hoạt động ngoại tuyến</span>
            </div>
            <a
              href={DESKTOP_RELEASES_PAGE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors duration-150"
            >
              <span>GitHub Releases</span>
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

