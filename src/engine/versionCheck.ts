export interface AppVersionManifest {
  version: string;
  buildId: string;
  nativeVersion?: string;
  minNativeVersion?: string;
  otaBundleUrl?: string;
  otaBundleSha256?: string;
  otaBundleSize?: number;
  notes?: string;
  updateOrigin?: string;
}

export interface VersionConfigInput {
  version?: string;
  minNativeVersion?: string;
  notes?: string;
}

export type DesktopUpdateKind = 'none' | 'ota' | 'native';

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

/**
 * Extracts numeric segments from version strings like "v_fz.1.1.1.1.8" or "1.2.7".
 */
export function parseVersionSegments(version?: string | null): number[] {
  if (!version) return [];
  const matches = version.match(/\d+/g);
  if (!matches) return [];
  return matches.map((n) => Number.parseInt(n, 10));
}

/**
 * Compares two version strings numerically.
 * Returns > 0 if `a > b`, < 0 if `a < b`, or 0 if equal (or unparseable).
 */
export function compareVersionStrings(a?: string | null, b?: string | null): number {
  const segA = parseVersionSegments(a);
  const segB = parseVersionSegments(b);
  if (segA.length === 0 || segB.length === 0) return 0;
  const maxLen = Math.max(segA.length, segB.length);
  for (let i = 0; i < maxLen; i += 1) {
    const va = segA[i] ?? 0;
    const vb = segB[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

/**
 * Determines whether a desktop app needs an update.
 * Uses semantic/numeric version comparison first so cross-OS buildId hash differences
 * (Cloudflare Linux vs GitHub Actions Windows/macOS) never trigger false-positive loops
 * when the installed version already matches or exceeds the latest release.
 */
export function shouldPromptDesktopUpdate(params: {
  installedVersion?: string | null;
  installedBuildId?: string | null;
  latest?: AppVersionManifest | null;
}): boolean {
  const { installedVersion, installedBuildId, latest } = params;
  if (!latest) return false;

  const installedSegs = parseVersionSegments(installedVersion);
  const latestSegs = parseVersionSegments(latest.version);

  if (installedSegs.length > 0 && latestSegs.length > 0) {
    return compareVersionStrings(latest.version, installedVersion) > 0;
  }

  if (installedVersion && latest.version && installedVersion !== latest.version) {
    return true;
  }

  if (!installedVersion && installedBuildId && latest.buildId) {
    return installedBuildId !== latest.buildId;
  }

  return false;
}

/**
 * Combines package.json version (the Electron native shell version) with optional
 * version.json overrides so small web-only releases can bump the 4th segment (e.g. 1.2.12.1)
 * while native bumps in package.json automatically raise minNativeVersion and version.
 */
export function resolveEffectiveVersionConfig(params: {
  packageVersion: string;
  versionConfig?: VersionConfigInput | null;
}): {
  version: string;
  nativeVersion: string;
  minNativeVersion: string;
  notes: string;
} {
  const nativeVersion = (params.packageVersion || '').trim() || '1.0.0';
  const cfg = params.versionConfig ?? {};
  const cfgMinNative = (cfg.minNativeVersion || '').trim();
  const cfgVersion = (cfg.version || '').trim();

  const minNativeVersion =
    cfgMinNative && compareVersionStrings(cfgMinNative, nativeVersion) >= 0
      ? cfgMinNative
      : nativeVersion;

  const version = cfgVersion || nativeVersion;

  return {
    version,
    nativeVersion,
    minNativeVersion,
    notes: (cfg.notes || '').trim(),
  };
}

/**
 * Resolves an OTA bundle path/URL (e.g. "web-update.zip") against the update origin.
 */
export function resolveOtaBundleUrl(
  sourceOrigin: string,
  otaBundleUrl?: string | null
): string | null {
  const raw = (otaBundleUrl || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const cleanOrigin = normalizeOriginUrl(sourceOrigin);
  if (!cleanOrigin) return null;
  const cleanPath = raw.replace(/^\/+/, '');
  return `${cleanOrigin}/${cleanPath}`;
}

/**
 * Classifies whether an available desktop update should be applied via fast OTA web bundle
 * or via the full native installer (.exe / .dmg).
 */
export function classifyDesktopUpdateKind(params: {
  installedVersion?: string | null;
  installedBuildId?: string | null;
  installedNativeVersion?: string | null;
  hasOtaBridge?: boolean;
  latest?: AppVersionManifest | null;
}): DesktopUpdateKind {
  const {
    installedVersion,
    installedBuildId,
    installedNativeVersion,
    hasOtaBridge = false,
    latest,
  } = params;

  if (!shouldPromptDesktopUpdate({ installedVersion, installedBuildId, latest })) {
    return 'none';
  }

  if (!latest?.otaBundleUrl || !hasOtaBridge) {
    return 'native';
  }

  const requiredNative = latest.minNativeVersion || latest.nativeVersion;
  if (!installedNativeVersion || !requiredNative) {
    return 'native';
  }

  if (compareVersionStrings(requiredNative, installedNativeVersion) > 0) {
    return 'native';
  }

  return 'ota';
}
