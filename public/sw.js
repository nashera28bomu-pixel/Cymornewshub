// Cymor News Hub service worker.
// Kept intentionally minimal: no offline caching gimmicks, just push handling
// so notifications work even when the tab/app isn't open.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Cymor News Hub', body: 'New headline available.', url: '/app.html' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (err) {
    // ignore malformed payloads, fall back to defaults
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'cymor-news',
    data: { url: payload.url || '/app.html' }
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/app.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/app.html') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
