// Valiant push service worker. Place at the SITE ROOT (next to index.html) -> served at /sw.js
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || 'Valiant';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-180.png',
      badge: '/icon-180.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { if (c.navigate) { try { c.navigate(url); } catch (e) {} } return c.focus(); }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
