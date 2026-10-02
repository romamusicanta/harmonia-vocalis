// Service worker del sito (PWA), registrato da src/componenti/TestaApp.astro.
// - Pagine pubbliche: prima la rete (il sito si ricostruisce ogni notte), la copia salvata se si è
//   senza connessione, altrimenti la pagina offline.
// - File di /_astro (nomi con l'impronta, non cambiano mai) e caratteri di Google: dalla copia salvata.
// - Aree riservate (/admin, /area, /maestro): mai salvate, sono dati personali e il telefono può
//   essere di altri; senza connessione, la pagina offline.
// Cambiare VERSIONE per svuotare le copie salvate.
const VERSIONE = 'hv-1';
const OFFLINE = '/offline.html';
const PRIMA = [OFFLINE, '/favicon.svg', '/icone/icona-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(PRIMA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomi) => Promise.all(nomi.filter((n) => n !== VERSIONE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

const riservata = (p) => /^\/(admin|area|maestro)(\/|$)/.test(p);
// Le pagine si salvano senza barra finale: /concerti e /concerti/ sono la stessa copia
const chiave = (indirizzo) => {
  const u = new URL(indirizzo);
  if (u.origin === self.location.origin && u.pathname.length > 1) u.pathname = u.pathname.replace(/\/$/, '');
  return u.href;
};
const salva = (req, risposta) => {
  if (risposta.ok || risposta.type === 'opaque') {
    const copia = risposta.clone();
    caches.open(VERSIONE).then((c) => c.put(chiave(risposta.url || req.url), copia));
  }
  return risposta;
};
const salvata = (req) => caches.match(chiave(req.url));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const nostro = url.origin === self.location.origin;

  if (nostro && riservata(url.pathname)) {
    if (req.mode === 'navigate') e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  if ((nostro && url.pathname.startsWith('/_astro/')) || /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(salvata(req).then((c) => c || fetch(req).then((r) => salva(req, r))));
    return;
  }
  if (!nostro) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => salva(req, r))
        .catch(() => salvata(req).then((c) => c || caches.match(OFFLINE))),
    );
    return;
  }
  e.respondWith(fetch(req).then((r) => salva(req, r)).catch(() => salvata(req).then((c) => c || Response.error())));
});
