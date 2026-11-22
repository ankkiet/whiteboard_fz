import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  BridgeSession,
  clearBridgeSession,
  clearWebAccessTokenCache,
  loadBridgeSession,
  loadWebAccessTokenCache,
  saveBridgeSession,
  saveWebAccessTokenCache,
} from './authBridge';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let bridgeUser: User | null = null;

export const setBridgeSession = (
  session: BridgeSession,
  onSuccess?: (user: User, token: string) => void
): void => {
  cachedAccessToken = session.accessToken;
  bridgeUser = session.user as unknown as User;
  saveBridgeSession(session);
  onSuccess?.(bridgeUser, cachedAccessToken);
};

export const getActiveBridgeUser = (): User | null => bridgeUser;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  const isFile = typeof window !== 'undefined' && window.location.protocol === 'file:';

  // In desktop file:// mode, check if we have a saved bridge session
  if (isFile) {
    const savedBridge = loadBridgeSession();
    if (savedBridge?.accessToken && savedBridge.user) {
      cachedAccessToken = savedBridge.accessToken;
      bridgeUser = savedBridge.user as unknown as User;
      onAuthSuccess?.(bridgeUser, cachedAccessToken);
    }
  } else if (!cachedAccessToken) {
    // In web mode, check if we have a cached access token from current browser session
    const webCachedToken = loadWebAccessTokenCache();
    if (webCachedToken) {
      cachedAccessToken = webCachedToken;
    }
  }

  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      bridgeUser = null;
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      if (isFile && bridgeUser && cachedAccessToken) {
        onAuthSuccess?.(bridgeUser, cachedAccessToken);
      } else {
        cachedAccessToken = null;
        bridgeUser = null;
        onAuthFailure?.(null);
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      throw new Error(
        'Bản cài đặt chạy từ tệp cục bộ (file://) không hỗ trợ đăng nhập Google do chính sách bảo mật của Google OAuth. Vui lòng bấm "Đăng nhập qua trình duyệt" để kết nối an toàn.'
      );
    }
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không nhận được mã truy cập Google Drive từ phiên đăng nhập.');
    }
    cachedAccessToken = credential.accessToken;
    saveWebAccessTokenCache(cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const clearGoogleAccessToken = (): void => {
  cachedAccessToken = null;
  bridgeUser = null;
  clearBridgeSession();
  clearWebAccessTokenCache();
};

export const googleLogout = async (): Promise<void> => {
  cachedAccessToken = null;
  bridgeUser = null;
  clearBridgeSession();
  clearWebAccessTokenCache();
  try {
    await auth.signOut();
  } catch {
    // ignore signout errors on file://
  }
};
