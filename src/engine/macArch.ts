export type MacArch = 'arm64' | 'x64';

export interface MacArchSignals {
  uaDataArchitecture?: string | null;
  webglRenderer?: string | null;
  webglVendor?: string | null;
  webglExtensions?: readonly string[] | null;
}

export interface MacArchDetectionResult {
  arch: MacArch;
  /** True when the current macOS CPU architecture was confidently inferred */
  detected: boolean;
  source: 'ua-data' | 'webgl-renderer' | 'webgl-extensions' | 'fallback';
}

interface NavigatorUADataLike {
  getHighEntropyValues?: (
    hints: string[]
  ) => Promise<{ architecture?: string; bitness?: string; platform?: string }>;
}

/**
 * Pure classifier that maps browser hardware/UA signals to Apple Silicon (arm64) or Intel (x64).
 */
export function classifyMacArchSignals(signals: MacArchSignals): MacArchDetectionResult {
  const uaArch = (signals.uaDataArchitecture ?? '').trim();
  if (uaArch) {
    if (/arm|aarch64/i.test(uaArch)) {
      return { arch: 'arm64', detected: true, source: 'ua-data' };
    }
    if (/x86|amd64|x64|intel/i.test(uaArch)) {
      return { arch: 'x64', detected: true, source: 'ua-data' };
    }
  }

  const renderer = (signals.webglRenderer ?? '').trim();
  const vendor = (signals.webglVendor ?? '').trim();

  // Intel Macs always use Intel, AMD/Radeon, or NVIDIA GPUs — never Apple Silicon GPUs.
  if (/\b(intel|amd|radeon|nvidia|geforce)\b/i.test(renderer) || /\b(intel|amd|nvidia)\b/i.test(vendor)) {
    return { arch: 'x64', detected: true, source: 'webgl-renderer' };
  }

  // Explicit Apple Silicon M-series GPU string (e.g. "Apple M1", "Apple M2 Pro", "Apple M4").
  if (/apple\s+m\d/i.test(renderer)) {
    return { arch: 'arm64', detected: true, source: 'webgl-renderer' };
  }

  // Safari 15+ masks UNMASKED_RENDERER_WEBGL to generic "Apple GPU" on both Intel and Apple Silicon.
  // Distinguish them via hardware-backed compressed texture extensions:
  // Apple Silicon exposes ASTC/ETC; Intel/AMD GPUs expose S3TC without ASTC/ETC.
  const extensions = signals.webglExtensions;
  if (extensions && extensions.length > 0) {
    const extSet = new Set(extensions);
    if (extSet.has('WEBGL_compressed_texture_astc') || extSet.has('WEBGL_compressed_texture_etc')) {
      return { arch: 'arm64', detected: true, source: 'webgl-extensions' };
    }
    if (/apple\s+gpu/i.test(renderer) && extSet.has('WEBGL_compressed_texture_s3tc')) {
      return { arch: 'x64', detected: true, source: 'webgl-extensions' };
    }
  }

  return { arch: 'arm64', detected: false, source: 'fallback' };
}

function readWebGLSignals(): Pick<MacArchSignals, 'webglRenderer' | 'webglVendor' | 'webglExtensions'> {
  if (typeof document === 'undefined') {
    return {};
  }

  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) {
      return {};
    }

    let webglRenderer: string | null = null;
    let webglVendor: string | null = null;

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const r = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      const v = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      webglRenderer = typeof r === 'string' ? r : null;
      webglVendor = typeof v === 'string' ? v : null;
    }

    if (!webglRenderer) {
      const fallbackRenderer = gl.getParameter(gl.RENDERER);
      webglRenderer = typeof fallbackRenderer === 'string' ? fallbackRenderer : null;
    }

    const webglExtensions = gl.getSupportedExtensions() ?? [];

    // Release temporary WebGL context to avoid hitting browser context limits.
    gl.getExtension('WEBGL_lose_context')?.loseContext();

    return { webglRenderer, webglVendor, webglExtensions };
  } catch {
    return {};
  }
}

/**
 * Detects whether the current macOS browser is running on Apple Silicon (arm64) or Intel (x64).
 * Uses Client Hints (Chromium) first, then falls back to WebGL GPU/extension diagnostics (Safari/Firefox).
 */
export async function detectMacArchitecture(): Promise<MacArchDetectionResult> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { arch: 'arm64', detected: false, source: 'fallback' };
  }

  const ua = navigator.userAgent.toLowerCase();
  if (!/macintosh|mac os x/.test(ua) || /iphone|ipad|ipod/.test(ua)) {
    return { arch: 'arm64', detected: false, source: 'fallback' };
  }

  let uaDataArchitecture: string | null = null;
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUADataLike }).userAgentData;
  if (uaData?.getHighEntropyValues) {
    try {
      const values = await uaData.getHighEntropyValues(['architecture']);
      if (typeof values.architecture === 'string' && values.architecture.trim()) {
        uaDataArchitecture = values.architecture;
      }
    } catch {
      // Ignore permission or browser errors and fall through to WebGL heuristics.
    }
  }

  if (uaDataArchitecture) {
    const direct = classifyMacArchSignals({ uaDataArchitecture });
    if (direct.detected) {
      return direct;
    }
  }

  const webglSignals = readWebGLSignals();
  return classifyMacArchSignals({
    uaDataArchitecture,
    ...webglSignals,
  });
}
