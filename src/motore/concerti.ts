// Concerti: tutti e solo dal calendario Google "Concerti" (iCal pubblico, letto in fase di build),
// che si scrive dall'area Amministrazione (Concerti → Modifica): è l'unico posto dei dati dei
// concerti del sito. Gli eventi futuri sono "in programma", quelli passati l'archivio.
// Dal 6/10/2026 non ci sono più dati di riserva nel codice (coro/concerti.ts). Nella build il
// calendario è la copia scaricata da scripts/scarica-allegati.mjs, che ferma la pubblicazione se il
// calendario non risponde (resta online il sito di prima); le aree riservate, a ogni avvio, lo
// leggono dall'indirizzo e se non risponde hanno zero concerti.
//
// Convenzione per chi inserisce gli eventi nel calendario:
//   Data         → "Tutto il giorno" finché l'orario non è deciso (il sito scrive "Orario da definire")
//   Titolo       → nome dell'evento o della rassegna: "Autunno Musicale 2026"; se non c'è, l'opera
//                  della prima riga ("Grande Messa in do minore K 427")
//   Luogo        → "Città, sala" scritto a mano ("Rignano Flaminio (RM), Chiesa di San Vincenzo"),
//                  oppure un indirizzo scelto da Google Maps
//   Descrizione  → prima riga: programma ("W. A. Mozart · Requiem K 626"),
//                  eventuali altre opere su righe seguenti, stessa forma;
//                  poi righe "Etichetta: valore":
//                    Organizza: Comune di Rignano Flaminio
//                    Ingresso: libero
//                    Organico: per soli, coro e orchestra      (dell'opera appena sopra)
//                    Brani: Introitus, Kyrie, Dies irae        (dell'opera appena sopra)
//                    Foto: terme.jpg                           (file in coro/immagini, per le schede:
//                                                               solo una foto di quel concerto, che si
//                                                               vede solo se non c'è la locandina)
//                    Locandina: locandina-rignano.jpg          (file in coro/immagini, al posto di
//                                                               quella generata dal sito)
//                    Video: 43p4ArVIS_Q                        (ID YouTube, dopo il concerto)
//                    Data: solo l'anno                         (concerti vecchi senza data precisa: il
//                                                               sito mostra solo l'anno, niente pagina)
//                    Evidenza: Il primo concerto del coro
//                    Evidenza EN: For the 800th anniversary…    (traduzione inglese; anche Ingresso EN, e
//                                                               dopo ogni opera Opera EN e Organico EN; le
//                                                               scrive il modulo dell'Amministrazione; senza,
//                                                               traduce src/motore/inglese.ts)
//                    Home: sì                                  (in home page anche se è passato;
//                                                               "Home: no" lo toglie anche se è in programma;
//                                                               si cambia dall'area Amministrazione)
//                  ogni altra etichetta è un interprete:
//                    Orchestra: Orchestra Sinfonica di Roma
//                    Soprano: Maria Rossi
//                    Solisti: (soprano, contralto, tenore, basso)   → "Da annunciare", con la nota
//   Allegati     → (graffetta, file della cartella Concerti del Drive condiviso) un'immagine con
//                  "locandina" nel nome è la locandina, le altre la foto delle schede (prima quella
//                  con "copertina" nel nome); vedi il documento LEGGIMI nella cartella Concerti;
//                  le righe Locandina:/Foto: della descrizione, se ci sono, hanno la precedenza.
//                  Le scarica scripts/scarica-allegati.mjs prima della build.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import ical from 'node-ical';
import { coro } from './coro';
import { daEvento, giornoIso, semplifica, stagione } from './calendario';
import type { Concerto } from './tipi';
import { localeDi, type Lingua } from './lingua';

const COPIA = join(process.cwd(), 'coro/immagini/drive/concerti.ics');

async function carica(): Promise<Concerto[]> {
  const ics = coro.calendario.ics;
  try {
    const dati = existsSync(COPIA) ? await ical.async.parseFile(COPIA) : ics ? await ical.async.fromURL(ics) : undefined;
    if (!dati) throw new Error('CALENDARIO_CONCERTI_ICS non impostata');
    return Object.values(dati)
      .filter((c): c is ical.VEvent => c?.type === 'VEVENT' && (c as ical.VEvent).status !== 'CANCELLED')
      .map((e) => daEvento(e));
  } catch (err) {
    console.warn(`[calendario] non raggiungibile, nessun concerto: ${err}`);
    return [];
  }
}

const dalCalendario = await carica();
const oggi = giornoIso(new Date());
const giorno = (c: Concerto) => c.data.slice(0, 10);

// In programma: dal più vicino
const prossimi = dalCalendario.filter((c) => giorno(c) >= oggi).sort((a, b) => a.data.localeCompare(b.data));

export const prossimiConcerti = async (): Promise<Concerto[]> => prossimi;

// L'archivio, dal più recente: i concerti passati del calendario
export const archivio = dalCalendario.filter((c) => giorno(c) < oggi).sort((a, b) => b.data.localeCompare(a.data));

// ——— Formattazione ———

const conOra = (iso: string) => iso.length > 10;
// Le date sono già in ora di Roma: si formattano come UTC per non spostarle.
const comeData = (iso: string) => new Date(iso.length === 4 ? `${iso}-06-15T12:00:00Z` : conOra(iso) ? `${iso}:00Z` : `${iso}T12:00:00Z`);

export function parti(c: Pick<Concerto, 'data' | 'dataIncerta'>, lingua: Lingua = 'it') {
  const d = comeData(c.data);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(localeDi(lingua), { timeZone: 'UTC', ...o }).format(d);
  const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    giornoSettimana: maiuscola(f({ weekday: 'long' })),
    giorno: f({ day: '2-digit' }),
    mese: maiuscola(f({ month: 'long' })),
    meseBreve: maiuscola(f({ month: 'short' }).replace('.', '')),
    anno: f({ year: 'numeric' }),
    ora: conOra(c.data) ? f({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : undefined,
    // "Domenica 18 ottobre 2026", "Sunday 18 October 2026"
    esteso: maiuscola(f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '')),
    incerta: c.dataIncerta === true,
  };
}

// Archivio raggruppato per stagione, dalla più recente
export function perStagione(elenco: Concerto[], lingua: Lingua = 'it') {
  const gruppi = new Map<string, { stagione: ReturnType<typeof stagione>; concerti: Concerto[] }>();
  for (const c of elenco) {
    const s = stagione(c, lingua);
    if (!gruppi.has(s.id)) gruppi.set(s.id, { stagione: s, concerti: [] });
    gruppi.get(s.id)!.concerti.push(c);
  }
  return [...gruppi.values()];
}

// Chiave per i filtri per autore: "W. A. Mozart" → "mozart"
export const chiaveAutore = (autore?: string) => (autore ? semplifica(autore.split(/\s+/).at(-1)!) : 'altri');

// semplifica e slug stanno in calendario.ts (servono anche all'area Amministrazione)
export { semplifica, slug, stagione } from './calendario';

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
