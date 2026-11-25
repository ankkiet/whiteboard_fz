import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptJson,
  encryptJson,
  getCorsHeaders,
  isOAuthConfigured,
  parseCookies,
  safeJsonForInlineScript,
  sha256Base64Url,
} from './_shared';

test('encryptJson and decryptJson roundtrip payloads and reject tampered tokens', async () => {
  const secret = 'super-secret-test-key-with-sufficient-entropy-12345';
  const payload = {
    v: 1,
    refreshToken: '1//0g_fake_refresh_token',
    user: { uid: 'sub-1', email: 'teacher@gmail.com', displayName: 'Teacher', photoURL: null },
    issuedAt: 1700000000000,
  };

  const encrypted = await encryptJson(payload, secret);
  assert.ok(encrypted.includes('.'));

  const decrypted = await decryptJson<typeof payload>(encrypted, secret);
  assert.deepEqual(decrypted, payload);

  const wrongSecret = await decryptJson(encrypted, 'different-secret');
  assert.equal(wrongSecret, null);

  const tampered = encrypted.slice(0, -4) + 'AAAA';
  assert.equal(await decryptJson(tampered, secret), null);
});

test('sha256Base64Url computes standard RFC 7636 PKCE S256 challenge', async () => {
  // Known vector from RFC 7636 Appendix B
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const challenge = await sha256Base64Url(verifier);
  assert.equal(challenge, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('parseCookies parses encoded cookie pairs safely', () => {
  const req = new Request('https://whiteboardfz.pages.dev/api/auth/google/refresh', {
    headers: {
      Cookie: 'fzink_drive_session=abc%2Edef; other=123',
    },
  });
  const cookies = parseCookies(req);
  assert.equal(cookies.fzink_drive_session, 'abc.def');
  assert.equal(cookies.other, '123');
});

test('getCorsHeaders supports same-origin web credentials and Electron file:// Origin: null', () => {
  const webReq = new Request('https://whiteboardfz.pages.dev/api/auth/google/refresh', {
    headers: { Origin: 'https://whiteboardfz.pages.dev' },
  });
  const webCors = getCorsHeaders(webReq);
  assert.equal(webCors['Access-Control-Allow-Origin'], 'https://whiteboardfz.pages.dev');
  assert.equal(webCors['Access-Control-Allow-Credentials'], 'true');

  const electronReq = new Request('https://whiteboardfz.pages.dev/api/auth/google/refresh', {
    headers: { Origin: 'null' },
  });
  const electronCors = getCorsHeaders(electronReq);
  assert.equal(electronCors['Access-Control-Allow-Origin'], '*');
  assert.equal(electronCors['Access-Control-Allow-Credentials'], undefined);
});

test('safeJsonForInlineScript escapes closing script tags', () => {
  const serialized = safeJsonForInlineScript({ name: '</script><script>alert(1)</script>' });
  assert.equal(serialized.includes('</script>'), false);
  assert.ok(serialized.includes('\\u003c/script\\u003e'));
});

test('isOAuthConfigured requires all 3 environment secrets', () => {
  assert.equal(isOAuthConfigured({}), false);
  assert.equal(
    isOAuthConfigured({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'sec' }),
    false
  );
  assert.equal(
    isOAuthConfigured({
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'sec',
      AUTH_SESSION_SECRET: 'key',
    }),
    true
  );
});
