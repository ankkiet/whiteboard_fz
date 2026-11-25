import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { tr } from '../i18n';
import {
  BridgeSession,
  BridgeUser,
  clearBridgeSession,
  clearLastGoogleEmail,
  clearWebAccessTokenCache,
  getAuthApiOrigin,
  loadBridgeSession,
  loadLastGoogleEmail,
  loadWebAuthCacheRecord,
  saveBridgeSession,
  saveLastGoogleEmail,
  saveWebAccessTokenCache,
} from './authBridge';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const TOKEN_REFRESH_LEAD_MS = 120_000; // Refresh proactively 2 minutes before expiry
const PROACTIVE_REFRESH_MARGIN_MS = 5 * 60 * 1000; // Schedule timer 5 minutes before expiry

interface OAuthStatusResponse {
  configured: boolean;
  hasSession?: boolean;
}

interface OAuthPopupResultMessage {
  type: 'FZINK_OAUTH_RESULT';
  ok: boolean;
  accessToken?: string;
  expiresIn?: number;
  user?: BridgeUser;
  errorCode?: string;
  errorMessage?: string;
}

interface RefreshApiResponse {
  ok: boolean;
  accessToken?: string;
  expiresIn?: number;
  user?: BridgeUser;
  sessionToken?: string;
  revoked?: boolean;
  error?: string;
  detail?: string;
}

export class TokenRefreshTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenRefreshTransientError';
  }
}

export class TokenRefreshRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenRefreshRevokedError';
  }
}

