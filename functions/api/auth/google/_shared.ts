/**
 * Shared helpers for Google OAuth 2.0 Authorization Code + PKCE + Refresh Token
 * running on Cloudflare Pages Functions.
 */

export interface OAuthEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AUTH_SESSION_SECRET?: string;
}

export interface PagesContext {
  request: Request;
  env: OAuthEnv;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export interface SessionUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface EncryptedDriveSession {
  v: 1;
  refreshToken: string;
  user: SessionUser;
  issuedAt: number;
}

export interface OAuthTxState {
  v: 1;
  state: string;
  codeVerifier: string;
  mode: 'popup' | 'redirect';
  returnTo: string;
  createdAt: number;
}

export const SESSION_COOKIE_NAME = 'fzink_drive_session';
export const TX_COOKIE_NAME = 'fzink_oauth_tx';
export const COOKIE_PATH = '/api/auth';
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 year
export const TX_MAX_AGE_SEC = 60 * 10; // 10 minutes
export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
].join(' ');

export function isOAuthConfigured(env: OAuthEnv): boolean {
  return Boolean(
    env.GOOGLE_CLIENT_ID?.trim() &&
      env.GOOGLE_CLIENT_SECRET?.trim() &&
      env.AUTH_SESSION_SECRET?.trim()
  );
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(payload: unknown, secret: string): Promise<string> {
  const key = await deriveAesKey(secret);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

export async function decryptJson<T>(token: string, secret: string): Promise<T | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const iv = base64UrlDecode(parts[0]);
    const ciphertext = base64UrlDecode(parts[1]);
    if (iv.length !== 12 || ciphertext.length === 0) return null;
    const key = await deriveAesKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}

export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('Cookie');
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const name = part.slice(0, eqIndex).trim();
    const val = part.slice(eqIndex + 1).trim();
    try {
      result[name] = decodeURIComponent(val);
    } catch {
      result[name] = val;
    }
  }
  return result;
}

export function isHttpsRequest(request: Request): boolean {
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return true;
  }
}

export function buildCookie(
  name: string,
  value: string,
  options: {
    maxAge: number;
    secure: boolean;
    path?: string;
    httpOnly?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
  }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path || COOKIE_PATH}`,
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite || 'Lax'}`,
  ];
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function buildClearCookie(name: string, secure: boolean): string {
  return buildCookie(name, '', { maxAge: 0, secure });
}

export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  const reqOrigin = new URL(request.url).origin;

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };

  if (
    origin &&
    (origin === reqOrigin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin))
  ) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  } else if (origin === 'null' || !origin) {
    // Electron file:// windows send Origin: null
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
}

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
  cookies: string[] = []
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function safeJsonForInlineScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<SessionUser> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google userinfo (${res.status})`);
  }
  const data = (await res.json()) as {
    sub?: string;
    name?: string;
    email?: string;
    picture?: string;
  };
  return {
    uid: data.sub || data.email || 'google-user',
    displayName: data.name || data.email || null,
    email: data.email || null,
    photoURL: data.picture || null,
  };
}

export async function exchangeRefreshTokenForAccessToken(
  refreshToken: string,
  env: OAuthEnv
): Promise<{
  ok: true;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
} | {
  ok: false;
  revoked: boolean;
  error: string;
}> {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!.trim(),
    client_secret: env.GOOGLE_CLIENT_SECRET!.trim(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    const errCode = json.error || '';
    const revoked =
      errCode === 'invalid_grant' ||
      errCode === 'unauthorized_client' ||
      res.status === 400 ||
      res.status === 401;
    return {
      ok: false,
      revoked,
      error: json.error_description || json.error || `HTTP ${res.status}`,
    };
  }

  return {
    ok: true,
    accessToken: json.access_token,
    expiresIn: typeof json.expires_in === 'number' && json.expires_in > 0 ? json.expires_in : 3600,
    refreshToken: json.refresh_token,
  };
}

export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
  } catch {
    // Ignore revoke network errors during logout
  }
}
