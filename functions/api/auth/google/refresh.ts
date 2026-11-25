import {
  buildClearCookie,
  buildCookie,
  decryptJson,
  EncryptedDriveSession,
  encryptJson,
  exchangeRefreshTokenForAccessToken,
  getCorsHeaders,
  isHttpsRequest,
  isOAuthConfigured,
  jsonResponse,
  PagesContext,
  parseCookies,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
} from './_shared';

export async function onRequestOptions(context: PagesContext): Promise<Response> {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const cors = getCorsHeaders(request);

  if (!isOAuthConfigured(env)) {
    return jsonResponse({ ok: false, error: 'not_configured' }, 501, cors);
  }

  const secret = env.AUTH_SESSION_SECRET!.trim();
  const secure = isHttpsRequest(request);

  let bodySessionToken: string | null = null;
  try {
    const body = (await request.json()) as { sessionToken?: unknown };
    if (typeof body?.sessionToken === 'string' && body.sessionToken.trim()) {
      bodySessionToken = body.sessionToken.trim();
    }
  } catch {
    // Empty or non-JSON body is expected when web relies on HttpOnly cookie
  }

  const cookies = parseCookies(request);
  const rawToken = bodySessionToken || cookies[SESSION_COOKIE_NAME] || '';
  if (!rawToken) {
    return jsonResponse({ ok: false, error: 'no_session', revoked: false }, 401, cors);
  }

  const session = await decryptJson<EncryptedDriveSession>(rawToken, secret);
  if (!session?.refreshToken || !session.user) {
    const clearCookies = bodySessionToken ? [] : [buildClearCookie(SESSION_COOKIE_NAME, secure)];
    return jsonResponse({ ok: false, error: 'invalid_session', revoked: true }, 401, cors, clearCookies);
  }

  const refreshed = await exchangeRefreshTokenForAccessToken(session.refreshToken, env);
  if (!refreshed.ok) {
    const clearCookies =
      refreshed.revoked && !bodySessionToken
        ? [buildClearCookie(SESSION_COOKIE_NAME, secure)]
        : [];
    return jsonResponse(
      {
        ok: false,
        error: refreshed.revoked ? 'invalid_grant' : 'refresh_failed',
        revoked: refreshed.revoked,
        detail: refreshed.error,
      },
      refreshed.revoked ? 401 : 502,
      cors,
      clearCookies
    );
  }

  let nextSessionToken: string | undefined;
  const cookiesToSet: string[] = [];

  if (refreshed.refreshToken && refreshed.refreshToken !== session.refreshToken) {
    const updatedSession: EncryptedDriveSession = {
      ...session,
      refreshToken: refreshed.refreshToken,
      issuedAt: Date.now(),
    };
    nextSessionToken = await encryptJson(updatedSession, secret);
    if (!bodySessionToken) {
      cookiesToSet.push(
        buildCookie(SESSION_COOKIE_NAME, nextSessionToken, {
          maxAge: SESSION_MAX_AGE_SEC,
          secure,
        })
      );
    }
  } else if (!bodySessionToken) {
    // Slide cookie Max-Age forward for active web users
    cookiesToSet.push(
      buildCookie(SESSION_COOKIE_NAME, rawToken, {
        maxAge: SESSION_MAX_AGE_SEC,
        secure,
      })
    );
  }

  return jsonResponse(
    {
      ok: true,
      accessToken: refreshed.accessToken,
      expiresIn: refreshed.expiresIn,
      user: session.user,
      ...(bodySessionToken && nextSessionToken ? { sessionToken: nextSessionToken } : {}),
    },
    200,
    cors,
    cookiesToSet
  );
}
