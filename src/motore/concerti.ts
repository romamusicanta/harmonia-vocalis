// Concerti: i prossimi dal calendario Google "Concerti" (iCal pubblico, letto in fase di build),
// l'archivio da coro/concerti.ts.
//
// Convenzione per chi inserisce gli eventi nel calendario:
//   Titolo       → nome dell'evento o della rassegna
//   Luogo        → città e sala, separati da virgola: "Bologna, Chiesa di San Giacomo"
//   Descrizione  → prima riga: programma ("W. A. Mozart · Requiem K 626");
//                  righe successive: note (organizzatore, ingresso…)
import ical from 'node-ical';
import { coro } from './coro';
import type { Concerto } from './tipi';
import { archivio as archivioCoro, prossimi as prossimiCoro } from '../../coro/concerti';

let cache: Promise<Concerto[]> | undefined;

export function prossimiConcerti(): Promise<Concerto[]> {
  cache ??= carica().then(filtraFuturi);
  return cache;
}

// L'archivio, dal più recente
export const archivio = [...archivioCoro].sort((a, b) => b.data.localeCompare(a.data));

async function carica(): Promise<Concerto[]> {
  const ics = coro.calendario.ics;
  if (!ics) return prossimiCoro;
  try {
    const dati = await ical.async.fromURL(ics);
    return Object.values(dati)
      .filter((c): c is ical.VEvent => c?.type === 'VEVENT')
      .map((e) => {
        const [programma = '', ...note] = testo(e.description).split('\n').map((r) => r.trim());
        const [autore, opera] = programma.includes('·') ? programma.split('·').map((s) => s.trim()) : [undefined, programma];
        const [luogo, ...sala] = testo(e.location).split(',').map((s) => s.trim());
        const soloGiorno = (e.start as { dateOnly?: boolean }).dateOnly === true;
        return {
          data: soloGiorno ? giornoIso(e.start) : oraRoma(e.start),
          autore,
          titolo: opera || testo(e.summary),
          rassegna: opera ? testo(e.summary) : undefined,
          luogo: luogo || undefined,
          sala: sala.join(', ') || undefined,
          organizza: note.filter(Boolean).join(' · ') || undefined,
        } satisfies Concerto;
      });
  } catch (err) {
    console.warn(`[calendario] non raggiungibile, uso i dati locali: ${err}`);
    return prossimiCoro;
  }
}

function filtraFuturi(elenco: Concerto[]) {
  const oggi = giornoIso(new Date());
  return elenco.filter((c) => c.data.slice(0, 10) >= oggi).sort((a, b) => a.data.localeCompare(b.data));
}

const testo = (v: unknown) => (typeof v === 'string' ? v : ((v as { val?: string })?.val ?? '')).trim();

const fuso = { timeZone: 'Europe/Rome' } as const;
const giornoIso = (d: Date) => new Intl.DateTimeFormat('sv-SE', fuso).format(d);
const oraRoma = (d: Date) => new Intl.DateTimeFormat('sv-SE', { ...fuso, dateStyle: 'short', timeStyle: 'short' }).format(d).replace(' ', 'T');

// ——— Formattazione ———

const conOra = (iso: string) => iso.length > 10;
// Le date sono già in ora di Roma: si formattano come UTC per non spostarle.
const comeData = (iso: string) => new Date(iso.length === 4 ? `${iso}-06-15T12:00:00Z` : conOra(iso) ? `${iso}:00Z` : `${iso}T12:00:00Z`);

export function parti(c: Pick<Concerto, 'data' | 'dataIncerta'>) {
  const d = comeData(c.data);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', ...o }).format(d);
  const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    giornoSettimana: maiuscola(f({ weekday: 'long' })),
    giorno: f({ day: '2-digit' }),
    mese: maiuscola(f({ month: 'long' })),
    meseBreve: maiuscola(f({ month: 'short' }).replace('.', '')),
    anno: f({ year: 'numeric' }),
    ora: conOra(c.data) ? f({ hour: '2-digit', minute: '2-digit' }) : undefined,
    // "Domenica 18 ottobre 2026"
    esteso: maiuscola(f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
    incerta: c.dataIncerta === true,
  };
}

// Stagione concertistica, da settembre ad agosto: "25/26"
export function stagione(c: Pick<Concerto, 'data'>) {
  const anno = Number(c.data.slice(0, 4));
  const mese = c.data.length >= 7 ? Number(c.data.slice(5, 7)) : 9;
  const inizio = mese >= 9 ? anno : anno - 1;
  const due = (n: number) => String(n % 100).padStart(2, '0');
  return { sigla: `${due(inizio)}/${due(inizio + 1)}`, nome: `Stagione ${inizio}/${String(inizio + 1).slice(2)}`, id: `s-${due(inizio)}${due(inizio + 1)}` };
}

// Archivio raggruppato per stagione, dalla più recente
export function perStagione(elenco: Concerto[]) {
  const gruppi = new Map<string, { stagione: ReturnType<typeof stagione>; concerti: Concerto[] }>();
  for (const c of elenco) {
    const s = stagione(c);
    if (!gruppi.has(s.id)) gruppi.set(s.id, { stagione: s, concerti: [] });
    gruppi.get(s.id)!.concerti.push(c);
  }
  return [...gruppi.values()];
}

// Chiave per i filtri per autore: "W. A. Mozart" → "mozart"
export const chiaveAutore = (autore?: string) => (autore ? semplifica(autore.split(/\s+/).at(-1)!) : 'altri');

export const semplifica = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Identificativo per l'indirizzo della scheda: "2026-10-18-requiem-k-626"
export const slug = (c: Concerto) => `${c.data.slice(0, 10)}-${semplifica(c.titolo)}`;

export const luogoCompleto = (c: Concerto) => [c.luogo, c.sala].filter(Boolean).join(' · ');

// Link "Aggiungi a Google Calendar" per il singolo concerto
export function linkGoogleCalendar(c: Concerto) {
  const compatta = (s: string) => s.replace(/[-:]/g, '');
  let date: string;
  if (conOra(c.data)) {
    const inizio = c.data.slice(0, 16);
    const fine = new Date(`${inizio}:00Z`);
    fine.setUTCHours(fine.getUTCHours() + 2);
    date = `${compatta(inizio)}00/${compatta(fine.toISOString().slice(0, 16))}00`;
  } else {
    const dopo = new Date(`${c.data}T12:00:00Z`);
    dopo.setUTCDate(dopo.getUTCDate() + 1);
    date = `${compatta(c.data)}/${compatta(dopo.toISOString().slice(0, 10))}`;
  }
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${[c.autore, c.titolo].filter(Boolean).join(', ')} — ${coro.nome}`,
    dates: date,
    ctz: 'Europe/Rome',
    location: luogoCompleto(c),
    details: [c.rassegna, c.organizza].filter(Boolean).join('\n'),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export const linkMappa = (luogo: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(luogo)}`;

// Iscrizione al calendario Google "Concerti", se configurato
export const linkIscrizioneCalendario = () =>
  coro.calendario.id ? `https://calendar.google.com/calendar/u/0?cid=${encodeURIComponent(coro.calendario.id)}` : undefined;
