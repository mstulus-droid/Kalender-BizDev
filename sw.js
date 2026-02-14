const CACHE_NAME = 'bizdev-cal-v4-webp';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './tailwind-output.css', // <--- FILE BARU (Wajib ada)
    './main.js',
    './calendar-data.js',
    './icons/icon_192.webp',
    './icons/icon_512.webp',
    // Link Tailwind CDN sudah DIHAPUS dari sini
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Paksa SW baru untuk segera aktif
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    // Hapus cache lama (v2, dll) agar memori HP tidak penuh
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Menghapus cache lama:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});