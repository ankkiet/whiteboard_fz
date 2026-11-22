import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuthBridgeToken,
  parseAuthBridgeToken,
  getWebPortalOrigin,
} from './authBridge';

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

test('getWebPortalOrigin returns fallback Firebase host if no window', () => {
  const origin = getWebPortalOrigin();
  assert.ok(origin.startsWith('https://'));
});