function isFileMode(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

function buildGoogleProvider(options?: { forceAccountPicker?: boolean }): GoogleAuthProvider {
  const googleProvider = new GoogleAuthProvider();
  for (const scope of SCOPES) {
    googleProvider.addScope(scope);
  }
  if (options?.forceAccountPicker) {
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } else {
    const hintEmail = auth.currentUser?.email || loadLastGoogleEmail();
    if (hintEmail) {
      googleProvider.setCustomParameters({ login_hint: hintEmail });
    } else {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
    }
  }
  return googleProvider;
}

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;
let bridgeUser: User | null = null;
let activeBridgeSession: BridgeSession | null = null;
let oauthWebUser: User | null = null;

let activeOnAuthSuccess: ((user: User, token: string) => void) | undefined;
let activeOnAuthFailure: ((user: User | null) => void) | undefined;

let refreshInFlight: Promise<string | null> | null = null;
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let cachedOAuthStatus: OAuthStatusResponse | null = null;

function clearProactiveRefreshTimer(): void {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}

function hasRefreshableSession(): boolean {
  if (isFileMode()) {
    return Boolean(activeBridgeSession?.sessionToken);
  }
  return Boolean(oauthWebUser);
}

function scheduleProactiveRefresh(expiresInSeconds: number): void {
  clearProactiveRefreshTimer();
  if (!hasRefreshableSession() || typeof window === 'undefined') return;
  const ttlMs = Math.max(60_000, expiresInSeconds * 1000);
  const delayMs = Math.max(30_000, ttlMs - PROACTIVE_REFRESH_MARGIN_MS);
  proactiveRefreshTimer = setTimeout(() => {
    void refreshGoogleAccessToken(true).catch(() => {
      // Transient refresh errors are retried automatically on the next Drive request
    });
  }, delayMs);
}

async function fetchOAuthServerStatus(force = false): Promise<OAuthStatusResponse> {
  if (cachedOAuthStatus && !force) {
    return cachedOAuthStatus;
  }
  if (typeof window === 'undefined' || isFileMode()) {
    return { configured: false, hasSession: false };
  }
  try {
    const res = await fetch('/api/auth/google/status', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) {
      return { configured: false, hasSession: false };
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { configured: false, hasSession: false };
    }
    const json = (await res.json()) as Partial<OAuthStatusResponse>;
    const status: OAuthStatusResponse = {
      configured: Boolean(json.configured),
      hasSession: Boolean(json.hasSession),
    };
    cachedOAuthStatus = status;
    return status;
  } catch {
    return { configured: false, hasSession: false };
  }
}

export const isOAuthBridgeAvailable = async (): Promise<boolean> => {
  if (isFileMode()) return true;
  const status = await fetchOAuthServerStatus();
  return status.configured;
};

export const fetchDesktopBridgeSessionToken = async (): Promise<string | null> => {
  if (isFileMode()) return activeBridgeSession?.sessionToken || null;
  try {
    const status = await fetchOAuthServerStatus();
    if (!status.configured) return null;
    const res = await fetch('/api/auth/google/bridge-token', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; sessionToken?: string };
    return json.ok && typeof json.sessionToken === 'string' ? json.sessionToken : null;
  } catch {
    return null;
  }
};

export const setBridgeSession = (
  session: BridgeSession,
  onSuccess?: (user: User, token: string) => void
): void => {
  const expiresIn = session.expiresIn || 3600;
  cachedAccessToken = session.accessToken;
  cachedTokenExpiresAt =
    session.accessTokenExpiresAt || session.createdAt + expiresIn * 1000;
  bridgeUser = session.user as unknown as User;
  activeBridgeSession = session;
  oauthWebUser = null;
  saveBridgeSession(session);
  if (session.sessionToken) {
    const remainingSec = Math.max(60, Math.floor((cachedTokenExpiresAt - Date.now()) / 1000));
    scheduleProactiveRefresh(remainingSec);
  }
  onSuccess?.(bridgeUser, cachedAccessToken);
};

export const getActiveBridgeUser = (): User | null => bridgeUser;

export const canRefreshGoogleAccessToken = (): boolean => hasRefreshableSession();

export const refreshGoogleAccessToken = async (force = false): Promise<string | null> => {
  if (!force && cachedAccessToken && cachedTokenExpiresAt > Date.now() + TOKEN_REFRESH_LEAD_MS) {
    return cachedAccessToken;
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  const runRefresh = async (): Promise<string | null> => {
    const fileMode = isFileMode();
    const sessionToken = fileMode ? activeBridgeSession?.sessionToken : undefined;

    if (fileMode && !sessionToken) {
      return null;
    }

    const endpoint = `${getAuthApiOrigin()}/api/auth/google/refresh`;
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(fileMode
          ? { body: JSON.stringify({ sessionToken }) }
          : { credentials: 'include' as RequestCredentials, body: '{}' }),
      });
    } catch {
      throw new TokenRefreshTransientError(
        tr(
          'Không thể kết nối máy chủ để gia hạn phiên Google Drive. Vui lòng kiểm tra mạng và thử lại.',
          'Could not reach server to refresh Google Drive session. Please check your network and try again.'
        )
      );
    }

    if (res.status === 404 || res.status === 501) {
      return null;
    }

    const data = (await res.json().catch(() => ({}))) as Partial<RefreshApiResponse>;

    if (!res.ok || !data.ok || !data.accessToken) {
      if (res.status === 401 && data.revoked) {
        throw new TokenRefreshRevokedError(
          tr(
            'Phiên kết nối Google Drive đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.',
            'Google Drive session expired or was revoked. Please sign in again.'
          )
        );
      }
      if (res.status === 401 && data.error === 'no_session') {
        return null;
      }
      throw new TokenRefreshTransientError(
        data.detail ||
          tr(
            'Tạm thời không thể gia hạn phiên Google Drive. Vui lòng thử lại.',
            'Temporarily unable to refresh Google Drive session. Please try again.'
          )
      );
    }

    const expiresIn = typeof data.expiresIn === 'number' && data.expiresIn > 0 ? data.expiresIn : 3600;
    const now = Date.now();
    cachedAccessToken = data.accessToken;
    cachedTokenExpiresAt = now + expiresIn * 1000;

    const resolvedUser: BridgeUser = data.user ||
      (bridgeUser as unknown as BridgeUser) ||
      (oauthWebUser as unknown as BridgeUser) || {
        uid: 'google-user',
        displayName: loadLastGoogleEmail(),
        email: loadLastGoogleEmail(),
        photoURL: null,
      };

    if (fileMode) {
      const updatedBridge: BridgeSession = {
        accessToken: data.accessToken,
        user: resolvedUser,
        createdAt: activeBridgeSession?.createdAt || now,
        expiresIn,
        accessTokenExpiresAt: cachedTokenExpiresAt,
        sessionToken: data.sessionToken || sessionToken,
      };
      activeBridgeSession = updatedBridge;
      bridgeUser = resolvedUser as unknown as User;
      saveBridgeSession(updatedBridge);
      scheduleProactiveRefresh(expiresIn);
      activeOnAuthSuccess?.(bridgeUser, data.accessToken);
    } else {
      oauthWebUser = resolvedUser as unknown as User;
      const ttlCacheMs = Math.max(60_000, (expiresIn - 120) * 1000);
      saveWebAccessTokenCache(
        data.accessToken,
        resolvedUser.email,
        ttlCacheMs,
        now,
        resolvedUser,
        true
      );
      scheduleProactiveRefresh(expiresIn);
      activeOnAuthSuccess?.(oauthWebUser, data.accessToken);
    }

    return data.accessToken;
  };

  refreshInFlight = runRefresh().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
};

