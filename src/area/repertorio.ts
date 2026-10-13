// Repertorio dell'area coristi: scheda "Repertorio" del foglio "Coristi e assenze" (la crea il
// sito), una riga per opera o per raccolta, e i file su Drive in Spartiti/<Autore – Titolo>/
// (cartella DRIVE_CARTELLA_SPARTITI del Drive condiviso). Lo gestiscono i redattori (/admin/repertorio)
// e il Maestro (/maestro/repertorio, solo le note); scrive tutto l'account di servizio, che sulla
// cartella Spartiti è Gestore contenuti.
//
// Due tipi di riga (dal 13/10/2026, colonna "Tipo"; vuota = Opera):
// - Opera: un pezzo del repertorio, anche breve (Ave Verum) o in più parti (Petite Messe). Spartito,
//   arrangiatore, tracce di studio per sezione, esecuzione di riferimento, note del Maestro e le
//   **parti** (colonna "Brani separati": movimenti o estratti, ognuno col suo spartito, "Nome | link",
//   poi i nomi di prima), ognuna con le sue tracce per sezione (colonna "Tracce delle parti", una
//   riga "Parte | Sezione | link").
// - Raccolta: una cartella di pezzi (Canti natalizi, Brani per i bis): titolo, nota e i pezzi
//   (colonna "Contenuto": gli ID delle opere, uno per riga, nell'ordine). Un pezzo può stare in più
//   raccolte. Prima del 13/10/2026 le raccolte erano opere «AA. VV.» con i pezzi come brani: i nomi
//   con cui prove e convocazioni li citavano stanno nella colonna "Nomi di prima" del pezzo.
// I file si caricano a pezzi da 3,5 MB attraverso il sito (le funzioni di Vercel accettano al più
// 4,5 MB per richiesta), con il caricamento "resumable" di Drive (src/area/drive.ts).
import { randomBytes } from 'node:crypto';
import { DRIVE_CARTELLA_SPARTITI } from 'astro:env/server';
import { adesso, cancellaRiga, idScheda, leggiScheda, scriviRiga, SEZIONI } from './dati';
import { cartellaIn, linkFile, rispondiCaricamento } from './drive';
import { spiegaTesto } from './errori';

const SCHEDA = 'Repertorio';
export const STATI = ['In studio', 'In repertorio'] as const;
const TRACCE = [...SEZIONI, 'Tutte le voci'];
// Le colonne nuove sempre in fondo (idScheda le aggiunge all'intestazione delle schede già create)
const COLONNE = ['ID', 'Autore', 'Titolo', 'Stato', 'Spartito', 'Brani separati', ...TRACCE.map((t) => `Tracce ${t}`), 'Esecuzione di riferimento', 'Note del Maestro', 'Cartella', 'Aggiornato il', 'Aggiornato da', 'Tipo', 'Arrangiatore', 'Contenuto', 'Tracce delle parti', 'Nomi di prima'];

export const configurato = () => Boolean(DRIVE_CARTELLA_SPARTITI);

export interface Traccia { sezione: string; link: string }
// Una parte di un'opera (movimento o estratto). altri: i nomi che aveva prima di essere rinominata,
// perché le prove e le convocazioni che la nominano così la ritrovino
export interface FileBrano { nome: string; link: string; altri?: string[]; tracce: Traccia[] }
export interface Pezzo {
  riga: number;
  id: string;
  autore: string;
  titolo: string;
  arrangiatore: string;
  stato: string;
  spartito?: string;                 // link a Drive
  brani: FileBrano[];                // le parti dell'opera
  tracce: Traccia[];                 // dell'opera intera
  esecuzione?: string;
  note: string;
  cartella?: string;                 // id della cartella su Drive
  nomiPrima: string[];               // come lo nominavano prove e convocazioni prima (vedi in testa)
  raccolte: string[];                // ID delle raccolte che lo contengono (ricavato)
  aggiornato: string;
}
export interface Raccolta {
  riga: number;
  id: string;
  titolo: string;
  note: string;
  contenuto: string[];               // ID dei pezzi, nell'ordine (solo quelli che esistono)
  aggiornato: string;
}

export const sezioniTracce = TRACCE;
export const nomeCompleto = (p: Pick<Pezzo, 'autore' | 'titolo'>) => [p.autore, p.titolo].filter(Boolean).join(' – ');

