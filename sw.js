/* Wine Alchemist CRM · service worker
   Online: tutto dalla rete (dati sempre freschi) e copia in cache.
   Offline o rete lentissima: l'ultima copia salvata (consultazione). */
const VER = 'wa-crm-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.png', './icon-192.png', './apple-touch-icon.png'];
const TIMEOUT = 7000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER && k !== VER + '-tiles' && k !== VER + '-foto').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function hashBody(req) {
  const buf = await req.clone().arrayBuffer();
  const h = await crypto.subtle.digest('SHA-1', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const chiave = (u, k, v) => u + (u.includes('?') ? '&' : '?') + k + '=' + encodeURIComponent(v);
function withTimeout(p, ms) {
  return new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('timeout')), ms); p.then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); ko(e); }); });
}
async function networkFirst(req, key) {
  const cache = await caches.open(VER);
  try {
    const res = await withTimeout(fetch(req), TIMEOUT);
    if (res && res.ok) cache.put(key, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(key, { ignoreVary: true });
    if (hit) return hit;
    throw err;
  }
}
async function tiles(req, nome = '-tiles') {
  const cache = await caches.open(VER + nome);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (url.pathname.includes('/auth/v1/') || url.pathname.includes('/functions/v1/')) return;   // login e invii: mai dalla cache
  if (url.hostname.endsWith('tile.openstreetmap.org')) { e.respondWith(tiles(req)); return; }
  if ((url.origin === location.origin && url.pathname.includes('/foto/')) || url.pathname.includes('/storage/v1/object/public/vini/')) { e.respondWith(tiles(req, '-foto')); return; }   // foto immutabili
  const dati = url.pathname.includes('/rest/v1/');
  if (req.method === 'GET' && (url.origin === location.origin || dati ||
      url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net')) {
    // l'utente cambia solo con un nuovo login: la chiave include l'URL completo
    e.respondWith(networkFirst(req, chiave(req.url, '__a', req.headers.get('accept') || '')));
    return;
  }
  if (req.method === 'POST' && url.pathname.includes('/rest/v1/rpc/')) {   // letture via funzioni (giacenze, analisi…)
    e.respondWith((async () => {
      const key = chiave(req.url, '__b', await hashBody(req));
      return networkFirst(req, key);
    })());
  }
});
