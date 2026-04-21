// ── Simdesk - Service Worker ────────────────────────────────
var CACHE_NAME = 'simdesk-v3';
var STATIC_ASSETS = [
  '/',
  '/login',
  '/yonetici',
  '/personel',
  '/style.css',
  '/login.css',
  '/personel.css',
  '/lobi.css',
  '/Assets/sitelogo.png',
  '/Assets/icon-192.png',
  '/Assets/icon-512.png',
  '/manifest.json',
  '/fonts/noto-sans.css',
  '/js/core/pwa-install.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function() {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // API isteklerini cache'leme, network-first
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      // Başarılı response'u cache'e kaydet
      if (response.status === 200) {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});

self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'BIKMAZ GRUP', body: event.data.text() };
  }

  const options = {
    body: data.body || 'Yeni bir bildiriminiz var.',
    icon: '/Assets/sitelogo.png', // Logo yolu doğru olmalı
    badge: '/Assets/sitelogo.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Görüntüle' },
      { action: 'close', title: 'Kapat' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'BIKMAZ GRUP', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});
