var APP_VERSION = 'v47';
var CACHE_NAME = 'exophoto-v47';

var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './js/version.js',
  './js/router.js',
  './js/settings.js',
  './js/provider-keys.js',
  './js/db.js',
  './js/image-utils.js',
  './js/mistral-ocr-client.js',
  './js/scan-store.js',
  './js/exercise-store.js',
  './js/ai-coach-client.js',
  './js/voice-input.js',
  './js/components.js',
  './js/exercise-splitter.js',
  './js/views/home.js',
  './js/views/capture.js',
  './js/views/library.js',
  './js/views/exercise.js',
  './js/views/coach.js',
  './js/views/courses.js',
  './js/views/settings.js',
  './js/app.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE_NAME;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  var url = new URL(event.request.url);
  var isShell = event.request.mode === 'navigate' || /\.(html|js|css|json|svg)$/.test(url.pathname);

  if (isShell) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(function (response) {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, response.clone());
          });
        }
        return response;
      }).catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, response.clone());
          });
        }
        return response;
      });
    })
  );
});