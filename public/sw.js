const APP_VERSION = "1.0.8";
const CACHE_PREFIX = "lakshmi-boss";
const LEGACY_CACHE_PREFIXES = ["dbboss"];
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${APP_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}-static-${APP_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${APP_VERSION}`;
const FONT_CACHE = `${CACHE_PREFIX}-fonts-${APP_VERSION}`;

const APP_SHELL_URLS = [
  "/",
  "/manifest.json",
  "/lakshmi-boss-192.png",
  "/lakshmi-boss-512.png",
];

const isHttpGet = (request) =>
  request.method === "GET" && new URL(request.url).protocol.startsWith("http");

const putIfOk = async (cacheName, request, response) => {
  if (!response || !response.ok) return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
};

const cacheFirst = async (request, cacheName) => {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  return putIfOk(cacheName, request, response);
};

const networkFirst = async (request, cacheName) => {
  try {
    const response = await fetch(request);
    return putIfOk(cacheName, request, response);
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === "navigate") {
      const shell = await caches.match("/");
      if (shell) return shell;
    }

    return new Response("Offline", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
};

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  return cached || fresh || networkFirst(request, cacheName);
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.allSettled(
        APP_SHELL_URLS.map((url) =>
          cache.add(url).catch((error) => {
            console.warn(`[PWA] Failed to precache ${url}:`, error);
          }),
        ),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  const currentCaches = new Set([
    SHELL_CACHE,
    STATIC_CACHE,
    API_CACHE,
    FONT_CACHE,
  ]);

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith(CACHE_PREFIX) ||
                  LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) &&
                !currentCaches.has(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isHttpGet(request)) return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.match(/\.(?:css|js|png|jpg|jpeg|svg|webp|ico)$/))
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com"
  ) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
  }
});
