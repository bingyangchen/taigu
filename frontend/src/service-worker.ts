/// <reference lib="webworker" />
// Workbox Docs: https://developers.google.com/web/tools/workbox/modules

import { clientsClaim, type WorkboxPlugin } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

import { PRERENDERED_PATHS } from "./publicPages";
import {
  API_CACHE_FALLBACK_HEADER,
  API_CACHE_NAME,
  API_CACHE_PATHS,
  LEGACY_API_CACHE_NAMES,
} from "./utils/cache";

declare const self: ServiceWorkerGlobalScope;

const VERSION = "2026.11.27.01";
console.log(`Service worker version: ${VERSION}`);

clientsClaim();

// The build injects the URLs of its output into this manifest variable.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Set up App Shell-style routing, so that all navigation requests
// are fulfilled with your index.html shell. Learn more at
// https://developers.google.com/web/fundamentals/architecture/app-shell
const fileExtensionRegexp = new RegExp("/[^/?]+\\.[^/]+$");
// These routes have prerendered HTML files with their own metadata, so they
// must reach the network instead of being fulfilled by the app shell.
const prerenderedPaths = new Set<string>(PRERENDERED_PATHS);
registerRoute(
  // Return false to exempt requests from being fulfilled by index.html.
  ({ request, url }) => {
    const isNavigate = request.mode === "navigate";
    const isApiRoute = url.pathname.startsWith("/_");
    const isAsset = fileExtensionRegexp.test(url.pathname);
    const isPrerendered = prerenderedPaths.has(url.pathname);
    return isNavigate && !isApiRoute && !isAsset && !isPrerendered;
  },
  createHandlerBoundToURL("/index.html"),
);

// Videos are not cached (see the service worker section of docs/specs/architecture.md):
// Safari fetches a video in byte ranges, which Workbox's cached responses do not
// answer by default.
const IMAGE_CACHE_NAME = "images";
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    (url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".jpg") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".webp")),
  new StaleWhileRevalidate({
    cacheName: IMAGE_CACHE_NAME,
    plugins: [
      // Ensure that once this runtime cache reaches a maximum size the LRU images are removed.
      new ExpirationPlugin({ maxEntries: 50 }),
    ],
  }),
);

const getApiPath = (url: URL): string => url.pathname.replace(/^\/api\/?/, "");
let accountCacheVersion = 0;

self.addEventListener("message", (event) => {
  if (event.data?.type === "CHECK_ACCOUNT_CACHE") {
    event.ports[0]?.postMessage("isolated");
  }
  if (event.data?.type === "CLEAR_ACCOUNT_DATA") {
    accountCacheVersion += 1;
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        await Promise.all(
          clients.map(async (client) => {
            if (event.source && "id" in event.source && client.id === event.source.id)
              return;
            await client.navigate("/login");
          }),
        );
        await caches.delete(API_CACHE_NAME);
        event.ports[0]?.postMessage("cleared");
      })(),
    );
  }
});
const apiCacheIsolation: WorkboxPlugin = {
  handlerWillStart: async ({ state }) => {
    if (state) state.accountCacheVersion = accountCacheVersion;
  },
  cacheWillUpdate: async ({ response, state }) => {
    return response.status < 400 && state?.accountCacheVersion === accountCacheVersion
      ? response
      : null;
  },
  cacheDidUpdate: async ({ cacheName, request, state }) => {
    if (state?.accountCacheVersion !== accountCacheVersion) {
      const cache = await caches.open(cacheName);
      await cache.delete(request);
    }
  },
};

const marketIndexApiPaths = new Set([
  "market/market-index",
  "market/market-index-historical-prices",
]);

// The index UI distinguishes a failed refresh from a pending network response.
registerRoute(
  ({ url }) => marketIndexApiPaths.has(getApiPath(url)),
  new NetworkFirst({
    cacheName: API_CACHE_NAME,
    plugins: [
      apiCacheIsolation,
      {
        cachedResponseWillBeUsed: async ({ cachedResponse }) => {
          if (!cachedResponse) return cachedResponse;
          const headers = new Headers(cachedResponse.headers);
          headers.set(API_CACHE_FALLBACK_HEADER, "1");
          return new Response(cachedResponse.body, {
            status: cachedResponse.status,
            statusText: cachedResponse.statusText,
            headers,
          });
        },
      },
    ],
  }),
);

registerRoute(
  ({ url }) => API_CACHE_PATHS.has(getApiPath(url)),
  new NetworkFirst({
    cacheName: API_CACHE_NAME,
    networkTimeoutSeconds: 3,
    plugins: [apiCacheIsolation],
  }),
);

self.addEventListener("install", () => {
  self.skipWaiting();
});

// Old workers can finish requests after activation, so new code never reads these caches.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      ...LEGACY_API_CACHE_NAMES.map((name) => caches.delete(name)),
      deleteCachedVideos(),
    ]),
  );
});

// Workers before 2026.11.27.01 also cached videos with the images, which nothing
// reads any more.
async function deleteCachedVideos(): Promise<void> {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const requests = await cache.keys();
  await Promise.all(
    requests
      .filter((request) => new URL(request.url).pathname.endsWith(".mp4"))
      .map((request) => cache.delete(request)),
  );
}
