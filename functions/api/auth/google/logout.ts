import {
  buildClearCookie,
  decryptJson,
  EncryptedDriveSession,
  getCorsHeaders,
  isHttpsRequest,
  isOAuthConfigured,
  jsonResponse,
  PagesContext,
  parseCookies,
  revokeGoogleToken,
  SESSION_COOKIE_NAME,
} from './_shared';

export async function onRequestOptions(context: PagesContext): Promise<Response> {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const cors = getCorsHeaders(request);
  const secure = isHttpsRequest(request);
  const clearCookie = buildClearCookie(SESSION_COOKIE_NAME, secure);

  let bodySessionToken: string | null = null;
  try {
    const body = (await request.json()) as { sessionToken?: unknown };
    if (typeof body?.sessionToken === 'string' && body.sessionToken.trim()) {
      bodySessionToken = body.sessionToken.trim();
    }
  } catch {
    // ignore
  }

  if (isOAuthConfigured(env)) {
    const secret = env.AUTH_SESSION_SECRET!.trim();
    const cookies = parseCookies(request);
    const rawToken = bodySessionToken || cookies[SESSION_COOKIE_NAME] || '';
    if (rawToken) {
      const session = await decryptJson<EncryptedDriveSession>(rawToken, secret);
      if (session?.refreshToken) {
        const revokePromise = revokeGoogleToken(session.refreshToken);
        if (context.waitUntil) {
          context.waitUntil(revokePromise);
        } else {
          await revokePromise;
        }
      }
    }
  }

  return jsonResponse(
    { ok: true },
    200,
    cors,
    bodySessionToken ? [] : [clearCookie]
  );
}
