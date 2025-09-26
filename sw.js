const CACHE_NAME = 'weather-app-v1.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/icons/icon-16x16.png',
    '/icons/icon-32x32.png',
    '/icons/icon-64x64.png',
    '/icons/icon-128x128.png',
    '/icons/icon-256x256.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            }
        )
    );
});