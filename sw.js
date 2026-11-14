const CACHE = 'scrabby-v10';
const ASSETS = ['./', './index.html', './style.css', './app.js', './tile-bag.js', './solver.js', './dictionary.js', './worker.js', './icon.svg', './manifest.webmanifest', './data/sowpods.txt.gz', './data/shapes.bin.gz', './data/two-letter-words.txt', './data/three-letter-words.txt'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('scrabby-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Keep the large immutable data local. Refresh app code when online so local
  // edits and static-host updates do not leave an old interface cached forever.
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached && new URL(event.request.url).pathname.endsWith('.gz')) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && cached) await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  }));
});
