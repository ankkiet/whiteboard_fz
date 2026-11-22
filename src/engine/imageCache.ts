const cache = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

export function subscribeImageCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function getCachedImage(assetId: string, dataUrl: string): HTMLImageElement | null {
  if (!dataUrl) return null;

  const existing = cache.get(assetId);
  if (existing) {
    if (existing.src === dataUrl) {
      return existing.complete && existing.naturalWidth > 0 ? existing : null;
    }
    cache.delete(assetId);
  }

  const img = new Image();
  img.onload = () => {
    notifyListeners();
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
