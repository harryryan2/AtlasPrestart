// Atlas Paving Pre-Start — Service Worker
// Handles offline caching + background sync queue

const CACHE_NAME = "atlas-prestart-v1";
const OFFLINE_QUEUE_KEY = "atlas-prestart-offline-queue";

// Assets to cache for offline use
const PRECACHE_URLS = ["/", "/index.html"];

// ─── Install: pre-cache shell ─────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch: network-first for API, cache-first for assets ─────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API calls: network only, don't cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ error: "offline" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })
    ));
    return;
  }

  // App shell: cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Cache successful GET responses
          if (event.request.method === "GET" && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // For navigation requests, return the cached app shell
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
    })
  );
});

// ─── Background sync: flush offline queue when back online ───────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-prestarts") {
    event.waitUntil(flushOfflineQueue());
  }
});

async function flushOfflineQueue() {
  // Read queued submissions from IndexedDB via a message to the client
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: "FLUSH_QUEUE" });
  });
}

// ─── Message handler: communicate with app ────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
