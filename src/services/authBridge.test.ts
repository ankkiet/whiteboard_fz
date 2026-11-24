import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearBridgeSession,
  clearLastGoogleEmail,
  clearWebAccessTokenCache,
  createAuthBridgeToken,
  getWebPortalOrigin,
  isBridgeSessionExpired,
  loadBridgeSession,
  loadLastGoogleEmail,
  loadWebAccessTokenCache,
  parseAuthBridgeToken,
  saveBridgeSession,
  saveLastGoogleEmail,
  saveWebAccessTokenCache,
} from './authBridge';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

test('createAuthBridgeToken produces valid BTTM- token and parseAuthBridgeToken roundtrips successfully', () => {
  const dummyUser = {
    uid: 'google-user-123',
    displayName: 'Thầy Giáo Văn',
    email: 'giaovan@gmail.com',
    photoURL: 'https://example.com/photo.jpg',
  };
  const token = 'ya29.a0AfH6SMB_fake_google_access_token_xyz';

  const bridgeCode = createAuthBridgeToken(dummyUser, token);
  assert.ok(bridgeCode.startsWith('BTTM-'));

  const parsed = parseAuthBridgeToken(bridgeCode);
  assert.equal(parsed.accessToken, token);
  assert.equal(parsed.user.uid, dummyUser.uid);
  assert.equal(parsed.user.email, dummyUser.email);
  assert.equal(parsed.user.displayName, dummyUser.displayName);
  assert.equal(parsed.user.photoURL, dummyUser.photoURL);
  assert.ok(typeof parsed.createdAt === 'number');
});

test('parseAuthBridgeToken validates token prefix and structure', () => {
  assert.throws(
    () => parseAuthBridgeToken(''),
    /Vui lòng nhập hoặc dán mã kết nối từ trình duyệt/
  );

  assert.throws(
    () => parseAuthBridgeToken('INVALID-TOKEN-WITHOUT-PREFIX'),
    /Mã kết nối không đúng định dạng/
  );

  assert.throws(
    () => parseAuthBridgeToken('BTTM-invalid-base64-???'),
    /Không thể giải mã dữ liệu kết nối/
  );
});

test('getWebPortalOrigin returns fallback host if no window', () => {
  const origin = getWebPortalOrigin();
  assert.ok(origin.startsWith('https://'));
});

test('web access token persists in localStorage with expiry and saves last Google email', () => {
  const prevWindow = (globalThis as any).window;
  const localStorage = createMemoryStorage();
  const sessionStorage = createMemoryStorage();
  (globalThis as any).window = { localStorage, sessionStorage };

  try {
    const t0 = 1_700_000_000_000;
    saveWebAccessTokenCache('tok_abc', 'teacher@school.edu.vn', 60_000, t0);

    assert.equal(loadWebAccessTokenCache(t0 + 30_000), 'tok_abc');
    assert.equal(loadLastGoogleEmail(), 'teacher@school.edu.vn');

    // After expiry, token is rejected and cleared, while email hint stays available
    assert.equal(loadWebAccessTokenCache(t0 + 61_000), null);
    assert.equal(loadLastGoogleEmail(), 'teacher@school.edu.vn');

    clearLastGoogleEmail();
    assert.equal(loadLastGoogleEmail(), null);

    saveLastGoogleEmail('fresh@school.edu.vn');
    assert.equal(loadLastGoogleEmail(), 'fresh@school.edu.vn');
    clearWebAccessTokenCache();
    assert.equal(loadWebAccessTokenCache(t0), null);
  } finally {
    (globalThis as any).window = prevWindow;
  }
});

test('desktop bridge session persists via Electron native IPC even when localStorage is empty', () => {
  const prevWindow = (globalThis as any).window;
  const localStorage = createMemoryStorage();
  let persistedInMain: string | null = null;

  (globalThis as any).window = {
    localStorage,
    fzinkDesktopAuth: {
      loadSessionSync: () => persistedInMain,
      saveSession: (raw: string) => {
        persistedInMain = raw;
      },
      clearSession: () => {
        persistedInMain = null;
      },
    },
  };

  try {
    const t0 = 1_700_000_000_000;
    const session = {
      accessToken: 'ya29.desktop_token',
      user: {
        uid: 'u1',
        displayName: 'Cô Lan',
        email: 'colan@gmail.com',
        photoURL: null,
      },
      createdAt: t0,
      expiresIn: 3600,
    };

    saveBridgeSession(session);
    assert.ok(persistedInMain);

    // Simulate Portable .exe extracting to a brand-new Temp folder (empty localStorage)
    localStorage.clear();

    const restored = loadBridgeSession(t0 + 10 * 60 * 1000);
    assert.equal(restored?.accessToken, 'ya29.desktop_token');
    assert.equal(restored?.user.email, 'colan@gmail.com');

    // Expired bridge session returns null cleanly
    assert.equal(isBridgeSessionExpired(session, t0 + 3600 * 1000), true);
    assert.equal(loadBridgeSession(t0 + 3600 * 1000), null);

    clearBridgeSession();
    assert.equal(persistedInMain, null);
  } finally {
    (globalThis as any).window = prevWindow;
  }
});
