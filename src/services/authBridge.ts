/**
 * Cầu nối xác thực Google Drive cho ứng dụng máy tính (Browser Auth Bridge)
 * và bộ nhớ đệm phiên đăng nhập cho web/desktop.
 */

import { PRODUCTION_UPDATE_ORIGIN } from '../engine/versionCheck';
import { tr } from '../i18n';

export interface BridgeUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface BridgeSession {
  accessToken: string;
  user: BridgeUser;
  createdAt: number;
  expiresIn?: number;
  accessTokenExpiresAt?: number;
  /** Encrypted server-side session token holding refresh_token (used for silent auto-refresh) */
  sessionToken?: string;
}

interface DesktopAuthBridgeApi {
  loadSessionSync?: () => string | null;
  saveSession?: (serialized: string) => Promise<boolean> | void;
  clearSession?: () => Promise<boolean> | void;
}

declare global {
  interface Window {
    fzinkDesktopAuth?: DesktopAuthBridgeApi;
  }
}

export interface WebTokenCacheRecord {
  accessToken: string;
  expiresAt: number;
  email?: string | null;
  user?: BridgeUser | null;
  oauthMode?: boolean;
}

const BRIDGE_PREFIX = 'BTTM-';
const STORAGE_KEY = 'bttm_desktop_auth_bridge_session_v1';
const LEGACY_WEB_SESSION_KEY = 'bttm_web_last_access_token_v1';
const WEB_TOKEN_LOCAL_KEY = 'bttm_web_access_token_cache_v2';
const LAST_GOOGLE_EMAIL_KEY = 'bttm_last_google_email_v1';

// Google OAuth access tokens expire after 3600s; leave a small safety buffer.
export const DEFAULT_TOKEN_TTL_MS = 55 * 60 * 1000;

export function getWebPortalOrigin(): string {
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    return window.location.origin;
  }
  if (typeof window !== 'undefined' && window.__BTTM_EMBEDDED_BUILD__?.updateOrigin) {
    return window.__BTTM_EMBEDDED_BUILD__.updateOrigin;
  }
  return PRODUCTION_UPDATE_ORIGIN;
}

export function getAuthApiOrigin(): string {
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    return '';
  }
  return getWebPortalOrigin();
}

export function createAuthBridgeToken(
  user: BridgeUser,
  accessToken: string,
  sessionToken?: string | null
): string {
  const now = Date.now();
  const payload: BridgeSession = {
    accessToken,
    user: {
      uid: user.uid,
      displayName: user.displayName || null,
      email: user.email || null,
      photoURL: user.photoURL || null,
    },
    createdAt: now,
    expiresIn: 3600,
    accessTokenExpiresAt: now + 3600 * 1000,
    ...(sessionToken ? { sessionToken } : {}),
  };
  const json = JSON.stringify(payload);
  const base64 = btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
  return `${BRIDGE_PREFIX}${base64}`;
}

class BridgeTokenValidationError extends Error {}

export function parseAuthBridgeToken(raw: string): BridgeSession {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    throw new Error(tr('Vui lòng nhập hoặc dán mã kết nối từ trình duyệt.', 'Please enter or paste the connection code from your browser.'));
  }
  if (!trimmed.startsWith(BRIDGE_PREFIX)) {
    throw new Error(
      tr(
        'Mã kết nối không đúng định dạng. Mã hợp lệ cần bắt đầu bằng "BTTM-".',
        'Invalid connection code format. Valid codes must start with "BTTM-".'
      )
    );
  }

  const base64 = trimmed.slice(BRIDGE_PREFIX.length);
  try {
    const json = decodeURIComponent(
      Array.prototype.map
        .call(atob(base64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(json) as Partial<BridgeSession>;

    if (!parsed.accessToken || typeof parsed.accessToken !== 'string') {
      throw new BridgeTokenValidationError(
        tr('Mã kết nối bị thiếu mã truy cập Google Drive.', 'Bridge token is missing the Google Drive access token.')
      );
    }
    if (!parsed.user || !parsed.user.email) {
      throw new BridgeTokenValidationError(
        tr('Mã kết nối bị thiếu thông tin tài khoản Google.', 'Bridge token is missing Google account information.')
      );
    }

    const createdAt = parsed.createdAt || Date.now();
    const expiresIn = parsed.expiresIn || 3600;
    const sessionToken =
      typeof parsed.sessionToken === 'string' && parsed.sessionToken.trim()
        ? parsed.sessionToken.trim()
        : undefined;

    return {
      accessToken: parsed.accessToken,
      user: {
        uid: parsed.user.uid || 'bridge-user',
        displayName: parsed.user.displayName || parsed.user.email || tr('Người dùng Google', 'Google User'),
        email: parsed.user.email,
        photoURL: parsed.user.photoURL || null,
      },
      createdAt,
      expiresIn,
      accessTokenExpiresAt:
        typeof parsed.accessTokenExpiresAt === 'number'
          ? parsed.accessTokenExpiresAt
          : createdAt + expiresIn * 1000,
      ...(sessionToken ? { sessionToken } : {}),
    };
  } catch (err) {
    if (err instanceof BridgeTokenValidationError) {
      throw err;
    }
    throw new Error(
      tr(
        'Không thể giải mã dữ liệu kết nối. Hãy sao chép lại mã từ trình duyệt.',
        'Could not decode connection data. Please copy the code again from your browser.'
      )
    );
  }
}

export function isBridgeSessionExpired(session: BridgeSession, now = Date.now()): boolean {
  // Long-lived sessions backed by a server refresh sessionToken do not expire after 60 minutes.
  if (typeof session.sessionToken === 'string' && session.sessionToken.trim().length > 0) {
    return false;
  }
  if (!session.createdAt || typeof session.createdAt !== 'number') return false;
  const ttlSeconds = typeof session.expiresIn === 'number' && session.expiresIn > 0 ? session.expiresIn : 3600;
  // Leave a 90s buffer so we don't hand out a token right as it expires
  const expiresAt = session.createdAt + Math.max(60, ttlSeconds - 90) * 1000;
  return now >= expiresAt;
}

export function saveLastGoogleEmail(email: string | null | undefined): void {
  if (typeof window === 'undefined' || !email) return;
  try {
    window.localStorage.setItem(LAST_GOOGLE_EMAIL_KEY, email.trim());
  } catch {
    // ignore storage errors
  }
}

export function loadLastGoogleEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const email = window.localStorage.getItem(LAST_GOOGLE_EMAIL_KEY);
    return email && email.trim() ? email.trim() : null;
  } catch {
    return null;
  }
}