// Prove e convocazioni nominano i pezzi con "Autore – Titolo" (il solo titolo non basta: due
// Magnificat di autori diversi); valgono ancora i nomi scritti prima del 3/10/2026, con il solo
// titolo, e quelli di prima delle raccolte ("AA. VV. – Canti natalizi › Stille Nacht"). Si
// confrontano senza spazi, punteggiatura e accenti ("C.P.E. Bach" = "C. P. E. Bach").
const confrontabile = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export function trovaPezzo<T extends Pick<Pezzo, 'autore' | 'titolo'> & { nomiPrima?: string[] }>(pezzi: T[], nome: string): T | undefined {
  const n = confrontabile(nome);
  return pezzi.find((p) => confrontabile(nomeCompleto(p)) === n)
    ?? pezzi.find((p) => p.nomiPrima?.some((x) => confrontabile(x) === n))
    ?? pezzi.find((p) => confrontabile(p.titolo) === n);
}

// Una parte di un'opera si nomina "Autore – Titolo › Parte": in una prova si può chiedere di
// preparare solo quella (dal 6/10/2026)
export const SEPARATORE_BRANO = ' › ';
export const nomeBrano = (p: Pick<Pezzo, 'autore' | 'titolo'>, b: Pick<FileBrano, 'nome'>) => `${nomeCompleto(p)}${SEPARATORE_BRANO}${b.nome}`;
export function trovaVoce<T extends Pick<Pezzo, 'autore' | 'titolo' | 'brani'> & { nomiPrima?: string[] }>(pezzi: T[], nome: string): { pezzo: T; brano?: FileBrano } | undefined {
  const pezzo = trovaPezzo(pezzi, nome);
  if (pezzo) return { pezzo };
  const i = nome.lastIndexOf(SEPARATORE_BRANO.trim());
  if (i < 0) return undefined;
  const opera = trovaPezzo(pezzi, nome.slice(0, i));
  const b = confrontabile(nome.slice(i + 1));
  const brano = opera?.brani.find((x) => [x.nome, ...(x.altri ?? [])].some((n) => confrontabile(n) === b));
  return opera && brano ? { pezzo: opera, brano } : undefined;
}

const righe = (v = '') => v.split('\n').map((r) => r.trim()).filter(Boolean);
function aBrani(v = '', tracce = '') {
  const perParte = righe(tracce).map((r) => r.split(' | ')).filter((x) => x.length >= 3);
  return righe(v).map((r) => r.split(' | ')).filter(([, l]) => l).map(([nome, link, ...altri]) => ({
    nome: nome.trim(), link: link.trim(), altri: altri.map((a) => a.trim()).filter(Boolean),
    tracce: TRACCE.map((sezione) => ({ sezione, link: perParte.find(([n, s]) => n.trim() === nome.trim() && s.trim() === sezione)?.[2]?.trim() ?? '' })).filter((t) => t.link),
  }));
}
const daBrani = (b: FileBrano[]) => b.map((x) => [x.nome, x.link, ...(x.altri ?? [])].join(' | ')).join('\n');
const daTracceParti = (b: FileBrano[]) => b.flatMap((x) => x.tracce.map((t) => [x.nome, t.sezione, t.link].join(' | '))).join('\n');

// L'autore si scrive "W. A. Mozart" (iniziali puntate, poi il cognome), oppure "Anonimo" o
// "Tradizionale": si ordina per cognome, poi per iniziali, poi per titolo
const INIZIALI = /^((?:\p{Lu}\.\s*)+)/u;
function cognomeEIniziali(autore: string) {
  const a = autore.trim();
  const iniziali = a.match(INIZIALI)?.[1] ?? '';
  return { cognome: a.slice(iniziali.length).trim() || a, iniziali: iniziali.replace(/\s+/g, '') };
}
const confronta = (x: string, y: string) => x.localeCompare(y, 'it', { sensitivity: 'base' });
const perAutore = (a: Pick<Pezzo, 'autore' | 'titolo'>, b: Pick<Pezzo, 'autore' | 'titolo'>) => {
  const ka = cognomeEIniziali(a.autore), kb = cognomeEIniziali(b.autore);
  return confronta(ka.cognome, kb.cognome) || confronta(ka.iniziali, kb.iniziali) || confronta(a.titolo, b.titolo);
};
// "W.A.  Mozart" → "W. A. Mozart"
const scriviAutore = (v: string) => v.trim().replace(/\s+/g, ' ').replace(/(\p{Lu})\.(?=\S)/gu, '$1. ');

