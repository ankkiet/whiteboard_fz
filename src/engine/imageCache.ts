const cache = new Map<string, HTMLImageElement>();
const lodCache = new Map<string, HTMLCanvasElement>();
const listeners = new Set<() => void>();

const LOD_MAX_WIDTH = 380;
let pendingNotifyRaf: number | null = null;

export function subscribeImageCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function flushNotifyListeners() {
  pendingNotifyRaf = null;
  for (const listener of listeners) {
    listener();
  }
}

function scheduleNotifyListeners() {
  if (typeof requestAnimationFrame === 'function') {
    if (pendingNotifyRaf !== null) return;
    pendingNotifyRaf = requestAnimationFrame(flushNotifyListeners);
  } else {
    flushNotifyListeners();
  }
}

function buildLodCanvas(img: HTMLImageElement): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || img.naturalWidth <= LOD_MAX_WIDTH * 1.4) {
    return null;
  }
  const scale = LOD_MAX_WIDTH / img.naturalWidth;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

export function getCachedImage(
  assetId: string,
  dataUrl: string,
  displayPixelWidth?: number
): CanvasImageSource | null {
  if (!dataUrl) return null;

  const existing = cache.get(assetId);
  if (existing) {
    if (existing.src === dataUrl) {
      if (!(existing.complete && existing.naturalWidth > 0)) return null;
      if (displayPixelWidth !== undefined && displayPixelWidth > 0 && displayPixelWidth <= LOD_MAX_WIDTH) {
        let lod = lodCache.get(assetId);
        if (lod === undefined) {
          const built = buildLodCanvas(existing);
          if (built) {
            lodCache.set(assetId, built);
            lod = built;
          }
        }
        if (lod) return lod;
      }
      return existing;
    }
    cache.delete(assetId);
    lodCache.delete(assetId);
  }

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    scheduleNotifyListeners();
  };
  img.src = dataUrl;
  cache.set(assetId, img);
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export function loadImageAsync(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}
