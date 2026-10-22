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
import { copertinaDelConcerto, coro } from './coro';
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
      .map((e) => daEvento(e))
      // La copertina scelta dai redattori tra le foto dei coristi (Foto dei concerti, la stella)
      .map((c) => { const copertina = c.dataIncerta ? undefined : copertinaDelConcerto(c.data.slice(0, 10)); return copertina ? { ...c, copertina } : c; });
  } catch (err) {
    console.warn(`[calendario] non raggiungibile, nessun concerto: ${err}`);
    return [];
  }
}

const oggi = giornoIso(new Date());
const giorno = (c: Concerto) => c.data.slice(0, 10);

// «Il primo concerto del coro» (dal 22/10/2026, richiesta di Mario) è il più antico dei concerti
// passati del calendario pubblico, cioè di quelli visibili sul sito: un concerto tolto dal sito
// (Amministrazione → Concerti → Modifica, «Non sul sito») passa la scritta al successivo. Per questo
// un «Evidenza: Il primo concerto del coro» scritto a mano nell'evento si ignora e si ricalcola
// qui; il concerto più antico tiene la sua evidenza, se ne ha un'altra.
const PRIMO_IT = /^il primo concerto del coro$/i;
const PRIMO_EN = /^the choir.s first concert$/i;
function conPrimo(concerti: Concerto[]): Concerto[] {
  const puliti = concerti.map((c) => {
    if (!PRIMO_IT.test(c.evidenza?.trim() ?? '')) return c;
    const en = c.en && PRIMO_EN.test(c.en.evidenza?.trim() ?? '') ? { ...c.en, evidenza: undefined } : c.en;
    return { ...c, evidenza: undefined, en };
  });
  const primo = puliti.filter((c) => giorno(c) < oggi).sort((a, b) => a.data.localeCompare(b.data))[0];
  return puliti.map((c) => (c === primo && !c.evidenza ? { ...c, evidenza: 'Il primo concerto del coro' } : c));
}

const dalCalendario = conPrimo(await carica());

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

// I link della finestra "Iscriviti al calendario", uno per app (dal 10/10/2026): l'indirizzo
// iCal pubblico vale per tutte (abbonamento, si aggiorna da solo), webcal:// lo apre in
// Calendario di iPhone e Mac, Outlook ha la sua pagina "aggiungi da web"
export function linkCalendario() {
  const google = linkIscrizioneCalendario();
  if (!google) return undefined;
  const ics = `https://calendar.google.com/calendar/ical/${encodeURIComponent(coro.calendario.id!)}/public/basic.ics`;
  const outlook = (dominio: string) =>
    `https://${dominio}/calendar/0/addfromweb?${new URLSearchParams({ url: ics, name: 'Concerti Harmonia Vocalis' })}`;
  return {
    google,
    ics,
    webcal: ics.replace(/^https:/, 'webcal:'),
    outlook: outlook('outlook.live.com'),
    outlookLavoro: outlook('outlook.office.com'),
  };
}

// ——— Le opere eseguite (Per gli organizzatori, la storia nella pagina Il Coro) ———
// Numero di catalogo in coda al titolo: "Requiem K 626" → "K 626", "Requiem op. 48" → "op. 48"
// (con almeno una cifra: "Te Deum" e "Laudate Dominum" non hanno un numero D)
export const CATALOGO = /\s+((?:K|KV|RV|BWV|HWV|D|Hob\.|op\.|Op\.)\s*(?=[\w.\/]*\d)[\w.\/]+(?:\s+n\.\s*\d+)?)$/;
// La stessa opera può avere titoli diversi nei concerti ("Requiem", "Requiem in re minore K 626"):
// si confrontano cognome dell'autore e titolo senza catalogo né tonalità
export const TONALITA = /\s+in\s+(?:(?:do|re|mi|fa|sol|la|si)(?:\s*(?:diesis|bemolle|#|b))?\s+(?:maggiore|minore)|[A-G](?:[-\s]?(?:flat|sharp|♭|♯))?\s+(?:major|minor))\b/i;
export const chiaveOpera = (autore: string, titolo: string) => semplifica(`${autore.split(' ').at(-1)} ${titolo.replace(CATALOGO, '').replace(TONALITA, '')}`);
