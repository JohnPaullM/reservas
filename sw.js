/* Service worker: deixa o app instalável, abre rápido e recebe os alertas */
const CACHE = 'reservas-v2';
const ARQUIVOS = [
  './', './index.html', './style.css', './app.js', './config.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/badge-72.png'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Sempre tenta buscar a versão mais nova; sem internet, usa a cópia guardada
self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then((r) => r || caches.match('./index.html'))
      )
  );
});

// Chegou um alerta
self.addEventListener('push', (ev) => {
  let dados = {};
  try { dados = ev.data ? ev.data.json() : {}; } catch (e) { dados = { body: ev.data ? ev.data.text() : '' }; }
  const titulo = dados.title || 'Reservas';
  ev.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/badge-72.png',
      tag: dados.tag || 'reservas',
      renotify: true,
      data: { url: dados.url || './' }
    })
  );
});

// Tocou no alerta: abre o app no dia certo
self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  const destino = new URL((ev.notification.data && ev.notification.data.url) || './', self.registration.scope).href;
  ev.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (j.url.startsWith(self.registration.scope) && 'focus' in j) {
          return j.focus().then((f) => (f && 'navigate' in f ? f.navigate(destino) : f));
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