export function clearLastGoogleEmail(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LAST_GOOGLE_EMAIL_KEY);
  } catch {
    // ignore
  }
}

export function saveBridgeSession(session: BridgeSession): void {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(session);
  if (session.user?.email) {
    saveLastGoogleEmail(session.user.email);
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // ignore storage quota errors
  }
  try {
    void window.fzinkDesktopAuth?.saveSession?.(serialized);
  } catch {
    // ignore IPC errors
  }
}

export function loadBridgeSession(now = Date.now()): BridgeSession | null {
  if (typeof window === 'undefined') return null;

  let raw: string | null = null;
  try {
    raw = window.fzinkDesktopAuth?.loadSessionSync?.() || null;
  } catch {
    raw = null;
  }

  if (!raw) {
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as BridgeSession;
    if (!parsed.accessToken || !parsed.user?.email) return null;
    if (isBridgeSessionExpired(parsed, now)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearBridgeSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    void window.fzinkDesktopAuth?.clearSession?.();
  } catch {
    // ignore
  }
}

export function saveWebAccessTokenCache(
  token: string,
  email?: string | null,
  ttlMs = DEFAULT_TOKEN_TTL_MS,
  now = Date.now(),
  user?: BridgeUser | null,
  oauthMode = false
): void {
  if (typeof window === 'undefined') return;
  const record: WebTokenCacheRecord = {
    accessToken: token,
    expiresAt: now + ttlMs,
    email: email || user?.email || null,
    ...(user ? { user } : {}),
    ...(oauthMode ? { oauthMode: true } : {}),
  };
  const resolvedEmail = email || user?.email;
  if (resolvedEmail) {
    saveLastGoogleEmail(resolvedEmail);
  }
  try {
    window.localStorage.setItem(WEB_TOKEN_LOCAL_KEY, JSON.stringify(record));
    window.sessionStorage.removeItem(LEGACY_WEB_SESSION_KEY);
  } catch {
    // Fallback to sessionStorage if localStorage is restricted
    try {
      window.sessionStorage.setItem(LEGACY_WEB_SESSION_KEY, token);
    } catch {
      // ignore
    }
  }
}

export function loadWebAuthCacheRecord(now = Date.now()): WebTokenCacheRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WEB_TOKEN_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WebTokenCacheRecord>;
      if (
        typeof parsed.accessToken === 'string' &&
        parsed.accessToken &&
        typeof parsed.expiresAt === 'number' &&
        now < parsed.expiresAt
      ) {
        return {
          accessToken: parsed.accessToken,
          expiresAt: parsed.expiresAt,
          email: parsed.email || null,
          user: parsed.user || null,
          oauthMode: Boolean(parsed.oauthMode),
        };
      }
      // Expired or malformed record -> clean up
      window.localStorage.removeItem(WEB_TOKEN_LOCAL_KEY);
    }
  } catch {
    // ignore
  }
  return null;
}

export function loadWebAccessTokenCache(now = Date.now()): string | null {
  if (typeof window === 'undefined') return null;
  const record = loadWebAuthCacheRecord(now);
  if (record) {
    return record.accessToken;
  }

  // Legacy fallback during migration
  try {
    return window.sessionStorage.getItem(LEGACY_WEB_SESSION_KEY);
  } catch {
    return null;
  }
}

export function clearWebAccessTokenCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(WEB_TOKEN_LOCAL_KEY);
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.removeItem(LEGACY_WEB_SESSION_KEY);
  } catch {
    // ignore
  }
}