/**
 * Ensures there is a valid (non-expired) Google Drive access token before calling Drive API.
 * Silently refreshes via the server session if the 60-minute access token is about to expire.
 */
export const ensureGoogleAccessToken = async (): Promise<string | null> => {
  if (
    cachedAccessToken &&
    (!hasRefreshableSession() ||
      cachedTokenExpiresAt === 0 ||
      Date.now() < cachedTokenExpiresAt - TOKEN_REFRESH_LEAD_MS)
  ) {
    return cachedAccessToken;
  }

  if (hasRefreshableSession()) {
    return refreshGoogleAccessToken(true);
  }

  return cachedAccessToken;
};

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  activeOnAuthSuccess = onAuthSuccess;
  activeOnAuthFailure = onAuthFailure;
  const isFile = isFileMode();

  // In desktop file:// mode, check if we have a saved bridge session
  if (isFile) {
    const savedBridge = loadBridgeSession();
    if (savedBridge?.accessToken && savedBridge.user) {
      activeBridgeSession = savedBridge;
      cachedAccessToken = savedBridge.accessToken;
      cachedTokenExpiresAt =
        savedBridge.accessTokenExpiresAt ||
        savedBridge.createdAt + (savedBridge.expiresIn || 3600) * 1000;
      bridgeUser = savedBridge.user as unknown as User;
      onAuthSuccess?.(bridgeUser, cachedAccessToken);

      if (savedBridge.sessionToken) {
        if (Date.now() >= cachedTokenExpiresAt - TOKEN_REFRESH_LEAD_MS) {
          void refreshGoogleAccessToken(true).catch((err) => {
            if (err instanceof TokenRefreshRevokedError) {
              clearGoogleAccessToken();
              onAuthFailure?.(null);
            }
          });
        } else {
          const remainingSec = Math.max(
            60,
            Math.floor((cachedTokenExpiresAt - Date.now()) / 1000)
          );
          scheduleProactiveRefresh(remainingSec);
        }
      }
    }
  } else {
    const webCached = loadWebAuthCacheRecord();
    if (webCached) {
      cachedAccessToken = webCached.accessToken;
      cachedTokenExpiresAt = webCached.expiresAt;
      if (webCached.oauthMode && webCached.user) {
        oauthWebUser = webCached.user as unknown as User;
        onAuthSuccess?.(oauthWebUser, cachedAccessToken);
        const remainingSec = Math.max(
          60,
          Math.floor((webCached.expiresAt - Date.now()) / 1000)
        );
        scheduleProactiveRefresh(remainingSec);
      }
    } else {
      // No valid short-lived access token in localStorage: check if server HttpOnly cookie can restore it
      void (async () => {
        const status = await fetchOAuthServerStatus(true);
        if (status.configured && status.hasSession && !isSigningIn && !oauthWebUser) {
          try {
            await refreshGoogleAccessToken(true);
          } catch (err) {
            if (err instanceof TokenRefreshRevokedError) {
              clearGoogleAccessToken();
              onAuthFailure?.(null);
            }
          }
        }
      })();
    }
  }

  const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
    if (oauthWebUser && cachedAccessToken) {
      onAuthSuccess?.(oauthWebUser, cachedAccessToken);
      return;
    }

    if (user) {
      bridgeUser = null;
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Check whether server OAuth cookie can restore a Drive session instead of forcing re-login
        void (async () => {
          const status = await fetchOAuthServerStatus();
          if (status.configured && status.hasSession) {
            try {
              const token = await refreshGoogleAccessToken(true);
              if (token) return;
            } catch (err) {
              if (err instanceof TokenRefreshRevokedError) {
                clearGoogleAccessToken();
              }
            }
          }
          if (!oauthWebUser && !cachedAccessToken) {
            cachedAccessToken = null;
            onAuthFailure?.(user);
          }
        })();
      }
    } else {
      if (isFile && bridgeUser && cachedAccessToken) {
        onAuthSuccess?.(bridgeUser, cachedAccessToken);
      } else if (!isFile) {
        // Keep waiting if a web OAuth cookie restoration is currently running
        void (async () => {
          const status = await fetchOAuthServerStatus();
          if (status.configured && status.hasSession && !oauthWebUser) {
            try {
              const token = await refreshGoogleAccessToken(true);
              if (token) return;
            } catch (err) {
              if (err instanceof TokenRefreshRevokedError) {
                clearGoogleAccessToken();
              }
            }
          }
          if (!oauthWebUser) {
            cachedAccessToken = null;
            bridgeUser = null;
            onAuthFailure?.(null);
          }
        })();
      } else {
        cachedAccessToken = null;
        bridgeUser = null;
        onAuthFailure?.(null);
      }
    }
  });

  return () => {
    clearProactiveRefreshTimer();
    unsubscribe();
  };
};