export async function catalogo(): Promise<{ pezzi: Pezzo[]; raccolte: Raccolta[] }> {
  await idScheda(SCHEDA, COLONNE);
  const tutte = (await leggiScheda(SCHEDA)).filter((r) => r['ID'] && r['Titolo']);
  const pezzi: Pezzo[] = tutte.filter((r) => r['Tipo'] !== 'Raccolta').map((r) => ({
    riga: r.riga,
    id: r['ID'],
    autore: r['Autore'],
    titolo: r['Titolo'],
    arrangiatore: r['Arrangiatore'] ?? '',
    stato: r['Stato'] || STATI[0],
    spartito: r['Spartito'] || undefined,
    brani: aBrani(r['Brani separati'], r['Tracce delle parti']),
    tracce: TRACCE.map((sezione) => ({ sezione, link: r[`Tracce ${sezione}`] })).filter((t) => t.link),
    esecuzione: r['Esecuzione di riferimento'] || undefined,
    note: r['Note del Maestro'],
    cartella: r['Cartella'] || undefined,
    nomiPrima: righe(r['Nomi di prima']),
    raccolte: [],
    aggiornato: r['Aggiornato il'],
  }));
  const ids = new Set(pezzi.map((p) => p.id));
  const raccolte: Raccolta[] = tutte.filter((r) => r['Tipo'] === 'Raccolta').map((r) => ({
    riga: r.riga,
    id: r['ID'],
    titolo: r['Titolo'],
    note: r['Note del Maestro'],
    contenuto: [...new Set(righe(r['Contenuto']))].filter((id) => ids.has(id)),
    aggiornato: r['Aggiornato il'],
  })).sort((a, b) => confronta(a.titolo, b.titolo));
  for (const p of pezzi) p.raccolte = raccolte.filter((r) => r.contenuto.includes(p.id)).map((r) => r.id);
  return { pezzi: pezzi.sort(perAutore), raccolte };
}

// Le opere (i pezzi), senza le raccolte: è quello che serve a prove, convocazioni e bacheca
export const repertorio = async () => (await catalogo()).pezzi;

// Il testo si scrive come testo (apostrofo iniziale): niente formule né date interpretate, e niente
// numeri: un ID come «658e1234» diventerebbe 6,58E+08 (successo il 13/10/2026)
const t = (v?: string) => (v ? `'${v}` : '');

async function scrivi(p: Omit<Pezzo, 'riga' | 'aggiornato' | 'raccolte'>, riga: number | undefined, da: string) {
  const tracce = TRACCE.map((s) => t(p.tracce.find((x) => x.sezione === s)?.link));
  await scriviRiga(SCHEDA, [t(p.id), t(p.autore), t(p.titolo), p.stato, t(p.spartito), t(daBrani(p.brani)), ...tracce, t(p.esecuzione), t(p.note), p.cartella ?? '', adesso(), da,
    'Opera', t(p.arrangiatore), '', t(daTracceParti(p.brani)), t(p.nomiPrima.join('\n'))], riga);
}
async function scriviRaccolta(r: Omit<Raccolta, 'riga' | 'aggiornato'>, riga: number | undefined, da: string) {
  await scriviRiga(SCHEDA, [t(r.id), '', t(r.titolo), '', '', '', ...TRACCE.map(() => ''), '', t(r.note), '', adesso(), da,
    'Raccolta', '', t(r.contenuto.join('\n')), '', ''], riga);
}

const link = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (!/^https?:\/\/\S+$/.test(s)) throw new Error(`«${s.slice(0, 60)}» non è un indirizzo web (deve iniziare con https://)`);
  return s;
};
const testoLungo = (v: FormDataEntryValue | null) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, 4000);
// " | " separa i campi nel foglio, "›" separa opera e parte nelle prove
const nomeParte = (v: FormDataEntryValue | null | string) => String(v ?? '').replace(/\s*\|\s*/g, ' - ').replace(/›/g, '-').replace(/\s+/g, ' ').trim().slice(0, 140);

type Esito = { ok: boolean; messaggio: string; id?: string };

