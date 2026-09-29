import ical from 'node-ical';
import { site } from '../config';
import { prossimiConcerti, type Concerto } from '../data/concerti';

// I prossimi concerti vengono dal calendario Google "Concerti" (indirizzo pubblico iCal).
// Convenzione per chi inserisce gli eventi:
//   Titolo       → nome dell'evento o della rassegna
//   Luogo        → città e sala
//   Descrizione  → prima riga: programma; righe successive: note (organizzatore, biglietti…)

let cache: Promise<Concerto[]> | undefined;

export function getProssimiConcerti(): Promise<Concerto[]> {
  cache ??= carica();
  return cache;
}

async function carica(): Promise<Concerto[]> {
  const ics = site.link.calendarioIcs;
  if (!ics) return filtraFuturi(prossimiConcerti);
  try {
    const dati = await ical.async.fromURL(ics);
    const eventi = Object.values(dati)
      .filter((c): c is ical.VEvent => c.type === 'VEVENT')
      .map((e) => {
        const [programma, ...note] = testo(e.description).split('\n').map((r) => r.trim());
        const soloGiorno = (e.start as any).dateOnly === true;
        return {
          titolo: testo(e.summary),
          programma: programma || undefined,
          note: note.filter(Boolean).join(' · ') || undefined,
          luogo: testo(e.location),
          data: soloGiorno ? giornoIso(e.start) : e.start.toISOString(),
        } satisfies Concerto;
      });
    return filtraFuturi(eventi);
  } catch (err) {
    console.warn(`[calendario] non raggiungibile, uso i dati locali: ${err}`);
    return filtraFuturi(prossimiConcerti);
  }
}

function filtraFuturi(elenco: Concerto[]) {
  const oggi = giornoIso(new Date());
  return elenco
    .filter((c) => c.data.slice(0, 10) >= oggi)
    .sort((a, b) => a.data.localeCompare(b.data));
}

const testo = (v: unknown) => (typeof v === 'string' ? v : ((v as any)?.val ?? '')).trim();

const giornoIso = (d: Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(d);

// Formattazione per la pagina

const fuso = { timeZone: 'Europe/Rome' } as const;
const conOra = (iso: string) => iso.length > 10;
const comeData = (iso: string) => new Date(conOra(iso) ? iso : `${iso}T12:00:00Z`);

export function parti(iso: string) {
  const d = comeData(iso);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('it-IT', { ...fuso, ...o }).format(d);
  return {
    giornoSettimana: f({ weekday: 'long' }),
    giorno: f({ day: '2-digit' }),
    mese: f({ month: 'long' }),
    anno: f({ year: 'numeric' }),
    ora: conOra(iso) ? f({ hour: '2-digit', minute: '2-digit' }) : undefined,
  };
}

// Link "Aggiungi a Google Calendar" per il singolo concerto
export function linkGoogleCalendar(c: Concerto) {
  const compatta = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
  let date: string;
  if (conOra(c.data)) {
    const inizio = new Date(c.data);
    const fine = new Date(inizio.getTime() + 2 * 60 * 60 * 1000);
    date = `${compatta(inizio)}/${compatta(fine)}`;
  } else {
    const g = c.data.replaceAll('-', '');
    const dopo = new Date(`${c.data}T12:00:00Z`);
    dopo.setUTCDate(dopo.getUTCDate() + 1);
    date = `${g}/${dopo.toISOString().slice(0, 10).replaceAll('-', '')}`;
  }
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${site.nome} — ${c.titolo}`,
    dates: date,
    location: c.luogo,
    details: [c.programma, c.note].filter(Boolean).join('\n'),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export const linkMappa = (luogo: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(luogo)}`;
