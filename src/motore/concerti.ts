// Concerti: tutti dal calendario Google "Concerti" (iCal pubblico, letto in fase di build).
// Gli eventi futuri sono "in programma", quelli passati entrano da soli nell'archivio.
// coro/concerti.ts tiene l'archivio storico e i prossimi di riserva, usati se il calendario
// non è configurato o non risponde.
//
// Convenzione per chi inserisce gli eventi nel calendario:
//   Data         → "Tutto il giorno" finché l'orario non è deciso (il sito scrive "Orario da definire")
//   Titolo       → nome dell'evento o della rassegna: "Autunno Musicale 2026"
//   Luogo        → "Città, sala" scritto a mano ("Rignano Flaminio (RM), Chiesa di San Vincenzo"),
//                  oppure un indirizzo scelto da Google Maps
//   Descrizione  → prima riga: programma ("W. A. Mozart · Requiem K 626"),
//                  eventuali altre opere su righe seguenti, stessa forma;
//                  poi righe "Etichetta: valore":
//                    Organizza: Comune di Rignano Flaminio
//                    Ingresso: libero
//                    Organico: per soli, coro e orchestra      (dell'opera appena sopra)
//                    Brani: Introitus, Kyrie, Dies irae        (dell'opera appena sopra)
//                    Foto: terme.jpg                           (file in coro/immagini, per le schede)
//                    Locandina: locandina-rignano.jpg          (file in coro/immagini, al posto di
//                                                               quella generata dal sito)
//                    Video: 43p4ArVIS_Q                        (ID YouTube, dopo il concerto)
//                    Evidenza: Il primo concerto del coro
//                  ogni altra etichetta è un interprete:
//                    Orchestra: Orchestra Sinfonica di Roma
//                    Soprano: Maria Rossi
//                    Solisti: (soprano, contralto, tenore, basso)   → "Da annunciare", con la nota
//   Allegati     → (graffetta, file della cartella Concerti del Drive condiviso) un'immagine con
//                  "locandina" nel nome è la locandina, le altre immagini la foto delle schede;
//                  le righe Locandina:/Foto: della descrizione, se ci sono, hanno la precedenza.
//                  Le scarica scripts/scarica-allegati.mjs prima della build.
import ical from 'node-ical';
import { coro, esisteImmagine } from './coro';
import type { Brano, Concerto } from './tipi';
import { archivio as archivioCoro, prossimi as prossimiCoro } from '../../coro/concerti';

const fuso = { timeZone: 'Europe/Rome' } as const;
const giornoIso = (d: Date) => new Intl.DateTimeFormat('sv-SE', fuso).format(d);
const oraRoma = (d: Date) => new Intl.DateTimeFormat('sv-SE', { ...fuso, dateStyle: 'short', timeStyle: 'short' }).format(d).replace(' ', 'T');

const testo = (v: unknown) => (typeof v === 'string' ? v : ((v as { val?: string })?.val ?? '')).trim();

