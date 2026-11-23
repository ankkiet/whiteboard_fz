/**
 * Cầu nối xác thực Google Drive cho ứng dụng máy tính (Browser Auth Bridge)
 * Cho phép bản ứng dụng tải về máy (.exe / file cục bộ) kết nối an toàn với
 * Google Drive thông qua phiên đăng nhập trên trình duyệt web.
 */

import { PRODUCTION_UPDATE_ORIGIN } from '../engine/versionCheck';

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
}

const BRIDGE_PREFIX = 'BTTM-';
const STORAGE_KEY = 'bttm_desktop_auth_bridge_session_v1';
const WEB_STORAGE_KEY = 'bttm_web_last_access_token_v1';

export function getWebPortalOrigin(): string {
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    return window.location.origin;
  }
  if (typeof window !== 'undefined' && window.__BTTM_EMBEDDED_BUILD__?.updateOrigin) {
    return window.__BTTM_EMBEDDED_BUILD__.updateOrigin;
  }
  return PRODUCTION_UPDATE_ORIGIN;
}

export function createAuthBridgeToken(user: BridgeUser, accessToken: string): string {
  const payload: BridgeSession = {
    accessToken,
    user: {
      uid: user.uid,
      displayName: user.displayName || null,
      email: user.email || null,
      photoURL: user.photoURL || null,
    },
    createdAt: Date.now(),
    expiresIn: 3600,
  };
  const json = JSON.stringify(payload);
  const base64 = btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
  return `${BRIDGE_PREFIX}${base64}`;
}

export function parseAuthBridgeToken(raw: string): BridgeSession {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    throw new Error('Vui lòng nhập hoặc dán mã kết nối từ trình duyệt.');
  }
  if (!trimmed.startsWith(BRIDGE_PREFIX)) {
    throw new Error('Mã kết nối không đúng định dạng. Mã hợp lệ cần bắt đầu bằng "BTTM-".');
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
      throw new Error('Mã kết nối bị thiếu mã truy cập Google Drive.');
    }
    if (!parsed.user || !parsed.user.email) {
      throw new Error('Mã kết nối bị thiếu thông tin tài khoản Google.');
    }

    return {
      accessToken: parsed.accessToken,
      user: {
        uid: parsed.user.uid || 'bridge-user',
        displayName: parsed.user.displayName || parsed.user.email || 'Người dùng Google',
        email: parsed.user.email,
        photoURL: parsed.user.photoURL || null,
      },
      createdAt: parsed.createdAt || Date.now(),
      expiresIn: parsed.expiresIn || 3600,
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Mã kết nối')) {
      throw err;
    }
    throw new Error('Không thể giải mã dữ liệu kết nối. Hãy sao chép lại mã từ trình duyệt.');
  }
}

export function saveBridgeSession(session: BridgeSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage quota errors
  }
}

export function loadBridgeSession(): BridgeSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BridgeSession;
    if (!parsed.accessToken || !parsed.user?.email) return null;
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
}

export function saveWebAccessTokenCache(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(WEB_STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

export function loadWebAccessTokenCache(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(WEB_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearWebAccessTokenCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(WEB_STORAGE_KEY);
  } catch {
    // ignore
  }
}
