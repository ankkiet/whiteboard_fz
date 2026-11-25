import {
  decryptJson,
  EncryptedDriveSession,
  encryptJson,
  getCorsHeaders,
  isOAuthConfigured,
  jsonResponse,
  PagesContext,
  parseCookies,
  SESSION_COOKIE_NAME,
} from './_shared';

export async function onRequestOptions(context: PagesContext): Promise<Response> {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

/**
 * Mints an encrypted sessionToken from the web browser's HttpOnly cookie
 * so the desktop app (via Auth Bridge) can refresh access tokens indefinitely
 * without ever seeing the raw Google refresh_token or client_secret.
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const cors = getCorsHeaders(request);

  if (!isOAuthConfigured(env)) {
    return jsonResponse({ ok: false, error: 'not_configured' }, 501, cors);
  }

  const secret = env.AUTH_SESSION_SECRET!.trim();
  const cookies = parseCookies(request);
  const rawCookie = cookies[SESSION_COOKIE_NAME];
  if (!rawCookie) {
    return jsonResponse({ ok: false, error: 'no_session' }, 401, cors);
  }

  const session = await decryptJson<EncryptedDriveSession>(rawCookie, secret);
  if (!session?.refreshToken || !session.user) {
    return jsonResponse({ ok: false, error: 'invalid_session' }, 401, cors);
  }

  const desktopSessionToken = await encryptJson(
    {
      ...session,
      issuedAt: Date.now(),
    } satisfies EncryptedDriveSession,
    secret
  );

  return jsonResponse({ ok: true, sessionToken: desktopSessionToken }, 200, cors);
}