// Modulo del repertorio (POST). Opere: azione=salva (id per modificare), cancella, togli-brano
// (indice), rinomina-brano (indice, nome), togli-traccia (sezione), togli-traccia-parte (indice,
// sezione), togli-spartito. Raccolte: salva-raccolta, cancella-raccolta.
export async function gestisci(f: FormData, email: string): Promise<Esito> {
  const azione = String(f.get('azione') ?? '');
  const id = String(f.get('id') ?? '');
  const { pezzi, raccolte } = await catalogo();

  if (azione === 'salva-raccolta' || azione === 'cancella-raccolta') {
    const esistente = id ? raccolte.find((r) => r.id === id) : undefined;
    if (id && !esistente) return { ok: false, messaggio: 'Raccolta non trovata: forse è stata cancellata.' };
    if (azione === 'cancella-raccolta' && esistente) {
      await cancellaRiga(SCHEDA, esistente.riga);
      return { ok: true, messaggio: `Raccolta «${esistente.titolo}» tolta. I suoi pezzi restano nel repertorio.` };
    }
    const titolo = String(f.get('titolo') ?? '').trim().slice(0, 140);
    if (!titolo) return { ok: false, messaggio: 'Manca il nome della raccolta.', id };
    if (raccolte.some((r) => r.id !== id && confrontabile(r.titolo) === confrontabile(titolo))) return { ok: false, messaggio: `C'è già una raccolta «${titolo}».`, id };
    // I pezzi arrivano come "Autore – Titolo" (src/area/SceltaPezzi.astro), nell'ordine scelto
    const contenuto = [...new Set(f.getAll('contenuto').map((n) => trovaPezzo(pezzi, String(n))?.id).filter((x): x is string => Boolean(x)))];
    const r = { id: esistente?.id ?? randomBytes(4).toString('hex'), titolo, note: testoLungo(f.get('note')), contenuto };
    await scriviRaccolta(r, esistente?.riga, email);
    return { ok: true, messaggio: esistente ? `Raccolta «${titolo}» aggiornata.` : `Raccolta «${titolo}» creata.`, id: r.id };
  }

  const esistente = id ? pezzi.find((p) => p.id === id) : undefined;
  if (id && !esistente) return { ok: false, messaggio: 'Pezzo non trovato: forse è stato cancellato.' };

  if (azione === 'cancella' && esistente) {
    // Prima si toglie dalle raccolte (scrivere non sposta le righe), poi si cancella la riga
    for (const r of raccolte.filter((x) => x.contenuto.includes(esistente.id))) await scriviRaccolta({ ...r, contenuto: r.contenuto.filter((x) => x !== esistente.id) }, r.riga, email);
    await cancellaRiga(SCHEDA, esistente.riga);
    return { ok: true, messaggio: `«${nomeCompleto(esistente)}» tolto dal repertorio. I file restano su Drive, nella sua cartella.` };
  }
  if (azione === 'togli-brano' && esistente) {
    const i = Number(f.get('indice'));
    const brani = esistente.brani.filter((_, j) => j !== i);
    await scrivi({ ...esistente, brani }, esistente.riga, email);
    return { ok: true, messaggio: 'Parte tolta dall\'opera, con le sue tracce (i file restano su Drive).', id: esistente.id };
  }
  if (azione === 'rinomina-brano' && esistente) {
    const i = Number(f.get('indice'));
    const brano = esistente.brani[i];
    if (!brano) return { ok: false, messaggio: 'Parte non trovata: ricarica la pagina.', id: esistente.id };
    const nome = nomeParte(f.get('nome'));
    if (!nome) return { ok: false, messaggio: 'Manca il nome della parte.', id: esistente.id };
    if (esistente.brani.some((b, j) => j !== i && confrontabile(b.nome) === confrontabile(nome))) return { ok: false, messaggio: `C'è già una parte «${nome}» in quest'opera.`, id: esistente.id };
    // Il nome di prima resta tra quelli che la parte ha avuto: le prove che la nominano la ritrovano
    const altri = [...(brano.altri ?? []), brano.nome].filter((n, k, t) => confrontabile(n) !== confrontabile(nome) && t.findIndex((m) => confrontabile(m) === confrontabile(n)) === k);
    const brani = esistente.brani.map((b, j) => (j === i ? { ...b, nome, altri } : b));
    await scrivi({ ...esistente, brani }, esistente.riga, email);
    return { ok: true, messaggio: `Parte rinominata: «${nome}».`, id: esistente.id };
  }
  if (azione === 'togli-traccia' && esistente) {
    const sezione = String(f.get('sezione') ?? '');
    await scrivi({ ...esistente, tracce: esistente.tracce.filter((t) => t.sezione !== sezione) }, esistente.riga, email);
    return { ok: true, messaggio: `Traccia «${sezione}» tolta dall'opera (il file resta su Drive).`, id: esistente.id };
  }
  if (azione === 'togli-traccia-parte' && esistente) {
    const i = Number(f.get('indice'));
    const sezione = String(f.get('sezione') ?? '');
    const brano = esistente.brani[i];
    if (!brano) return { ok: false, messaggio: 'Parte non trovata: ricarica la pagina.', id: esistente.id };
    const brani = esistente.brani.map((b, j) => (j === i ? { ...b, tracce: b.tracce.filter((x) => x.sezione !== sezione) } : b));
    await scrivi({ ...esistente, brani }, esistente.riga, email);
    return { ok: true, messaggio: `Traccia «${sezione}» tolta da «${brano.nome}» (il file resta su Drive).`, id: esistente.id };
  }
  if (azione === 'togli-spartito' && esistente) {
    await scrivi({ ...esistente, spartito: undefined }, esistente.riga, email);
    return { ok: true, messaggio: 'Spartito tolto dall\'opera (il file resta su Drive).', id: esistente.id };
  }
  if (azione !== 'salva') return { ok: false, messaggio: 'Azione sconosciuta.' };

  const titolo = String(f.get('titolo') ?? '').trim().slice(0, 140);
  if (!titolo) return { ok: false, messaggio: 'Manca il titolo.' };
  const stato = STATI.includes(f.get('stato') as (typeof STATI)[number]) ? String(f.get('stato')) : STATI[0];
  const pezzo = {
    id: esistente?.id ?? randomBytes(4).toString('hex'),
    autore: scriviAutore(String(f.get('autore') ?? '')).slice(0, 100),
    titolo,
    arrangiatore: scriviAutore(String(f.get('arrangiatore') ?? '')).slice(0, 100),
    stato,
    spartito: esistente?.spartito,
    brani: esistente?.brani ?? [],
    tracce: TRACCE.map((sezione) => ({ sezione, link: link(f.get(`tracce-${sezione}`)) })).filter((x) => x.link),
    esecuzione: link(f.get('esecuzione')) || undefined,
    note: testoLungo(f.get('note')),
    cartella: esistente?.cartella,
    nomiPrima: esistente?.nomiPrima ?? [],
  };
  await scrivi(pezzo, esistente?.riga, email);
  // Raccolte scelte con le caselle (solo se il modulo le mostrava): il pezzo nuovo va in fondo
  if (f.has('raccolte-nel-modulo')) {
    const scelte = new Set(f.getAll('raccolta').map(String));
    for (const r of raccolte) {
      const dentro = r.contenuto.includes(pezzo.id);
      if (scelte.has(r.id) === dentro) continue;
      await scriviRaccolta({ ...r, contenuto: dentro ? r.contenuto.filter((x) => x !== pezzo.id) : [...r.contenuto, pezzo.id] }, r.riga, email);
    }
  }
  return { ok: true, messaggio: esistente ? `«${nomeCompleto(pezzo)}» aggiornato.` : `«${nomeCompleto(pezzo)}» aggiunto al repertorio.`, id: pezzo.id };
}

