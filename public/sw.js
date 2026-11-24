// Service Worker cho fzInK (PWA)
// Cho phép ứng dụng hoạt động ngoại tuyến và tự động cập nhật ngầm khi có bản mới
const CACHE_NAME = 'fzink-pwa-v2';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Không bao giờ chặn các request khác tên miền (như tải bộ cài từ GitHub Releases, Google Drive, Fonts...)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Bỏ qua các tệp cài đặt lớn và manifest kiểm tra phiên bản
  if (
    url.pathname === '/app-version.json' ||
    url.pathname === '/app-version.js' ||
    /\.(exe|dmg|zip|msi)$/i.test(url.pathname)
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
