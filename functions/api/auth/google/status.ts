import {
  decryptJson,
  EncryptedDriveSession,
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

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const configured = isOAuthConfigured(env);
  let hasSession = false;

  if (configured) {
    const cookies = parseCookies(request);
    const rawCookie = cookies[SESSION_COOKIE_NAME];
    if (rawCookie) {
      const session = await decryptJson<EncryptedDriveSession>(
        rawCookie,
        env.AUTH_SESSION_SECRET!.trim()
      );
      hasSession = Boolean(session?.refreshToken && session?.user);
    }
  }

  return jsonResponse({ configured, hasSession }, 200, getCorsHeaders(request));
}
