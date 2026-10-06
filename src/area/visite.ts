// Statistiche delle visite al sito pubblico, contate in casa e senza cookie (dal 6/10/2026).
// Ogni pagina pubblica, all'apertura, avvisa /api/visita (script in src/layouts/Base.astro). Il
// visitatore è un'impronta anonima: 8 caratteri di un HMAC di indirizzo IP e browser con una chiave
// che cambia ogni giorno (ricavata da SESSIONE_SEGRETO e dalla data). L'IP non si salva; la stessa
// persona conta una volta al giorno e il giorno dopo non è più riconoscibile; 8 caratteri non
// bastano a risalire a un indirizzo (troppi indirizzi danno la stessa impronta).
// Dati nel foglio "Coristi e assenze", con l'account di servizio:
// - scheda "Visite": una riga per pagina vista, tenuta 13 mesi;
// - scheda "Visite per giorno": i totali di ogni giorno finito, tenuti per sempre, scritti ogni
//   notte da /api/statistiche (cron di vercel.json), che cancella anche le righe più vecchie.
// La pagina Amministrazione → Statistiche legge i totali e, per oggi (e per i giorni che il cron
// non ha ancora riassunto), le righe di "Visite" da "Riga successiva" dell'ultimo totale in poi.
import { createHmac } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { FOGLIO_CORISTI_ID, SESSIONE_SEGRETO } from 'astro:env/server';
import { google } from './servizio';
import { idScheda, leggiScheda, oggi, piuGiorni } from './dati';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const VISITE = 'Visite';
const GIORNI = 'Visite per giorno';
const INTESTAZIONI = ['Giorno', 'Ora', 'Visitatore', 'Pagina', 'Titolo', 'Lingua', 'Provenienza', 'Dispositivo'];
const INTESTAZIONI_GIORNI = ['Giorno', 'Visitatori', 'Visualizzazioni', 'Pagine', 'Provenienze', 'Lingue', 'Dispositivi', 'Riga successiva'];
// Le righe delle singole visite si tengono 13 mesi
const CONSERVAZIONE = 396;

export const configurato = () => Boolean(FOGLIO_CORISTI_ID && SESSIONE_SEGRETO);

// ——— Registrazione ———

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|facebookexternalhit|whatsapp|telegram|curl|wget|python|node-fetch|axios|go-http/i;
export const eUnBot = (ua: string) => !ua || BOT.test(ua);

