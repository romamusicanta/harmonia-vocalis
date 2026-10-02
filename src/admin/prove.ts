// Prove nell'area Amministrazione: lettura, creazione, modifica e cancellazione degli eventi del
// calendario privato "Prove", a nome di chi è entrato (redattori@ ha "Apportare modifiche agli
// eventi"). Convenzione degli eventi, la stessa che legge l'area coristi (src/area/dati.ts):
// titolo = tipo di prova; luogo vuoto = sala abituale; descrizione con righe "Sezioni:",
// "Brani:", "Portare:", "Note:". La prova settimanale è un evento ricorrente: qui si modifica o si
// cancella una data alla volta (le altre restano come sono).
import { CALENDARIO_PROVE_ID } from 'astro:env/server';
import { coro } from '../motore/coro';
import { api } from './google';
import type { Sessione } from './sessione';

const CAL = 'https://www.googleapis.com/calendar/v3';
const FUSO = 'Europe/Rome';
const url = (resto = '') => `${CAL}/calendars/${encodeURIComponent(CALENDARIO_PROVE_ID!)}/events${resto}`;

export const RIGHE = ['Sezioni', 'Brani', 'Portare', 'Note'] as const;
export const salaAbituale = () => `${coro.prove.nome}, ${coro.prove.indirizzo}, ${coro.prove.cap} ${coro.prove.citta}`;

export interface Prova {
  id: string;
  ricorrente: boolean;   // una data della prova settimanale
  htmlLink: string;
  data: string;          // AAAA-MM-GG
  inizio: string;        // HH:MM
  fine: string;
  titolo: string;
  luogo: string;         // vuoto = sala abituale
  righe: Record<(typeof RIGHE)[number], string>;
  altro: string;         // righe della descrizione senza etichetta conosciuta, conservate
}

interface EventoApi {
  id: string;
  status: string;
  summary?: string;
  location?: string;
  description?: string;
  htmlLink: string;
  recurringEventId?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

const giorno = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const ora = new Intl.DateTimeFormat('it-IT', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });

function prova(e: EventoApi): Prova {
  const inizio = e.start.dateTime ? new Date(e.start.dateTime) : undefined;
  const fine = e.end.dateTime ? new Date(e.end.dateTime) : undefined;
  const righe = Object.fromEntries(RIGHE.map((r) => [r, ''])) as Prova['righe'];
  const altro: string[] = [];
  for (const riga of (e.description ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').split('\n')) {
    const m = riga.match(/^\s*([^:]+):\s*(.*)$/);
    const etichetta = m && RIGHE.find((r) => r.toLowerCase() === m[1].trim().toLowerCase());
    if (etichetta) righe[etichetta] = m![2].trim();
    else if (riga.trim()) altro.push(riga.trim());
  }
  const luogo = e.location?.trim() ?? '';
  return {
    id: e.id,
    ricorrente: Boolean(e.recurringEventId),
    htmlLink: e.htmlLink,
    data: inizio ? giorno.format(inizio) : e.start.date!,
    inizio: inizio ? ora.format(inizio) : '',
    fine: fine ? ora.format(fine) : '',
    titolo: e.summary?.trim() || 'Prova',
    luogo: luogo === salaAbituale() ? '' : luogo,
    righe,
    altro: altro.join('\n'),
  };
}

// Le prove tra due giorni, in ordine (le date della prova settimanale una per una)
export async function elencoProve(s: Sessione, da: string, a: string): Promise<Prova[]> {
  const p = new URLSearchParams({
    singleEvents: 'true', orderBy: 'startTime', maxResults: '500', timeZone: FUSO,
    timeMin: new Date(`${da}T00:00:00Z`).toISOString(), timeMax: new Date(`${a}T23:59:59Z`).toISOString(),
  });
  const { items = [] } = await api<{ items?: EventoApi[] }>(s, url(`?${p}`));
  return items.filter((e) => e.status !== 'cancelled').map(prova);
}

export const leggiProva = async (s: Sessione, id: string) => prova(await api<EventoApi>(s, url(`/${encodeURIComponent(id)}`)));

// Dal modulo (src/admin/ModuloProva.astro) al corpo dell'evento
export function corpoDalModulo(f: FormData): { errore: string } | object {
  const v = (k: string) => String(f.get(k) ?? '').trim();
  const data = v('data'), inizio = v('inizio'), fine = v('fine');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { errore: 'Manca la data.' };
  if (!/^\d{2}:\d{2}$/.test(inizio) || !/^\d{2}:\d{2}$/.test(fine)) return { errore: 'Mancano gli orari di inizio e fine.' };
  if (fine <= inizio) return { errore: 'La fine deve essere dopo l’inizio.' };
  const righe = RIGHE.map((r) => [r, v(r.toLowerCase())]).filter(([, x]) => x).map(([r, x]) => `${r}: ${x.replace(/\s*\n\s*/g, ' ')}`);
  const altro = v('altro');
  return {
    summary: v('titolo') || 'Prova',
    location: v('luogo') || salaAbituale(),
    description: [...righe, ...(altro ? [altro] : [])].join('\n'),
    start: { dateTime: `${data}T${inizio}:00`, timeZone: FUSO },
    end: { dateTime: `${data}T${fine}:00`, timeZone: FUSO },
  };
}

export const creaProva = (s: Sessione, corpo: object) =>
  api<EventoApi>(s, url(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

export const aggiornaProva = (s: Sessione, id: string, corpo: object) =>
  api<EventoApi>(s, url(`/${encodeURIComponent(id)}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

// Per una data della prova settimanale cancella solo quella data
export async function cancellaProva(s: Sessione, id: string) {
  const r = await fetch(url(`/${encodeURIComponent(id)}`), { method: 'DELETE', headers: { Authorization: `Bearer ${s.accesso}` } });
  if (!r.ok && r.status !== 410) throw new Error(`Google (${r.status}): ${(await r.text()).slice(0, 200)}`);
}