async function signInWithServerOAuthPopup(options?: {
  forceAccountPicker?: boolean;
}): Promise<{ user: User; accessToken: string }> {
  const startUrl = new URL('/api/auth/google/start', window.location.origin);
  startUrl.searchParams.set('mode', 'popup');

  if (options?.forceAccountPicker) {
    startUrl.searchParams.set('prompt', 'select_account');
  } else {
    const hintEmail = oauthWebUser?.email || auth.currentUser?.email || loadLastGoogleEmail();
    if (hintEmail) {
      startUrl.searchParams.set('login_hint', hintEmail);
    } else {
      startUrl.searchParams.set('prompt', 'select_account');
    }
  }

  const width = 520;
  const height = 660;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

  const popup = window.open(
    startUrl.toString(),
    'fzink_google_oauth',
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no`
  );

  if (!popup) {
    const err = new Error(
      tr(
        'Trình duyệt đã chặn cửa sổ bật lên (popup). Vui lòng cho phép popup cho trang này rồi thử lại.',
        'Browser blocked the sign-in popup. Please allow popups for this site and try again.'
      )
    ) as Error & { code?: string };
    err.code = 'auth/popup-blocked';
    throw err;
  }

  return new Promise<{ user: User; accessToken: string }>((resolve, reject) => {
    let settled = false;
    let closePollTimer: ReturnType<typeof setInterval> | null = null;
    let closeGraceTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (closePollTimer) clearInterval(closePollTimer);
      if (closeGraceTimer) clearTimeout(closeGraceTimer);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as Partial<OAuthPopupResultMessage> | null;
      if (!data || data.type !== 'FZINK_OAUTH_RESULT') return;
      if (settled) return;
      settled = true;
      cleanup();

      if (!data.ok || !data.accessToken || !data.user) {
        const err = new Error(
          data.errorMessage ||
            tr('Đăng nhập Google không thành công. Vui lòng thử lại.', 'Google sign-in failed. Please try again.')
        ) as Error & { code?: string };
        err.code = data.errorCode || 'oauth_failed';
        reject(err);
        return;
      }

      const now = Date.now();
      const expiresIn = typeof data.expiresIn === 'number' && data.expiresIn > 0 ? data.expiresIn : 3600;
      const resolvedUser = data.user as unknown as User;
      cachedAccessToken = data.accessToken;
      cachedTokenExpiresAt = now + expiresIn * 1000;
      oauthWebUser = resolvedUser;
      bridgeUser = null;
      cachedOAuthStatus = { configured: true, hasSession: true };

      const ttlCacheMs = Math.max(60_000, (expiresIn - 120) * 1000);
      saveWebAccessTokenCache(
        data.accessToken,
        data.user.email,
        ttlCacheMs,
        now,
        data.user,
        true
      );
      scheduleProactiveRefresh(expiresIn);
      resolve({ user: resolvedUser, accessToken: data.accessToken });
    };

    window.addEventListener('message', onMessage);

    closePollTimer = setInterval(() => {
      if (popup.closed && !settled) {
        if (!closeGraceTimer) {
          closeGraceTimer = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            const err = new Error(
              tr('Bạn đã đóng cửa sổ đăng nhập Google.', 'You closed the Google sign-in window.')
            ) as Error & { code?: string };
            err.code = 'auth/popup-closed-by-user';
            reject(err);
          }, 400);
        }
      }
    }, 250);
  });
}

export const googleSignIn = async (options?: {
  forceAccountPicker?: boolean;
}): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    if (isFileMode()) {
      throw new Error(
        tr(
          'Bản cài đặt chạy từ tệp cục bộ (file://) không hỗ trợ đăng nhập Google do chính sách bảo mật của Google OAuth. Vui lòng bấm "Đăng nhập qua trình duyệt" để kết nối an toàn.',
          'Running from a local file (file://) does not support Google sign-in due to Google OAuth security policy. Please click "Sign in via browser" to connect safely.'
        )
      );
    }

    const oauthStatus = await fetchOAuthServerStatus(true);
    if (oauthStatus.configured) {
      return await signInWithServerOAuthPopup(options);
    }

    // Fallback to Firebase Auth popup when server-side OAuth env vars are not configured (e.g. vite dev)
    const googleProvider = buildGoogleProvider(options);
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        tr(
          'Không nhận được mã truy cập Google Drive từ phiên đăng nhập.',
          'Did not receive Google Drive access token from the sign-in session.'
        )
      );
    }
    oauthWebUser = null;
    cachedAccessToken = credential.accessToken;
    cachedTokenExpiresAt = Date.now() + 3600 * 1000;
    saveWebAccessTokenCache(cachedAccessToken, result.user.email);
    saveLastGoogleEmail(result.user.email);
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const clearGoogleAccessToken = (): void => {
  clearProactiveRefreshTimer();
  cachedAccessToken = null;
  cachedTokenExpiresAt = 0;
  bridgeUser = null;
  activeBridgeSession = null;
  oauthWebUser = null;
  cachedOAuthStatus = cachedOAuthStatus ? { ...cachedOAuthStatus, hasSession: false } : null;
  clearBridgeSession();
  clearWebAccessTokenCache();
};

export const googleLogout = async (): Promise<void> => {
  const fileMode = isFileMode();
  const bridgeSessionToken = activeBridgeSession?.sessionToken;

  clearProactiveRefreshTimer();
  cachedAccessToken = null;
  cachedTokenExpiresAt = 0;
  bridgeUser = null;
  activeBridgeSession = null;
  oauthWebUser = null;
  cachedOAuthStatus = cachedOAuthStatus ? { ...cachedOAuthStatus, hasSession: false } : null;
  clearBridgeSession();
  clearWebAccessTokenCache();
  clearLastGoogleEmail();

  try {
    const endpoint = `${getAuthApiOrigin()}/api/auth/google/logout`;
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(fileMode
        ? { body: JSON.stringify(bridgeSessionToken ? { sessionToken: bridgeSessionToken } : {}) }
        : { credentials: 'include' as RequestCredentials, body: '{}' }),
    });
  } catch {
    // ignore server logout errors when offline
  }

  try {
    await auth.signOut();
  } catch {
    // ignore signout errors on file://
  }
};