// Google mette HTML nella descrizione quando si usano grassetti, elenchi o link
function senzaHtml(s: string) {
  if (!/<[a-z][^>]*>/i.test(s)) return s;
  return s
    .replace(/<br\s*\/?>|<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

const etichettaRiga = /^([\p{L}' ]{2,30}):\s*(.*)$/u;

function leggiDescrizione(descrizione: string, avviso: (m: string) => void) {
  const righe = senzaHtml(descrizione).split('\n').map((r) => r.trim()).filter(Boolean);
  const programma: Brano[] = [];
  const dati: Pick<Concerto, 'organizza' | 'ingresso' | 'foto' | 'locandina' | 'video' | 'evidenza'> = {};
  const interpreti: NonNullable<Concerto['interpreti']> = [];
  for (const riga of righe) {
    // Le opere vengono prima di tutte le etichette; la prima riga è sempre un'opera, anche con i due punti
    const inProgramma = !interpreti.length && !Object.keys(dati).length && programma.every((b) => !b.parti && !b.organico);
    const m = inProgramma && (!programma.length || riga.includes('·')) ? null : riga.match(etichettaRiga);
    if (!m) {
      if (!inProgramma) avviso(`riga senza etichetta ignorata: "${riga}"`);
      else {
        const [autore, opera] = riga.includes('·') ? riga.split('·').map((s) => s.trim()) : [undefined, riga];
        programma.push({ autore, opera });
      }
      continue;
    }
    const [, nome, valore] = m;
    const chiave = nome.trim().toLowerCase();
    const ultima = programma.at(-1);
    if (chiave === 'organizza' || chiave === 'ingresso' || chiave === 'video' || chiave === 'evidenza') dati[chiave] = valore || undefined;
    else if (chiave === 'foto' || chiave === 'locandina') {
      if (esisteImmagine(valore)) dati[chiave] = valore;
      else avviso(`${chiave} "${valore}" non trovata in coro/immagini`);
    } else if (chiave === 'brani' && ultima) ultima.parti = valore.split(',').map((s) => s.trim()).filter(Boolean);
    else if (chiave === 'organico' && ultima) ultima.organico = valore;
    else {
      // "Solisti: (soprano, contralto, tenore, basso)" → nome da annunciare, con la nota
      const [, nomeInterprete = '', nota] = valore.match(/^(.*?)\s*(?:\((.*)\))?$/) ?? [];
      interpreti.push({ ruolo: nome.trim(), nome: nomeInterprete || undefined, nota: nota || undefined });
    }
  }
  return { programma, dati, interpreti };
}

// Luogo scritto a mano: "Rignano Flaminio (RM), Chiesa di San Vincenzo".
// Luogo scelto da Google Maps: "Chiesa di San Vincenzo, Via Roma 1, 00068 Rignano Flaminio RM, Italia".
function leggiLuogo(luogo: string): Pick<Concerto, 'luogo' | 'sala' | 'indirizzo'> {
  const pezzi = luogo.split(',').map((s) => s.trim()).filter(Boolean);
  const conCap = pezzi.findIndex((p) => /^\d{5}\s/.test(p));
  if (conCap < 0) return { luogo: pezzi[0], sala: pezzi.slice(1).join(', ') || undefined };
  // "00068 Rignano Flaminio RM" → "Rignano Flaminio (RM)"; "00159 Roma RM" → "Roma"
  const citta = pezzi[conCap].replace(/^\d{5}\s+/, '').replace(/\s+([A-Z]{2})$/, ' ($1)').replace(/^Roma \(RM\)$/, 'Roma');
  const primo = pezzi[0];
  const eStrada = /^(via|viale|piazza|piazzale|largo|corso|vicolo|lungotevere|circonvallazione|borgo|contrada|località|loc\.)\b/i.test(primo);
  return { luogo: citta, sala: conCap > 0 && !eStrada ? primo : undefined, indirizzo: luogo };
}

// Immagini allegate all'evento, già scaricate da Drive in coro/immagini/drive/ (vedi
// scripts/scarica-allegati.mjs, che usa la stessa regola per il nome del file)
type Allegato = string | { params?: { FILENAME?: string; FMTTYPE?: string }; val?: string };
const estensioni: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

function leggiAllegati(e: ical.VEvent, dati: { foto?: string; locandina?: string }, avviso: (m: string) => void) {
  for (const a of [(e as { attach?: Allegato | Allegato[] }).attach ?? []].flat()) {
    if (typeof a === 'string') continue;
    const id = a.val?.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/)?.[1];
    const estensione = estensioni[a.params?.FMTTYPE ?? ''];
    if (!id || !estensione) continue;
    const nome = `drive/${id}.${estensione}`;
    if (!esisteImmagine(nome)) {
      avviso(`allegato "${a.params?.FILENAME}" non scaricato da Drive`);
      continue;
    }
    if (/locandina/i.test(a.params?.FILENAME ?? '')) dati.locandina ??= nome;
    else dati.foto ??= nome;
  }
}

function daEvento(e: ical.VEvent): Concerto {
  const soloGiorno = (e.start as { dateOnly?: boolean }).dateOnly === true;
  const data = soloGiorno ? giornoIso(e.start) : oraRoma(e.start);
  const titoloEvento = testo(e.summary);
  const avviso = (m: string) => console.warn(`[calendario] ${data} ${titoloEvento}: ${m}`);
  const { programma, dati, interpreti } = leggiDescrizione(testo(e.description), avviso);
  leggiAllegati(e, dati, avviso);
  const [principale] = programma;
  return {
    data,
    autore: principale?.autore,
    titolo: principale?.opera || titoloEvento,
    rassegna: principale ? titoloEvento || undefined : undefined,
    ...leggiLuogo(testo(e.location)),
    ...dati,
    // Il programma dettagliato serve solo se c'è più di un'opera o qualche dettaglio in più
    programma: programma.length > 1 || principale?.parti || principale?.organico ? programma : undefined,
    interpreti: interpreti.length ? interpreti : undefined,
  };
}

async function carica(): Promise<Concerto[] | undefined> {
  const ics = coro.calendario.ics;
  if (!ics) return undefined;
  try {
    const dati = await ical.async.fromURL(ics);
    return Object.values(dati)
      .filter((c): c is ical.VEvent => c?.type === 'VEVENT' && (c as ical.VEvent).status !== 'CANCELLED')
      .map(daEvento);
  } catch (err) {
    console.warn(`[calendario] non raggiungibile, uso i dati locali: ${err}`);
    return undefined;
  }
}

const dalCalendario = await carica();
const oggi = giornoIso(new Date());
const giorno = (c: Concerto) => c.data.slice(0, 10);

// In programma: dal più vicino
const prossimi = (dalCalendario ?? prossimiCoro).filter((c) => giorno(c) >= oggi).sort((a, b) => a.data.localeCompare(b.data));

export const prossimiConcerti = async (): Promise<Concerto[]> => prossimi;

// L'archivio, dal più recente: quello storico di coro/concerti.ts più i concerti passati del
// calendario (se un giorno è in tutti e due, vale coro/concerti.ts)
const giorniStorici = new Set(archivioCoro.map(giorno));
export const archivio = [...archivioCoro, ...(dalCalendario ?? []).filter((c) => giorno(c) < oggi && !giorniStorici.has(giorno(c)))]
  .sort((a, b) => b.data.localeCompare(a.data));

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
