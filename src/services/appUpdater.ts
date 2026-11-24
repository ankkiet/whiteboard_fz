import {
  AppVersionManifest,
  PRODUCTION_UPDATE_ORIGIN,
  UpdateCheckResult,
  buildUpdateOriginCandidates,
  classifyUpdateCheckFailure,
  normalizeOriginUrl,
} from '../engine/versionCheck';

export type { AppVersionManifest, UpdateCheckResult };

export interface DesktopUpdaterProgress {
  phase: 'downloading' | 'launching' | 'error';
  percent: number;
  receivedBytes?: number;
  totalBytes?: number;
  fileName?: string;
}

export interface DesktopUpdaterBridgeApi {
  downloadAndInstall: () => Promise<{
    ok: boolean;
    fileName?: string;
    destPath?: string;
    launched?: boolean;
    error?: string;
  }>;
  onProgress: (cb: (payload: DesktopUpdaterProgress) => void) => () => void;
}

declare global {
  interface Window {
    __BTTM_EMBEDDED_BUILD__?: AppVersionManifest;
    __BTTM_VERSION_CALLBACK__?: (manifest: AppVersionManifest) => void;
    fzinkDesktopUpdater?: DesktopUpdaterBridgeApi;
  }
}

export const LATEST_DESKTOP_VERSION_FALLBACK = 'v_fz.1.1.1.1.9';
export const DESKTOP_APP_DOWNLOADED_EVENT = 'bttm:desktop-app-downloaded';

const DESKTOP_APP_DOWNLOADED_KEY = 'bttm_desktop_app_downloaded_v1';
const DESKTOP_APP_DOWNLOADED_BUILD_ID_KEY = 'bttm_desktop_app_build_id_v1';
const DESKTOP_APP_DOWNLOADED_VERSION_KEY = 'bttm_desktop_app_version_v1';

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

export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'file:') return true;
  if (typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)) return true;
  if (Boolean((window as any).process?.versions?.electron)) return true;
  return false;
}

export function hasDesktopAppBeenDownloaded(): boolean {
  if (typeof window === 'undefined') return false;
  return isDesktopApp();
}

export function getDownloadedBuildId(): string | null {
  if (typeof window === 'undefined') return null;
  if (isDesktopApp() && window.__BTTM_EMBEDDED_BUILD__?.buildId) {
    return window.__BTTM_EMBEDDED_BUILD__.buildId;
  }
  try {
    const stored = window.localStorage.getItem(DESKTOP_APP_DOWNLOADED_BUILD_ID_KEY);
    if (stored) return stored;
  } catch {
    // ignore storage errors
  }
  if (window.__BTTM_EMBEDDED_BUILD__?.buildId) {
    return window.__BTTM_EMBEDDED_BUILD__.buildId;
  }
  return null;
}

export function getDownloadedVersion(): string | null {
  if (typeof window === 'undefined') return null;
  if (isDesktopApp() && window.__BTTM_EMBEDDED_BUILD__?.version) {
    return window.__BTTM_EMBEDDED_BUILD__.version;
  }
  try {
    const stored = window.localStorage.getItem(DESKTOP_APP_DOWNLOADED_VERSION_KEY);
    if (stored) return stored;
  } catch {
    // ignore storage errors
  }
  if (window.__BTTM_EMBEDDED_BUILD__?.version) {
    return window.__BTTM_EMBEDDED_BUILD__.version;
  }
  if (window.location.protocol === 'file:') {
    return 'v_fz.1.1.1.1.0';
  }
  return null;
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

export async function applyInPlaceAppUpdate(
  sourceOrigin: string,
  manifest?: AppVersionManifest | null
): Promise<void> {
  if (typeof window === 'undefined') return;

  if (window.location.protocol !== 'file:') {
    markDesktopAppAsDownloaded(manifest);
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
        }
      } catch {
        // ignore service worker update errors
      }
    }
    window.location.reload();
    return;
  }

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

export function triggerDirectDownload(url: string, fileName: string): void {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  const isCrossOrigin =
    typeof window !== 'undefined' &&
    /^https?:\/\//i.test(url) &&
    !url.startsWith(window.location.origin);

  if (isCrossOrigin) {
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
