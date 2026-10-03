// Prove nell'area Amministrazione: lettura, creazione, modifica e cancellazione degli eventi del
// calendario privato "Prove", a nome di chi è entrato (redattori@ ha "Apportare modifiche agli
// eventi"). Convenzione degli eventi, la stessa che legge l'area coristi (src/area/dati.ts):
// titolo = tipo di prova; luogo vuoto = sala abituale; descrizione con righe "Sezioni:",
// "Brani:", "Portare:", "Note:". La prova settimanale è un evento ricorrente: qui si modifica o si
// cancella una data alla volta (le altre restano come sono).
// Scrive chi è entrato nell'Amministrazione, con il suo accesso a Google ('servizio', l'account di
// servizio, sul calendario Prove può solo leggere). Righe in più dal 3/10/2026: "Repertorio:" (i titoli dei pezzi, separati da " · ", che
// l'area coristi collega alla pagina Repertorio) e "Registrazione:" (link).
import { CALENDARIO_PROVE_ID } from 'astro:env/server';
import { coro } from '../motore/coro';
import { tokenServizio } from '../area/servizio';
import type { Sessione } from './sessione';

export type Chi = Sessione | 'servizio';

// Una chiamata al calendario a nome di chi scrive; risposta vuota (cancellazione) = undefined
async function chiama<T>(chi: Chi, indirizzo: string, init: RequestInit = {}): Promise<T> {
  const token = chi === 'servizio' ? await tokenServizio() : chi.accesso;
  const r = await fetch(indirizzo, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) } });
  if (!r.ok && !(init.method === 'DELETE' && r.status === 410)) {
    const testo = await r.text();
    const messaggio = (() => { try { return JSON.parse(testo).error?.message; } catch { return undefined; } })();
    throw new Error(`Google (${r.status}): ${messaggio ?? testo.slice(0, 200)}`);
  }
  return (r.status === 204 || r.status === 410 ? undefined : await r.json()) as T;
}

const CAL = 'https://www.googleapis.com/calendar/v3';
const FUSO = 'Europe/Rome';
const url = (resto = '') => `${CAL}/calendars/${encodeURIComponent(CALENDARIO_PROVE_ID!)}/events${resto}`;

export const RIGHE = ['Sezioni', 'Repertorio', 'Brani', 'Portare', 'Note', 'Registrazione'] as const;
export const SEPARATORE_PEZZI = ' · ';
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
export async function elencoProve(s: Chi, da: string, a: string): Promise<Prova[]> {
  const p = new URLSearchParams({
    singleEvents: 'true', orderBy: 'startTime', maxResults: '500', timeZone: FUSO,
    timeMin: new Date(`${da}T00:00:00Z`).toISOString(), timeMax: new Date(`${a}T23:59:59Z`).toISOString(),
  });
  const { items = [] } = await chiama<{ items?: EventoApi[] }>(s, url(`?${p}`));
  return items.filter((e) => e.status !== 'cancelled').map(prova);
}

export const leggiProva = async (s: Chi, id: string) => prova(await chiama<EventoApi>(s, url(`/${encodeURIComponent(id)}`)));

// Dal modulo (src/admin/ModuloProva.astro) al corpo dell'evento
export function corpoDalModulo(f: FormData): { errore: string } | object {
  const v = (k: string) => String(f.get(k) ?? '').trim();
  const data = v('data'), inizio = v('inizio'), fine = v('fine');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { errore: 'Manca la data.' };
  if (!/^\d{2}:\d{2}$/.test(inizio) || !/^\d{2}:\d{2}$/.test(fine)) return { errore: 'Mancano gli orari di inizio e fine.' };
  if (fine <= inizio) return { errore: 'La fine deve essere dopo l’inizio.' };
  const registrazione = v('registrazione');
  if (registrazione && !/^https?:\/\/\S+$/.test(registrazione)) return { errore: 'Il link alla registrazione deve iniziare con https://' };
  const valori: Record<string, string> = { ...Object.fromEntries(RIGHE.map((r) => [r, v(r.toLowerCase())])), Repertorio: f.getAll('repertorio').map(String).filter(Boolean).join(SEPARATORE_PEZZI) };
  const righe = RIGHE.map((r) => [r, valori[r]]).filter(([, x]) => x).map(([r, x]) => `${r}: ${x.replace(/\s*\n\s*/g, ' ')}`);
  const altro = v('altro');
  return {
    summary: v('titolo') || 'Prova',
    location: v('luogo') || salaAbituale(),
    description: [...righe, ...(altro ? [altro] : [])].join('\n'),
    start: { dateTime: `${data}T${inizio}:00`, timeZone: FUSO },
    end: { dateTime: `${data}T${fine}:00`, timeZone: FUSO },
  };
}

export const creaProva = (s: Chi, corpo: object) =>
  chiama<EventoApi>(s, url(), { method: 'POST', body: JSON.stringify(corpo) });

export const aggiornaProva = (s: Chi, id: string, corpo: object) =>
  chiama<EventoApi>(s, url(`/${encodeURIComponent(id)}`), { method: 'PATCH', body: JSON.stringify(corpo) });

// Il messaggio per il gruppo WhatsApp dei coristi, dopo aver creato, cambiato o cancellato una prova
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const giornoEsteso = (data: string) => {
  const d = new Date(`${data}T12:00:00Z`);
  return `${GIORNI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI[d.getUTCMonth()]}`;
};
export function provaPerWhatsapp(p: Pick<Prova, 'data' | 'inizio' | 'fine' | 'titolo' | 'luogo' | 'righe'>, come: 'nuova' | 'cambiata' | 'cancellata', sito: string) {
  const titolo = p.titolo && !/^prova( settimanale)?$/i.test(p.titolo) ? p.titolo : 'Prova';
  const quando = giornoEsteso(p.data);
  const testa = { nuova: `*Nuova ${titolo.toLowerCase()}: ${quando}*`, cambiata: `*${titolo} di ${quando}: aggiornata*`, cancellata: `*${titolo} di ${quando}: annullata*` }[come];
  if (come === 'cancellata') return [testa, `Era alle ${p.inizio}. Le altre prove restano confermate.`, `${sito}/area/prove`].join('\n\n');
  const r = p.righe;
  const righe = [
    `Ore ${p.inizio}–${p.fine} · ${p.luogo || coro.prove.nome}`,
    r.Sezioni && `Sezioni: ${r.Sezioni}`,
    r.Repertorio && `Pezzi: ${r.Repertorio}`,
    r.Brani && `Brani: ${r.Brani}`,
    r.Portare && `Portare: ${r.Portare}`,
    r.Note,
  ].filter(Boolean);
  return [testa, righe.join('\n'), `${sito}/area/prove`].join('\n\n');
}

// Per una data della prova settimanale cancella solo quella data
export const cancellaProva = (s: Chi, id: string) => chiama<void>(s, url(`/${encodeURIComponent(id)}`), { method: 'DELETE' });
