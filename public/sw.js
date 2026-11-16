const CACHE_NAME = 'mymoney-pwa-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg',
];

// 安裝時立即接管並預快取核心殼層
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    })
  );
});

// 啟動時清理舊版快取並立即控制所有頁面
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截請求：
// 1. Google Drive / Google OAuth / 報價 API / 非 GET 請求 -> 100% 走網路不快取，確保資料與報價即時準確
// 2. HTML 與前端靜態資源 (JS / CSS / Font / Icons) -> Network-First (有網路拿最新並更新快取，離線時自動回傳快取秒開)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 排除所有動態 API 與外部行情/雲端硬碟端點
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('binance.com') ||
    url.hostname.includes('coingecko.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200 && (url.origin === self.location.origin || url.hostname.includes('fonts.g'))) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone);
          });
        }
        return networkRes;
      })
      .catch(() => {
        return caches.match(req).then((cachedRes) => {
          if (cachedRes) return cachedRes;
          if (req.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

