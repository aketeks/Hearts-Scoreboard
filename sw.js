// Service worker for Hearts Scoreboard.
//
// Strategy: the app shell (index.html, manifest, icon, '/') is ALWAYS fetched
// from the network first, falling back to cache only when offline. This is
// what makes new deploys show up immediately instead of getting stuck behind
// a stale cached copy. Hashed asset files (assets/*-<hash>.js/css/woff2) are
// safe to cache-first since their filename changes whenever their content
// does — an old cache entry can never shadow a new deploy for those.
const CACHE = 'hearts-scoreboard-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

function isHashedAsset(url) {
  return /\/assets\//.test(url);
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const hashed = isHashedAsset(event.request.url);

  if (hashed) {
    // Immutable — safe to serve from cache first, populate cache on miss.
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            if (res.ok) caches.open(CACHE).then((cache) => cache.put(event.request, res.clone()));
            return res;
          })
      )
    );
    return;
  }

  // App shell / navigations — network first so deploys show up immediately;
  // fall back to the last cached copy only when there's no connection.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((cache) => cache.put(event.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
