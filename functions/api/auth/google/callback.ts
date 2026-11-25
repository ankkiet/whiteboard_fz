import {
  buildClearCookie,
  buildCookie,
  decryptJson,
  EncryptedDriveSession,
  encryptJson,
  escapeHtml,
  fetchGoogleUserInfo,
  isHttpsRequest,
  isOAuthConfigured,
  OAuthTxState,
  PagesContext,
  parseCookies,
  safeJsonForInlineScript,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  TX_COOKIE_NAME,
  TX_MAX_AGE_SEC,
} from './_shared';

function renderPopupHtml(
  targetOrigin: string,
  payload: unknown,
  isSuccess: boolean,
  errorText?: string,
  cookies: string[] = []
): Response {
  const safePayload = safeJsonForInlineScript(payload);
  const safeOrigin = safeJsonForInlineScript(targetOrigin);
  const message = isSuccess
    ? 'Đăng nhập Google thành công. Đang quay lại ứng dụng...'
    : escapeHtml(errorText || 'Đăng nhập Google không thành công.');

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>fzInK - Google Auth</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; padding: 24px; text-align: center; }
    .card { max-width: 380px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px 24px; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); }
    p { margin: 0; font-size: 14px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card"><p>${message}</p></div>
  <script>
    (function () {
      var payload = ${safePayload};
      var origin = ${safeOrigin};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, origin);
        }
      } catch (e) {}
      setTimeout(function () {
        try { window.close(); } catch (e) {}
      }, ${isSuccess ? 150 : 1200});
    })();
  </script>
</body>
</html>`;

  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie);
  }
  return new Response(html, { status: isSuccess ? 200 : 400, headers });
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const reqUrl = new URL(request.url);
  const secure = isHttpsRequest(request);
  const clearTx = buildClearCookie(TX_COOKIE_NAME, secure);

  if (!isOAuthConfigured(env)) {
    return renderPopupHtml(
      reqUrl.origin,
      { type: 'FZINK_OAUTH_RESULT', ok: false, errorCode: 'server_not_configured' },
      false,
      'Máy chủ chưa cấu hình Google OAuth.',
      [clearTx]
    );
  }

  const secret = env.AUTH_SESSION_SECRET!.trim();
  const cookies = parseCookies(request);
  const txRaw = cookies[TX_COOKIE_NAME];
  const tx = txRaw ? await decryptJson<OAuthTxState>(txRaw, secret) : null;

  const oauthError = reqUrl.searchParams.get('error');
  const code = reqUrl.searchParams.get('code');
  const state = reqUrl.searchParams.get('state');

  const mode = tx?.mode || 'popup';
  const returnTo = tx?.returnTo || `${reqUrl.origin}/`;

  if (oauthError) {
    const errorCode = oauthError === 'access_denied' ? 'auth/popup-closed-by-user' : oauthError;
    if (mode === 'redirect') {
      const dest = new URL(returnTo);
      dest.searchParams.set('oauth_error', errorCode);
      const headers = new Headers({ Location: dest.toString(), 'Cache-Control': 'no-store' });
      headers.append('Set-Cookie', clearTx);
      return new Response(null, { status: 302, headers });
    }
    return renderPopupHtml(
      reqUrl.origin,
      { type: 'FZINK_OAUTH_RESULT', ok: false, errorCode },
      false,
      'Bạn đã hủy đăng nhập Google.',
      [clearTx]
    );
  }

  if (
    !tx ||
    !code ||
    !state ||
    tx.state !== state ||
    Date.now() - tx.createdAt > TX_MAX_AGE_SEC * 1000
  ) {
    return renderPopupHtml(
      reqUrl.origin,
      { type: 'FZINK_OAUTH_RESULT', ok: false, errorCode: 'invalid_state' },
      false,
      'Phiên xác thực đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.',
      [clearTx]
    );
  }

  const redirectUri = `${reqUrl.origin}/api/auth/google/callback`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: tx.codeVerifier,
    }).toString(),
  });

  const tokenData = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenData.access_token) {
    return renderPopupHtml(
      reqUrl.origin,
      {
        type: 'FZINK_OAUTH_RESULT',
        ok: false,
        errorCode: tokenData.error || 'token_exchange_failed',
        errorMessage: tokenData.error_description,
      },
      false,
      'Không thể đổi mã xác thực Google. Vui lòng thử lại.',
      [clearTx]
    );
  }

  const user = await fetchGoogleUserInfo(tokenData.access_token);

  // Preserve previous refresh_token for the same account if Google omitted it on a re-consent
  let refreshToken = tokenData.refresh_token;
  if (!refreshToken && cookies[SESSION_COOKIE_NAME]) {
    const prevSession = await decryptJson<EncryptedDriveSession>(
      cookies[SESSION_COOKIE_NAME],
      secret
    );
    if (
      prevSession?.refreshToken &&
      prevSession.user?.email &&
      prevSession.user.email === user.email
    ) {
      refreshToken = prevSession.refreshToken;
    }
  }

  if (!refreshToken) {
    return renderPopupHtml(
      reqUrl.origin,
      { type: 'FZINK_OAUTH_RESULT', ok: false, errorCode: 'missing_refresh_token' },
      false,
      'Google chưa cấp mã gia hạn dài hạn (refresh token). Vui lòng thử lại và chấp nhận quyền truy cập.',
      [clearTx]
    );
  }

  const sessionPayload: EncryptedDriveSession = {
    v: 1,
    refreshToken,
    user,
    issuedAt: Date.now(),
  };

  const encryptedSession = await encryptJson(sessionPayload, secret);
  const sessionCookie = buildCookie(SESSION_COOKIE_NAME, encryptedSession, {
    maxAge: SESSION_MAX_AGE_SEC,
    secure,
  });

  const expiresIn =
    typeof tokenData.expires_in === 'number' && tokenData.expires_in > 0
      ? tokenData.expires_in
      : 3600;

  if (mode === 'redirect') {
    const headers = new Headers({ Location: returnTo, 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', clearTx);
    headers.append('Set-Cookie', sessionCookie);
    return new Response(null, { status: 302, headers });
  }

  return renderPopupHtml(
    reqUrl.origin,
    {
      type: 'FZINK_OAUTH_RESULT',
      ok: true,
      accessToken: tokenData.access_token,
      expiresIn,
      user,
    },
    true,
    undefined,
    [clearTx, sessionCookie]
  );
}
