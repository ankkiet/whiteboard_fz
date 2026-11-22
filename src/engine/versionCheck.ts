export interface AppVersionManifest {
  version: string;
  buildId: string;
  notes?: string;
  updateOrigin?: string;
}

export type UpdateCheckFailureReason =
  | 'offline'
  | 'auth-or-cors-blocked'
  | 'local-server-stopped'
  | 'no-update-origin'
  | 'server-unreachable';

export type UpdateCheckResult =
  | {
      ok: true;
      manifest: AppVersionManifest;
      sourceOrigin: string;
    }
  | {
      ok: false;
      reason: UpdateCheckFailureReason;
      portalUrl?: string;
      httpStatus?: number;
    };

export function normalizeOriginUrl(origin?: string | null): string {
  if (!origin) return '';
  return origin.trim().replace(/\/+$/, '');
}

export function isLocalhostOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(origin);
}

export function isAiStudioPreviewOrigin(origin: string): boolean {
  return /^https:\/\/ais-(dev|pre)-[^/]+\.run\.app$/i.test(origin);
}

export const PRODUCTION_UPDATE_ORIGIN = 'https://whiteboardfz.pages.dev';

/**
 * Builds ordered origin candidates for fetching app-version manifest / bundle.
 * When running from a local file:// desktop app pointing at an ais-dev-* origin,
 * also appends the sibling ais-pre-* origin in case a public shared preview exists,
 * and accepts an optional fallbackOrigin (e.g. production Cloudflare Pages).
 */
export function buildUpdateOriginCandidates(
  protocol: string,
  currentOrigin?: string | null,
  embeddedOrigin?: string | null,
  fallbackOrigin?: string | null
): string[] {
  if (protocol !== 'file:') {
    const clean = normalizeOriginUrl(currentOrigin);
    if (clean) return [clean];
    const cleanFallback = normalizeOriginUrl(fallbackOrigin);
    return cleanFallback ? [cleanFallback] : [];
  }

  const primary = normalizeOriginUrl(embeddedOrigin);
  const candidates: string[] = [];
  if (primary) {
    candidates.push(primary);
    if (/^https:\/\/ais-dev-/i.test(primary)) {
      const sharedCandidate = primary.replace(/^https:\/\/ais-dev-/i, 'https://ais-pre-');
      if (sharedCandidate !== primary) {
        candidates.push(sharedCandidate);
      }
    }
  }

  if (fallbackOrigin) {
    const cleanFallback = normalizeOriginUrl(fallbackOrigin);
    if (cleanFallback && !candidates.includes(cleanFallback)) {
      candidates.push(cleanFallback);
    }
  }

  return candidates;
}

export function classifyUpdateCheckFailure(params: {
  isOnline: boolean;
  protocol: string;
  primaryOrigin?: string | null;
  httpStatuses?: number[];
  hadNetworkOrCorsError?: boolean;
}): {
  reason: UpdateCheckFailureReason;
  portalUrl?: string;
  httpStatus?: number;
} {
  const { isOnline, protocol, primaryOrigin, httpStatuses = [], hadNetworkOrCorsError = false } = params;
  const cleanOrigin = normalizeOriginUrl(primaryOrigin);
  const authStatus = httpStatuses.find((s) => s === 401 || s === 403);
  const lastStatus = httpStatuses.length > 0 ? httpStatuses[httpStatuses.length - 1] : undefined;

  if (!isOnline) {
    return {
      reason: 'offline',
      portalUrl: cleanOrigin || undefined,
      httpStatus: lastStatus,
    };
  }

  if (!cleanOrigin) {
    return {
      reason: 'no-update-origin',
    };
  }

  if (protocol === 'file:') {
    if (isLocalhostOrigin(cleanOrigin)) {
      return {
        reason: 'local-server-stopped',
        portalUrl: cleanOrigin,
        httpStatus: lastStatus,
      };
    }

    if (authStatus !== undefined || isAiStudioPreviewOrigin(cleanOrigin) || hadNetworkOrCorsError) {
      return {
        reason: 'auth-or-cors-blocked',
        portalUrl: cleanOrigin,
        httpStatus: authStatus ?? lastStatus,
      };
    }
  }

  if (authStatus !== undefined) {
    return {
      reason: 'auth-or-cors-blocked',
      portalUrl: cleanOrigin,
      httpStatus: authStatus,
    };
  }

  return {
    reason: 'server-unreachable',
    portalUrl: cleanOrigin,
    httpStatus: lastStatus,
  };
}

export function formatVersionJsonpScript(manifest: AppVersionManifest): string {
  return `window.__BTTM_VERSION_CALLBACK__&&window.__BTTM_VERSION_CALLBACK__(${JSON.stringify(manifest)});\n`;
}
