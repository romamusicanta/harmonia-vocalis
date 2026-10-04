// Lettura di un evento del calendario "Concerti" secondo la convenzione descritta in
// src/motore/concerti.ts. Senza effetti: la usano la build (concerti.ts) e i controlli dell'area
// Amministrazione, che passa gli eventi letti con le API di Google nella stessa forma di node-ical.
import type ical from 'node-ical';
import { esisteImmagine } from './coro';
import type { Brano, Concerto } from './tipi';
import type { Lingua } from './lingua';

const fuso = { timeZone: 'Europe/Rome' } as const;
export const giornoIso = (d: Date) => new Intl.DateTimeFormat('sv-SE', fuso).format(d);
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
  const dati: Pick<Concerto, 'organizza' | 'ingresso' | 'foto' | 'locandina' | 'video' | 'evidenza' | 'home' | 'en'> = {};
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
    else if (/ en$/.test(chiave)) {
      // Traduzione inglese scritta a mano: "Titolo EN", "Evidenza EN", "Organico EN", "Ingresso EN"
      const campo = chiave.slice(0, -3);
      if (campo === 'titolo' || campo === 'evidenza' || campo === 'organico' || campo === 'ingresso') (dati.en ??= {})[campo] = valore;
      else avviso(`"${nome.trim()}" non riconosciuto: in inglese si scrivono Titolo EN, Evidenza EN, Organico EN, Ingresso EN`);
    } else if (chiave === 'home') {
      if (/^(s[iì]|yes)$/i.test(valore)) dati.home = true;
      else if (/^no$/i.test(valore)) dati.home = false;
      else avviso(`"Home: ${valore}" non riconosciuto: si scrive "Home: sì" o "Home: no"`);
    }
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
  // Prima quelle con "copertina" nel nome: tra più foto allegate, è quella delle schede
  const elenco = [(e as { attach?: Allegato | Allegato[] }).attach ?? []].flat();
  const nomeDi = (a: Allegato) => (typeof a === 'string' ? '' : (a.params?.FILENAME ?? ''));
  elenco.sort((a, b) => Number(/copertina/i.test(nomeDi(b))) - Number(/copertina/i.test(nomeDi(a))));
  for (const a of elenco) {
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

// avvisa riceve i problemi dell'evento (righe ignorate, foto inesistenti…); senza, vanno a console
// Per le aree riservate, che leggono il calendario con l'API di Google (src/area/dati.ts): opera,
// autore, rassegna e luogo breve di un evento, con le stesse regole del sito pubblico
export function sommario(titoloEvento: string, descrizione = '', luogo = '') {
  const { programma } = leggiDescrizione(descrizione, () => {});
  const [principale] = programma;
  const l = leggiLuogo(luogo);
  return {
    autore: principale?.autore,
    opera: principale?.opera || titoloEvento,
    rassegna: principale && titoloEvento !== principale.opera ? titoloEvento || undefined : undefined,
    luogoBreve: [l.luogo, l.sala].filter(Boolean).join(' · ') || undefined,
  };
}

export function daEvento(e: ical.VEvent, avvisa?: (m: string) => void): Concerto {
  const soloGiorno = (e.start as { dateOnly?: boolean }).dateOnly === true;
  const data = soloGiorno ? giornoIso(e.start) : oraRoma(e.start);
  const titoloEvento = testo(e.summary);
  const avviso = avvisa ?? ((m: string) => console.warn(`[calendario] ${data} ${titoloEvento}: ${m}`));
  const { programma, dati, interpreti } = leggiDescrizione(testo(e.description), avviso);
  leggiAllegati(e, dati, avviso);
  const [principale] = programma;
  return {
    data,
    autore: principale?.autore,
    titolo: principale?.opera || titoloEvento,
    // Senza rassegna il titolo dell'evento è l'opera stessa: non si ripete come rassegna
    rassegna: principale && titoloEvento !== principale.opera ? titoloEvento || undefined : undefined,
    ...leggiLuogo(testo(e.location)),
    ...dati,
    // Il programma dettagliato serve solo se c'è più di un'opera o qualche dettaglio in più
    programma: programma.length > 1 || principale?.parti || principale?.organico ? programma : undefined,
    interpreti: interpreti.length ? interpreti : undefined,
  };
}

export const semplifica = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Identificativo per l'indirizzo della scheda: "2026-10-18-requiem-k-626"
export const slug = (c: Concerto) => `${c.data.slice(0, 10)}-${semplifica(c.titolo)}`;

// Stagione concertistica, da settembre ad agosto: "25/26"
export function stagione(c: Pick<Concerto, 'data'>, lingua: Lingua = 'it') {
  const anno = Number(c.data.slice(0, 4));
  const mese = c.data.length >= 7 ? Number(c.data.slice(5, 7)) : 9;
  const inizio = mese >= 9 ? anno : anno - 1;
  const due = (n: number) => String(n % 100).padStart(2, '0');
  return { sigla: `${due(inizio)}/${due(inizio + 1)}`, nome: `${lingua === 'en' ? 'Season' : 'Stagione'} ${inizio}/${String(inizio + 1).slice(2)}`, id: `s-${due(inizio)}${due(inizio + 1)}` };
}
