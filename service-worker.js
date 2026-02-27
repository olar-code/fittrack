const CACHE_NAME = "fittracker-v1";

const urlsToCache = [
  "/fittrack/",
  "/fittrack/index.html",
  "/fittrack/style.css",
  "/fittrack/app.js",
  "/fittrack/manifest.json",
  "/fittrack/icon-192.png",
  "/fittrack/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});