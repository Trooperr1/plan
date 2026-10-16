/* Service worker: offline support + notification clicks. Bump VERSION when files change. */
const VERSION = 'planner-v4';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/utils.js',
  'js/i18n.js',
  'js/lang-ckb.js',
  'js/icons.js',
  'js/store.js',
  'js/schedule.js',
  'js/ui.js',
  'js/components.js',
  'js/forms.js',
  'js/reminders.js',
  'js/ics.js',
  'js/safety.js',
  'js/views/today.js',
  'js/views/calendar.js',
  'js/views/tasks.js',
  'js/views/habits.js',
  'js/views/goals.js',
  'js/views/settings.js',
  'js/views/review.js',
  'js/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates show up), falling back to the cache when offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c);
      if (open) return open.focus();
      return self.clients.openWindow('./index.html#/today');
    })
  );
});
