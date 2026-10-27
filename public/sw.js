/* Service worker · Sistema Operativo Solar · Genera Solutions SAS */
const VERSION = "v2";
const STATIC_CACHE = `genera-static-${VERSION}`;
const PAGES_CACHE = `genera-pages-${VERSION}`;
const ASSETS_CACHE = `genera-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const MAX_PAGES = 40;
const MAX_ASSETS = 150;

const PRECACHE = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/brand/logo-genera-mark.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, PAGES_CACHE, ASSETS_CACHE]);
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("genera-") && !keep.has(n))
          .map((n) => caches.delete(n))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "SKIP_WAITING") self.skipWaiting();
  if (type === "CLEAR_PRIVATE") {
    event.waitUntil(caches.delete(PAGES_CACHE));
  }
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

function cacheable(response) {
  return response && response.ok && !response.redirected && response.type === "basic";
}

/** Nunca se cachea: datos, sesión, HMR ni payloads RSC (siempre frescos). */
function bypass(url, request) {
  const p = url.pathname;
  if (p.startsWith("/api/")) return true;
  if (p.startsWith("/login")) return true;
  if (p.startsWith("/_next/webpack-hmr")) return true;
  if (url.searchParams.has("_rsc")) return true;
  if (request.headers.get("RSC") === "1") return true;
  if (request.headers.get("Next-Router-Prefetch")) return true;
  return false;
}

async function networkFirstPage(event) {
  const { request } = event;
  try {
    const preload = await event.preloadResponse;
    const response = preload || (await fetch(request));
    if (cacheable(response)) {
      const copy = response.clone();
      event.waitUntil(
        caches
          .open(PAGES_CACHE)
          .then((cache) => cache.put(request, copy))
          .then(() => trim(PAGES_CACHE, MAX_PAGES))
      );
    }
    return response;
  } catch {
    const cached =
      (await caches.match(request, { cacheName: PAGES_CACHE })) ||
      (await caches.match(request, { cacheName: PAGES_CACHE, ignoreSearch: true }));
    return cached || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(ASSETS_CACHE);
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      if (cacheable(response)) {
        cache.put(request, response.clone()).then(() => trim(ASSETS_CACHE, MAX_ASSETS));
      }
      return response;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (bypass(url, request)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(event));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/image") ||
    /\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|css)$/i.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
