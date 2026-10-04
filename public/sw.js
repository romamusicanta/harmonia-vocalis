// Service worker del sito (PWA), registrato da src/componenti/TestaApp.astro.
// - Pagine pubbliche: prima la rete (il sito si ricostruisce ogni notte), la copia salvata se si è
//   senza connessione, altrimenti la pagina offline.
// - File di /_astro (nomi con l'impronta, non cambiano mai) e caratteri di Google: dalla copia salvata.
// - Aree riservate (/admin, /area, /maestro): mai salvate, sono dati personali e il telefono può
//   essere di altri; senza connessione, la pagina offline.
// Più sotto, le notifiche push.
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

// Notifiche push ai coristi (src/area/notifiche.ts): titolo, testo e la pagina da aprire al tocco
self.addEventListener('push', (e) => {
  let n = {};
  try { n = e.data ? e.data.json() : {}; } catch { n = { testo: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(n.titolo || 'Harmonia Vocalis', {
    body: n.testo || '',
    icon: '/icone/icona-coristi-192.png',
    data: { link: n.link || '/area' },
    tag: n.link || undefined,
  }));
});

// Al tocco: la pagina, in una finestra del sito già aperta se c'è
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.link || '/area', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((finestre) => {
      const aperta = finestre.find((f) => new URL(f.url).origin === self.location.origin && 'navigate' in f);
      return aperta ? aperta.focus().then((f) => f.navigate(url)).catch(() => self.clients.openWindow(url)) : self.clients.openWindow(url);
    }),
  );
});

// Il servizio push ha rinnovato l'iscrizione: si salva quella nuova
self.addEventListener('pushsubscriptionchange', (e) => {
  const chiave = e.oldSubscription?.options?.applicationServerKey;
  if (!chiave) return;
  e.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiave }).then((nuova) =>
      fetch('/area/notifiche', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione: 'iscrivi', iscrizione: nuova.toJSON() }) }).then(() =>
        e.oldSubscription && fetch('/area/notifiche', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione: 'togli', indirizzo: e.oldSubscription.endpoint }) }))),
  );
});
