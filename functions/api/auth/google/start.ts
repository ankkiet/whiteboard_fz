import {
  buildCookie,
  encryptJson,
  GOOGLE_OAUTH_SCOPES,
  isHttpsRequest,
  isOAuthConfigured,
  jsonResponse,
  OAuthTxState,
  PagesContext,
  randomToken,
  sha256Base64Url,
  TX_COOKIE_NAME,
  TX_MAX_AGE_SEC,
} from './_shared';

function sanitizeReturnTo(raw: string | null, origin: string): string {
  if (!raw) return `${origin}/`;
  try {
    const parsed = new URL(raw, origin);
    if (parsed.origin === origin) {
      return parsed.toString();
    }
  } catch {
    // ignore invalid URL
  }
  return `${origin}/`;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  if (!isOAuthConfigured(env)) {
    return jsonResponse(
      { error: 'Google OAuth server environment variables are not configured.' },
      501
    );
  }

  const reqUrl = new URL(request.url);
  const mode = reqUrl.searchParams.get('mode') === 'redirect' ? 'redirect' : 'popup';
  const forceAccountPicker = reqUrl.searchParams.get('prompt') === 'select_account';
  const loginHint = reqUrl.searchParams.get('login_hint')?.trim() || '';
  const returnTo = sanitizeReturnTo(reqUrl.searchParams.get('return_to'), reqUrl.origin);

  const state = randomToken(24);
  const codeVerifier = randomToken(48);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const txPayload: OAuthTxState = {
    v: 1,
    state,
    codeVerifier,
    mode,
    returnTo,
    createdAt: Date.now(),
  };

  const encryptedTx = await encryptJson(txPayload, env.AUTH_SESSION_SECRET!.trim());
  const txCookie = buildCookie(TX_COOKIE_NAME, encryptedTx, {
    maxAge: TX_MAX_AGE_SEC,
    secure: isHttpsRequest(request),
  });

  const redirectUri = `${reqUrl.origin}/api/auth/google/callback`;
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID!.trim());
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GOOGLE_OAUTH_SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('include_granted_scopes', 'true');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  // 'consent' guarantees Google issues a refresh_token; include select_account when switching or no hint
  authUrl.searchParams.set(
    'prompt',
    forceAccountPicker || !loginHint ? 'select_account consent' : 'consent'
  );
  if (loginHint && !forceAccountPicker) {
    authUrl.searchParams.set('login_hint', loginHint);
  }

  const headers = new Headers({
    Location: authUrl.toString(),
    'Cache-Control': 'no-store',
  });
  headers.append('Set-Cookie', txCookie);

  return new Response(null, { status: 302, headers });
}
