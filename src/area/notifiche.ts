// Notifiche push ai coristi (dal 5/10/2026). Chi apre l'area coristi o quella del Maestro sul
// telefono, sul tablet o sul computer (su iPhone e iPad solo dall'app installata, con iOS 16.4 o successivo) accende l'interruttore di
// InterruttoreNotifiche.astro: il browser dà un'iscrizione (un indirizzo del servizio push di Google,
// Apple o Mozilla più due chiavi), che il sito salva nella scheda "Notifiche" del foglio "Coristi e
// assenze" (la crea il sito; una riga per dispositivo, chiave l'indirizzo). Redattori, presidente,
// tesoriere e Maestro mandano una notifica con "Notifica" accanto ai pulsanti WhatsApp
// (InvioNotifica.astro): il testo è ricavato dal messaggio WhatsApp e si corregge prima dell'invio.
// Arriva a tutti i dispositivi iscritti di chi è ancora nel gruppo dei coristi o della direzione; le
// iscrizioni che il servizio push dà per scadute (404, 410) si tolgono dal foglio. Le chiavi VAPID
// (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) sono su Vercel: se cambiano, tutte le iscrizioni vanno rifatte.
import webpush, { type PushSubscription } from 'web-push';
import { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY } from 'astro:env/server';
import { coro } from '../motore/coro';
import { adesso, cancellaRiga, idScheda, leggiScheda, scriviRiga } from './dati';
import { nelGruppo, normalizza } from './servizio';
import { spiegaTesto } from './errori';

const SCHEDA = 'Notifiche';
const COLONNE = ['Indirizzo', 'Chiave p256dh', 'Chiave auth', 'Email', 'Area', 'Dispositivo', 'Iscritto il'];

export const configurate = () => Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
export const chiavePubblica = () => VAPID_PUBLIC_KEY ?? '';

export interface Notifica { titolo: string; testo: string; link: string }

interface Iscrizione { riga: number; indirizzo: string; p256dh: string; auth: string; email: string }

async function iscrizioni(): Promise<Iscrizione[]> {
  await idScheda(SCHEDA, COLONNE);
  return (await leggiScheda(SCHEDA))
    .filter((r) => r['Indirizzo'] && r['Chiave p256dh'] && r['Chiave auth'])
    .map((r) => ({ riga: r.riga, indirizzo: r['Indirizzo'], p256dh: r['Chiave p256dh'], auth: r['Chiave auth'], email: r['Email'] }));
}

// Solo chi fa ancora parte del coro o della direzione (i gruppi sono letti al più ogni 5 minuti)
async function destinatari() {
  const { gruppo, direzione } = coro.coristi!;
  const dentro = async (email: string) => (await nelGruppo(email, gruppo).catch(() => false)) || (direzione ? await nelGruppo(email, direzione).catch(() => false) : false);
  const tutte = await iscrizioni();
  const esiti = await Promise.all(tutte.map((i) => (i.email ? dentro(i.email) : false)));
  return tutte.filter((_, k) => esiti[k]);
}

const conteggio = (elenco: Iscrizione[]) => ({ telefoni: elenco.length, persone: new Set(elenco.map((i) => i.email)).size });

const dispositivo = (ua: string) =>
  /iphone/i.test(ua) ? 'iPhone' : /ipad/i.test(ua) ? 'iPad' : /android/i.test(ua) ? 'Android' : /macintosh/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : 'Altro';

// Il testo si scrive come testo (apostrofo iniziale): le chiavi possono cominciare con "-"
const t = (v: string) => `'${v}`;