// Il Maestro scrive solo le sue note sull'esecuzione di un pezzo (/maestro/repertorio)
export async function salvaNote(f: FormData, email: string): Promise<{ ok: boolean; messaggio: string }> {
  const pezzo = (await repertorio()).find((p) => p.id === String(f.get('id') ?? ''));
  if (!pezzo) return { ok: false, messaggio: 'Pezzo non trovato: ricarica la pagina.' };
  await scrivi({ ...pezzo, note: testoLungo(f.get('note')) }, pezzo.riga, email);
  return { ok: true, messaggio: `Note su «${nomeCompleto(pezzo)}» salvate.` };
}

// Per le pagine: esegue l'azione e restituisce dove tornare
export async function dopoIlModulo(request: Request, email: string, percorso: string) {
  const f = await request.formData();
  const azione = String(f.get('azione') ?? '');
  const r = await gestisci(f, email).catch((e) => ({ ok: false, messaggio: `Non è stato possibile salvare. ${spiegaTesto(e)}`, id: undefined }) as Esito);
  const p = new URLSearchParams({ esito: r.messaggio, ok: r.ok ? '1' : '0' });
  const id = r.id ?? (!azione.startsWith('cancella') ? String(f.get('id') ?? '') : '');
  // Dopo "Salva" si torna all'elenco (a un pezzo nuovo si propone di caricare i file); dopo "Togli"
  // di un file, o se il salvataggio non è riuscito, si resta nel modulo
  if (azione === 'salva-raccolta' && r.ok) return `${percorso}?${p}#r-${id}`;
  if (azione === 'salva-raccolta' && !id) p.set('nuova-raccolta', '');
  if (azione === 'salva' && r.ok) {
    if (!f.get('id') && id) p.set('file', id);
    return `${percorso}?${p}${id ? `#p-${id}` : ''}`;
  }
  if (id) p.set('modifica', id);
  return `${percorso}?${p}`;
}

