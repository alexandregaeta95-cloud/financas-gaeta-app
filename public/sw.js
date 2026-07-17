// Service Worker to handle background/minimized notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(
      self.registration.showNotification(event.data.title, {
        body: event.data.body,
        icon: event.data.icon,
        tag: event.data.tag || 'risk-zone-alert',
        renotify: event.data.renotify !== false,
        requireInteraction: event.data.requireInteraction !== false,
        vibrate: event.data.vibrate || [500, 110, 500, 110, 450, 110, 200, 110, 170, 40],
        silent: false
      })
    );
  }
});