export const dispositivoDi = (ua: string) => (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'Tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'Telefono' : 'Computer');

// Da dove arriva chi apre la pagina: il nome dei siti più comuni, altrimenti l'indirizzo del sito;
// vuoto se arriva da un'altra pagina del sito o non si sa (link diretto, app, segnalibro)
export function provenienzaDi(referrer: string, sorgente: string, sito: string) {
  if (sorgente) return sorgente.slice(0, 40);
  if (!referrer) return '';
  if (/whatsapp/i.test(referrer)) return 'WhatsApp';
  let host: string;
  try { host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
  if (!host || host === sito.replace(/^www\./, '')) return '';
  const noti: [RegExp, string][] = [
    [/(^|\.)google\./, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/duckduckgo|ecosia|yahoo|qwant|brave\.com/, 'Altri motori di ricerca'],
    [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'], [/instagram\.com$/, 'Instagram'], [/youtube\.com$|youtu\.be$/, 'YouTube'],
    [/^t\.me$|telegram/, 'Telegram'], [/^t\.co$|(^|\.)x\.com$|twitter\.com$/, 'X (Twitter)'], [/linkedin\.com$|lnkd\.in$/, 'LinkedIn'],
    [/mail\.|outlook\.|gmail/, 'Email'], [/harmoniavocalis\.com$|vercel\.app$/, ''],
  ];
  const n = noti.find(([r]) => r.test(host));
  return n ? n[1] : host;
}

// L'impronta del visitatore di oggi
export const impronta = (ip: string, ua: string, giorno: string) => createHmac('sha256', `${SESSIONE_SEGRETO}|visite|${giorno}`).update(`${ip}|${ua}`).digest('hex').slice(0, 8);

// Le visite arrivate insieme si scrivono con una sola richiesta, poco dopo: Google accetta al più
// 60 scritture al minuto, e quando un concerto gira su WhatsApp le visite arrivano a decine
let coda: (string | number)[][] = [];
let invio: Promise<void> | undefined;

async function aggiungi(righe: (string | number)[][]) {
  await idScheda(VISITE, INTESTAZIONI);
  const url = `${SHEETS}/${FOGLIO_CORISTI_ID}/values/${encodeURIComponent(`${VISITE}!A:H`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  for (let tentativo = 0; ; tentativo++) {
    try {
      await google(url, { method: 'POST', body: JSON.stringify({ values: righe }) });
      return;
    } catch (e) {
      if (tentativo >= 2 || !/\((429|5\d\d)\)/.test((e as Error).message)) throw e;
      await new Promise((r) => setTimeout(r, 3000 * (tentativo + 1)));
    }
  }
}

export function registra(riga: (string | number)[]) {
  coda.push(riga);
  if (!invio) {
    invio = (async () => {
      await new Promise((r) => setTimeout(r, 1500));
      const righe = coda;
      coda = [];
      invio = undefined;
      try {
        await aggiungi(righe);
      } catch (e) {
        console.error(`[visite] ${righe.length} visite non registrate: ${(e as Error).message}`);
      }
    })();
  }
  const attesa = invio!;
  waitUntil(attesa);
  return attesa;
}

// ——— Totali di un giorno ———

export interface Giorno {
  giorno: string;
  visitatori: number;
  visualizzazioni: number;
  pagine: Record<string, { n: number; t: string }>;
  provenienze: Record<string, number>;
  lingue: Record<string, number>;
  dispositivi: Record<string, number>;
}

type Riga = Record<string, string>;
const conta = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

// Pagine: visualizzazioni; provenienza, lingua e dispositivo: una volta per visitatore (la prima
// provenienza esterna, la lingua e il dispositivo della prima pagina vista)
export function riassumi(giorno: string, righe: Riga[]): Giorno {
  const g: Giorno = { giorno, visitatori: 0, visualizzazioni: righe.length, pagine: {}, provenienze: {}, lingue: {}, dispositivi: {} };
  const visitatori = new Map<string, Riga[]>();
  for (const r of righe) {
    const p = (g.pagine[r.Pagina] ??= { n: 0, t: r.Titolo });
    p.n++;
    if (r.Titolo) p.t = r.Titolo;
    visitatori.set(r.Visitatore, [...(visitatori.get(r.Visitatore) ?? []), r]);
  }
  g.visitatori = visitatori.size;
  for (const viste of visitatori.values()) {
    conta(g.provenienze, viste.find((v) => v.Provenienza)?.Provenienza || 'Link diretto o app');
    conta(g.lingue, viste[0].Lingua === 'en' ? 'Inglese' : 'Italiano');
    conta(g.dispositivi, viste[0].Dispositivo || 'Computer');
  }
  return g;
}

const perGiorno = (righe: Riga[]) => {
  const m = new Map<string, Riga[]>();
  for (const r of righe) if (/^\d{4}-\d{2}-\d{2}$/.test(r.Giorno)) m.set(r.Giorno, [...(m.get(r.Giorno) ?? []), r]);
  return m;
};

const json = (v: string) => { try { return JSON.parse(v || '{}'); } catch { return {}; } };
const daFoglio = (r: Riga): Giorno => ({
  giorno: r.Giorno, visitatori: Number(r.Visitatori) || 0, visualizzazioni: Number(r.Visualizzazioni) || 0,
  pagine: json(r.Pagine), provenienze: json(r.Provenienze), lingue: json(r.Lingue), dispositivi: json(r.Dispositivi),
});

// ——— Riepilogo notturno (/api/statistiche) ———

// Riassume i giorni finiti non ancora riassunti e cancella le visite più vecchie di 13 mesi
export async function riepilogoNotturno() {
  await idScheda(VISITE, INTESTAZIONI);
  await idScheda(GIORNI, INTESTAZIONI_GIORNI);
  const [righe, fatti] = await Promise.all([leggiScheda(VISITE), leggiScheda(GIORNI)]);
  const giaFatti = new Set(fatti.map((r) => r.Giorno));
  const oggiRoma = oggi();
  // Le righe sono in ordine di arrivo: quelle troppo vecchie stanno tutte in cima
  const limite = piuGiorni(oggiRoma, -CONSERVAZIONE);
  let vecchie = 0;
  while (vecchie < righe.length && righe[vecchie].Giorno < limite) vecchie++;
  const restano = righe.slice(vecchie);
  const primaDiOggi = restano.findIndex((r) => r.Giorno >= oggiRoma);
  const rigaSuccessiva = (primaDiOggi === -1 ? restano.length : primaDiOggi) + 2;
  const nuovi = [...perGiorno(righe)].filter(([g]) => g < oggiRoma && !giaFatti.has(g)).sort(([a], [b]) => a.localeCompare(b)).map(([g, r]) => riassumi(g, r));
  if (nuovi.length) {
    const valori = nuovi.map((g) => [g.giorno, g.visitatori, g.visualizzazioni, JSON.stringify(g.pagine), JSON.stringify(g.provenienze), JSON.stringify(g.lingue), JSON.stringify(g.dispositivi), rigaSuccessiva]);
    await google(`${SHEETS}/${FOGLIO_CORISTI_ID}/values/${encodeURIComponent(`${GIORNI}!A:H`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: valori }) });
  }
  if (vecchie) {
    await google(`${SHEETS}/${FOGLIO_CORISTI_ID}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: await idScheda(VISITE), dimension: 'ROWS', startIndex: 1, endIndex: 1 + vecchie } } }] }),
    });
  }
  return { riassunti: nuovi.length, cancellate: vecchie };
}

// ——— Lettura per la pagina Statistiche ———

// I totali di ogni giorno dal primo indicato a oggi (compreso, con i dati finora)
export async function statistiche(da: string): Promise<Giorno[]> {
  await idScheda(VISITE, INTESTAZIONI);
  await idScheda(GIORNI, INTESTAZIONI_GIORNI);
  const fatti = (await leggiScheda(GIORNI)).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.Giorno));
  const ultimo = fatti.reduce<Riga | undefined>((u, r) => (!u || r.Giorno > u.Giorno ? r : u), undefined);
  const dalla = Math.max(2, Number(ultimo?.['Riga successiva']) || 2);
  const p = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE' });
  const { values = [] } = await google<{ values?: string[][] }>(`${SHEETS}/${FOGLIO_CORISTI_ID}/values/${encodeURIComponent(`${VISITE}!A${dalla}:H`)}?${p}`);
  const recenti = values.map((v) => Object.fromEntries(INTESTAZIONI.map((t, j) => [t, (v[j] ?? '').trim()])) as Riga);
  const giaFatti = new Set(fatti.map((r) => r.Giorno));
  const vivi = [...perGiorno(recenti)].filter(([g]) => !giaFatti.has(g)).map(([g, r]) => riassumi(g, r));
  const tutti = new Map([...fatti.map(daFoglio), ...vivi].map((g) => [g.giorno, g]));
  const giorni: Giorno[] = [];
  for (let g = da, fine = oggi(); g <= fine; g = piuGiorni(g, 1)) giorni.push(tutti.get(g) ?? { giorno: g, visitatori: 0, visualizzazioni: 0, pagine: {}, provenienze: {}, lingue: {}, dispositivi: {} });
  return giorni;
}

// Somma i conteggi di più giorni, dal più alto
export function somma(giorni: Giorno[], campo: 'provenienze' | 'lingue' | 'dispositivi') {
  const t: Record<string, number> = {};
  for (const g of giorni) for (const [k, n] of Object.entries(g[campo])) t[k] = (t[k] ?? 0) + n;
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
}

// Le pagine più viste: italiano e inglese della stessa pagina restano separate (si vede la lingua)
export function pagine(giorni: Giorno[]) {
  const t: Record<string, { n: number; t: string }> = {};
  for (const g of giorni) for (const [k, p] of Object.entries(g.pagine)) {
    const x = (t[k] ??= { n: 0, t: p.t });
    x.n += p.n;
    if (p.t) x.t = p.t;
  }
  return Object.entries(t).map(([pagina, p]) => ({ pagina, ...p })).sort((a, b) => b.n - a.n);
}