// ——— File su Drive ———

// Endpoint dei file (/admin/repertorio/file): il file va nella cartella dell'opera in Spartiti
// ("Autore – Titolo", creata se manca) e poi diventa lo spartito dell'opera (al posto del precedente,
// che resta su Drive), una parte in più, con il nome del file, la traccia di studio di una sezione
// (al posto del link o del file di prima) o quella di una parte (uso "traccia-parte", con il nome
// della parte: l'indice potrebbe cambiare durante il caricamento).
const nomeTraccia = (sezione: string, nome: string, parte?: string) => `Traccia ${sezione} – ${parte ? `${parte} – ` : ''}${nome}`;
export const rispondiFile = (request: Request, email: string) => rispondiCaricamento(request, async (d) => {
  if (!configurato()) throw new Error('manca la variabile DRIVE_CARTELLA_SPARTITI sul server');
  const pezzo = (await repertorio()).find((p) => p.id === String(d.pezzo));
  if (!pezzo) throw new Error('pezzo non trovato');
  const cartella = pezzo.cartella ?? (await cartellaIn(DRIVE_CARTELLA_SPARTITI!, nomeCompleto(pezzo)));
  if (cartella !== pezzo.cartella) await scrivi({ ...pezzo, cartella }, pezzo.riga, email);
  if (d.uso === 'traccia' || d.uso === 'traccia-parte') {
    const sezione = TRACCE.find((s) => s === d.sezione);
    if (!sezione) throw new Error('sezione della traccia non valida');
    if (d.uso === 'traccia') return { cartella, nome: nomeTraccia(sezione, String(d.nome)), dopo: { pezzo: pezzo.id, uso: 'traccia', sezione } };
    const parte = pezzo.brani.find((b) => b.nome === String(d.parte));
    if (!parte) throw new Error('parte dell\'opera non trovata: ricarica la pagina');
    return { cartella, nome: nomeTraccia(sezione, String(d.nome), parte.nome), dopo: { pezzo: pezzo.id, uso: 'traccia-parte', sezione, parte: parte.nome } };
  }
  return { cartella, nome: d.nome, dopo: { pezzo: pezzo.id, uso: d.uso === 'spartito' ? 'spartito' : 'brano' } };
}, async (idFile, nome, dopo) => {
  const pezzo = (await repertorio()).find((p) => p.id === dopo.pezzo);
  if (!pezzo) throw new Error('pezzo non trovato');
  const conTraccia = (tracce: Traccia[]) => TRACCE.map((sezione) => ({ sezione, link: sezione === dopo.sezione ? linkFile(idFile) : tracce.find((t) => t.sezione === sezione)?.link ?? '' })).filter((t) => t.link);
  if (dopo.uso === 'traccia') await scrivi({ ...pezzo, tracce: conTraccia(pezzo.tracce) }, pezzo.riga, email);
  else if (dopo.uso === 'traccia-parte') {
    if (!pezzo.brani.some((b) => b.nome === dopo.parte)) throw new Error('parte dell\'opera non trovata: forse è stata rinominata durante il caricamento');
    await scrivi({ ...pezzo, brani: pezzo.brani.map((b) => (b.nome === dopo.parte ? { ...b, tracce: conTraccia(b.tracce) } : b)) }, pezzo.riga, email);
  } else if (dopo.uso === 'spartito') await scrivi({ ...pezzo, spartito: linkFile(idFile) }, pezzo.riga, email);
  else {
    const nomeNuovo = nomeParte(nome.replace(/\.[a-z0-9]{2,4}$/i, '')) || 'Parte';
    await scrivi({ ...pezzo, brani: [...pezzo.brani, { nome: nomeNuovo, link: linkFile(idFile), tracce: [] }] }, pezzo.riga, email);
  }
});