async function iscrivi(dati: PushSubscription, email: string, area: string, ua: string) {
  if (!/^https:\/\//.test(dati?.endpoint ?? '') || !dati.keys?.p256dh || !dati.keys?.auth) throw new Error('iscrizione non valida');
  const esistente = (await iscrizioni()).find((i) => i.indirizzo === dati.endpoint);
  await scriviRiga(SCHEDA, [t(dati.endpoint), t(dati.keys.p256dh), t(dati.keys.auth), email, area === 'maestro' ? 'maestro' : 'coristi', dispositivo(ua), adesso()], esistente?.riga);
}

async function togli(indirizzo: string) {
  const r = (await iscrizioni()).find((i) => i.indirizzo === indirizzo);
  if (r) await cancellaRiga(SCHEDA, r.riga);
}

async function invia(n: Notifica) {
  if (!configurate()) throw new Error('mancano le chiavi VAPID sul server');
  webpush.setVapidDetails(`mailto:${coro.email}`, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
  const elenco = await destinatari();
  const corpo = JSON.stringify(n);
  const esiti = await Promise.allSettled(elenco.map((i) =>
    webpush.sendNotification({ endpoint: i.indirizzo, keys: { p256dh: i.p256dh, auth: i.auth } }, corpo, { TTL: 24 * 3600, urgency: 'high' })));
  // Le iscrizioni scadute (telefono cambiato, app tolta, notifiche disattivate) si tolgono, dal basso
  // perché i numeri di riga restino validi
  const scadute = elenco.filter((_, k) => { const e = esiti[k]; return e.status === 'rejected' && [404, 410].includes((e.reason as { statusCode?: number }).statusCode ?? 0); });
  for (const i of [...scadute].sort((a, b) => b.riga - a.riga)) await cancellaRiga(SCHEDA, i.riga).catch(() => {});
  const arrivate = elenco.filter((_, k) => esiti[k].status === 'fulfilled');
  const altri = esiti.filter((e) => e.status === 'rejected').length - scadute.length;
  if (altri) console.warn(`[notifiche] ${altri} invii non riusciti`, esiti.filter((e) => e.status === 'rejected').map((e) => String((e as PromiseRejectedResult).reason?.statusCode ?? (e as PromiseRejectedResult).reason)).join(', '));
  return { ...conteggio(arrivate), nonArrivate: altri };
}

// Notifiche personali (il sollecito delle quote, src/area/tesoreria.ts): a ogni persona la sua, sui
// dispositivi iscritti con uno dei suoi indirizzi. Restituisce quante persone ne hanno almeno uno
// iscritto e a quante è arrivata; con prova = true non manda niente (per contare prima dell'invio)
export async function inviaPersonali(messaggi: { indirizzi: string[]; notifica: Notifica }[], prova = false) {
  const tutte = await iscrizioni();
  const conIscrizioni = messaggi.map((m) => ({ ...m, suoi: tutte.filter((i) => i.email && m.indirizzi.includes(normalizza(i.email))) })).filter((m) => m.suoi.length);
  if (prova) return { conNotifiche: conIscrizioni.length, raggiunte: 0 };
  if (!configurate()) throw new Error('mancano le chiavi VAPID sul server');
  webpush.setVapidDetails(`mailto:${coro.email}`, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
  let raggiunte = 0;
  const scadute: Iscrizione[] = [];
  await Promise.all(conIscrizioni.map(async (m) => {
    const esiti = await Promise.allSettled(m.suoi.map((i) => webpush.sendNotification({ endpoint: i.indirizzo, keys: { p256dh: i.p256dh, auth: i.auth } }, JSON.stringify(m.notifica), { TTL: 24 * 3600, urgency: 'normal' })));
    if (esiti.some((e) => e.status === 'fulfilled')) raggiunte++;
    esiti.forEach((e, k) => { if (e.status === 'rejected' && [404, 410].includes((e.reason as { statusCode?: number }).statusCode ?? 0)) scadute.push(m.suoi[k]); });
  }));
  for (const i of [...new Set(scadute)].sort((a, b) => b.riga - a.riga)) await cancellaRiga(SCHEDA, i.riga).catch(() => {});
  return { conNotifiche: conIscrizioni.length, raggiunte };
}

// La notifica ricavata da un messaggio WhatsApp del sito (bacheca.ts, prove.ts, convocazioni.ts,
// registrazioni.ts): titolo = prima riga, testo = il resto senza gli indirizzi web,
// link = l'ultimo indirizzo del sito (l'ultimo paragrafo, che ha solo il link, si toglie)
export function daWhatsapp(messaggio: string, sito: string): Notifica {
  const url = /https?:\/\/\S+/g;
  const paragrafi = messaggio.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const ultimo = [...messaggio.matchAll(url)].map((m) => m[0]).filter((u) => u.startsWith(sito)).at(-1);
  const [prima = '', ...resto] = (paragrafi[0] ?? '').split('\n');
  const corpo = [resto.join('\n'), ...paragrafi.slice(1, /https?:\/\//.test(paragrafi.at(-1) ?? '') && paragrafi.length > 1 ? -1 : undefined)];
  const righe = corpo.join('\n').split('\n').map((r) => r.replace(url, '').replace(/[\s:]+$/, '').trim()).filter(Boolean);
  const testo = righe.join('\n').replace(/\*/g, '');
  return {
    titolo: prima.replace(/\*/g, '').trim().slice(0, 120),
    testo: testo.length > 300 ? `${testo.slice(0, 297)}…` : testo,
    link: ultimo ? ultimo.slice(sito.length) || '/area' : '/area',
  };
}

// Risposta alle richieste JSON delle pagine: iscrivi e togli da chi è nell'area coristi o del
// Maestro (/area/notifiche), quanti e invia solo da chi può mandare notifiche (Amministrazione, area del Maestro)
export async function rispondi(request: Request, email: string, puoInviare: boolean) {
  const json = (dati: object, status = 200) => new Response(JSON.stringify(dati), { status, headers: { 'Content-Type': 'application/json' } });
  try {
    const d = await request.json();
    switch (d.azione) {
      case 'iscrivi':
        await iscrivi(d.iscrizione, email, String(d.area ?? ''), request.headers.get('user-agent') ?? '');
        return json({ ok: true });
      case 'togli':
        await togli(String(d.indirizzo ?? ''));
        return json({ ok: true });
      case 'quanti':
        if (!puoInviare) return json({ errore: 'Non puoi mandare notifiche.' }, 403);
        return json(conteggio(await destinatari()));
      case 'invia': {
        if (!puoInviare) return json({ errore: 'Non puoi mandare notifiche.' }, 403);
        const titolo = String(d.titolo ?? '').trim().slice(0, 120);
        const testo = String(d.testo ?? '').trim().slice(0, 600);
        const link = String(d.link ?? '/area');
        if (!titolo) return json({ errore: 'Manca il titolo.' }, 400);
        console.log(`[notifiche] ${email}: «${titolo}»`);
        return json(await invia({ titolo, testo, link: link.startsWith('/') ? link : '/area' }));
      }
      default:
        return json({ errore: 'Azione sconosciuta.' }, 400);
    }
  } catch (e) {
    return json({ errore: spiegaTesto(e) }, 500);
  }
}
