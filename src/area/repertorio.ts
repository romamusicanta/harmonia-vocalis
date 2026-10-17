// Repertorio dell'area coristi: scheda "Repertorio" del foglio "Coristi e assenze" (la crea il
// sito), una riga per opera o per raccolta, la scheda "File del repertorio" (una riga per spartito
// o traccia) e i file su Drive in Spartiti/<Autore – Titolo>/ (cartella DRIVE_CARTELLA_SPARTITI del
// Drive condiviso). Lo gestiscono i redattori (/admin/repertorio) e il Maestro (/maestro/repertorio,
// solo le note); scrive tutto l'account di servizio, che sulla cartella Spartiti è Gestore contenuti.
//
// Due tipi di riga nella scheda Repertorio (dal 13/10/2026, colonna "Tipo"; vuota = Opera):
// - Opera: un pezzo del repertorio, anche breve (Ave Verum) o in più brani (Petite Messe), con
//   arrangiatore, esecuzione di riferimento, note del Maestro e i suoi **brani** (colonna "Brani":
//   un brano per riga, "Nome | nome di prima | …").
// - Raccolta: una cartella di pezzi (Canti natalizi, Brani per i bis): titolo, nota e i pezzi
//   (colonna "Contenuto": gli ID delle opere, uno per riga). Un pezzo può stare in più raccolte.
//   Prima del 13/10/2026 le raccolte erano opere «AA. VV.» con i pezzi come brani: i nomi con cui
//   prove e convocazioni li citavano stanno nella colonna "Nomi di prima" del pezzo.
//
// Dal 17/10/2026 (decisione di Mario) brani, spartiti e tracce sono tre elenchi indipendenti:
// - i **brani** sono la struttura musicale (Kyrie, Gloria…), quelli che citano prove e convocazioni
//   ("Autore – Titolo › Brano"); non sono file;
// - gli **spartiti** (righe Tipo = Spartito della scheda File del repertorio) sono i file, con un
//   titolo e i brani che contengono, ognuno con la pagina dove comincia (facoltativa): spartito
//   unico, uno per brano, un misto, o volumi che non corrispondono ai brani;
// - le **tracce di studio** (Tipo = Traccia) sono a gruppi con un titolo ("Kyrie – lento",
//   "Opera intera"), facoltativamente legati a dei brani, con un file (o un link) per ogni voce,
//   anche divisa (Soprani I e II, Baritoni e Bassi: src/area/voci.ts); un gruppo è l'insieme delle
//   tracce dello stesso pezzo con lo stesso titolo.
// Prima c'erano uno spartito per opera (colonna "Spartito"), le parti con il loro spartito ("Brani
// separati", "Nome | link | nomi di prima") e le tracce per sezione dell'opera ("Tracce <sezione>")
// e delle parti ("Tracce delle parti", "Parte | Sezione | link"): catalogo() li legge ancora come
// spartiti, brani e gruppi di tracce, e la prima scrittura di quel pezzo li sposta davvero nella
// scheda File del repertorio, svuotando le colonne vecchie (stessi ID, così le azioni sui file
// funzionano anche prima).
// I file si caricano a pezzi da 3,5 MB attraverso il sito (le funzioni di Vercel accettano al più
// 4,5 MB per richiesta), con il caricamento "resumable" di Drive (src/area/drive.ts).
import { randomBytes } from 'node:crypto';
import { DRIVE_CARTELLA_SPARTITI } from 'astro:env/server';
import { adesso, aggiungiRighe, cancellaRiga, cancellaRighe, idScheda, leggiScheda, scriviRiga, SEZIONI } from './dati';
import { cartellaIn, linkFile, rispondiCaricamento } from './drive';
import { spiegaTesto } from './errori';
import { catalogoVoci, ordineVoce, type Voce } from './voci';
import { confronta, perAutore } from '../motore/autori';

const SCHEDA = 'Repertorio';
const SCHEDA_FILE = 'File del repertorio';
export const STATI = ['In studio', 'In repertorio'] as const;
const TRACCE_VECCHIE = [...SEZIONI, 'Tutte le voci'];
// Le colonne nuove sempre in fondo (idScheda le aggiunge all'intestazione delle schede già create)
const COLONNE = ['ID', 'Autore', 'Titolo', 'Stato', 'Spartito', 'Brani separati', ...TRACCE_VECCHIE.map((t) => `Tracce ${t}`), 'Esecuzione di riferimento', 'Note del Maestro', 'Cartella', 'Aggiornato il', 'Aggiornato da', 'Tipo', 'Arrangiatore', 'Contenuto', 'Tracce delle parti', 'Nomi di prima', 'Brani'];
const COLONNE_FILE = ['ID', 'Pezzo', 'Tipo', 'Titolo', 'Voce', 'Sezione', 'Brani', 'Link', 'Caricato il', 'Caricato da'];

export const configurato = () => Boolean(DRIVE_CARTELLA_SPARTITI);

// Un brano dell'opera. altri: i nomi che aveva prima di essere rinominato, perché le prove e le
// convocazioni che lo nominano così lo ritrovino
export interface Brano { nome: string; altri: string[] }
export interface BranoNelloSpartito { nome: string; pagina?: number }
export interface Spartito { id: string; titolo: string; link: string; brani: BranoNelloSpartito[] }
export interface Traccia { id: string; voce: string; sezione: string; link: string }
export interface GruppoTracce { titolo: string; brani: string[]; tracce: Traccia[] }
// Una riga della scheda File del repertorio (riga assente: ricavata dalle colonne vecchie)
export interface RigaFile { id: string; riga?: number; pezzo: string; tipo: 'Spartito' | 'Traccia'; titolo: string; voce: string; sezione: string; brani: BranoNelloSpartito[]; link: string }
export interface Pezzo {
  riga: number;
  id: string;
  autore: string;
  titolo: string;
  arrangiatore: string;
  stato: string;
  brani: Brano[];
  spartiti: Spartito[];
  tracce: GruppoTracce[];
  file: RigaFile[];                  // le righe da cui vengono spartiti e tracce
  daConvertire: boolean;             // ha ancora dati nelle colonne vecchie (vedi in testa)
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
  contenuto: string[];               // ID dei pezzi (solo quelli che esistono), per autore come il repertorio
  aggiornato: string;
}

export const nomeCompleto = (p: Pick<Pezzo, 'autore' | 'titolo'>) => [p.autore, p.titolo].filter(Boolean).join(' – ');

// Prove e convocazioni nominano i pezzi con "Autore – Titolo" (il solo titolo non basta: due
// Magnificat di autori diversi); valgono ancora i nomi scritti prima del 3/10/2026, con il solo
// titolo, e quelli di prima delle raccolte ("AA. VV. – Canti natalizi › Stille Nacht"). Si
// confrontano senza spazi, punteggiatura e accenti ("C.P.E. Bach" = "C. P. E. Bach").
export const confrontabile = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export function trovaPezzo<T extends Pick<Pezzo, 'autore' | 'titolo'> & { nomiPrima?: string[] }>(pezzi: T[], nome: string): T | undefined {
  const n = confrontabile(nome);
  return pezzi.find((p) => confrontabile(nomeCompleto(p)) === n)
    ?? pezzi.find((p) => p.nomiPrima?.some((x) => confrontabile(x) === n))
    ?? pezzi.find((p) => confrontabile(p.titolo) === n);
}

// Un brano di un'opera si nomina "Autore – Titolo › Brano": in una prova si può chiedere di
// preparare solo quello (dal 6/10/2026)
export const SEPARATORE_BRANO = ' › ';
export const nomeBrano = (p: Pick<Pezzo, 'autore' | 'titolo'>, b: Pick<Brano, 'nome'>) => `${nomeCompleto(p)}${SEPARATORE_BRANO}${b.nome}`;
const stessoBrano = (b: Brano, nome: string) => [b.nome, ...b.altri].some((n) => confrontabile(n) === confrontabile(nome));
export function trovaVoce<T extends Pick<Pezzo, 'autore' | 'titolo' | 'brani'> & { nomiPrima?: string[] }>(pezzi: T[], nome: string): { pezzo: T; brano?: Brano } | undefined {
  const pezzo = trovaPezzo(pezzi, nome);
  if (pezzo) return { pezzo };
  const i = nome.lastIndexOf(SEPARATORE_BRANO.trim());
  if (i < 0) return undefined;
  const opera = trovaPezzo(pezzi, nome.slice(0, i));
  const brano = opera?.brani.find((x) => stessoBrano(x, nome.slice(i + 1)));
  return opera && brano ? { pezzo: opera, brano } : undefined;
}

// Lo spartito da aprire per un brano: quello che ne contiene meno (lo spartito del solo brano prima
// della partitura completa), alla pagina dove il brano comincia
export function spartitoDi(p: Pick<Pezzo, 'spartiti'>, brano: string): { spartito: Spartito; pagina?: number } | undefined {
  const n = confrontabile(brano);
  const conIl = p.spartiti.filter((s) => s.brani.some((b) => confrontabile(b.nome) === n));
  const s = conIl.sort((a, b) => a.brani.length - b.brani.length)[0];
  return s && { spartito: s, pagina: s.brani.find((b) => confrontabile(b.nome) === n)?.pagina };
}
// Il link di uno spartito a una pagina (il visore dell'app e i lettori PDF dei browser lo capiscono)
export const allaPagina = (link: string, pagina?: number) => (pagina && pagina > 1 ? `${link}#page=${pagina}` : link);

// Le voci aggiunte dai redattori sono quelle già usate nelle tracce
export const vociDi = (pezzi: Pick<Pezzo, 'tracce'>[]) => catalogoVoci(pezzi.flatMap((p) => p.tracce.flatMap((g) => g.tracce.map((t) => ({ nome: t.voce, sezione: t.sezione })))));

const righe = (v = '') => v.split('\n').map((r) => r.trim()).filter(Boolean);
const aBrani = (v = '') => righe(v).map((r) => r.split(' | ').map((x) => x.trim())).filter(([n]) => n).map(([nome, ...altri]) => ({ nome, altri: altri.filter(Boolean) }));
const daBrani = (b: Brano[]) => b.map((x) => [x.nome, ...x.altri].join(' | ')).join('\n');
// Nella colonna Brani di un file: "Nome | pagina", un brano per riga
const aBraniFile = (v = '') => righe(v).map((r) => r.split(' | ')).map(([nome, pagina]) => ({ nome: nome.trim(), pagina: Number(pagina) > 0 ? Math.floor(Number(pagina)) : undefined }));
const daBraniFile = (b: BranoNelloSpartito[]) => b.map((x) => (x.pagina ? `${x.nome} | ${x.pagina}` : x.nome)).join('\n');

// Le colonne vecchie di un'opera come brani e righe di file (vedi in testa), con ID fissi
function vecchi(r: Record<string, string>, pezzo: string) {
  const brani: Brano[] = [];
  const file: RigaFile[] = [];
  const parti = righe(r['Brani separati']).map((x) => x.split(' | ').map((y) => y.trim())).filter(([n]) => n);
  if (r['Spartito']) file.push({ id: `${pezzo}-s`, pezzo, tipo: 'Spartito', titolo: parti.length ? 'Spartito completo' : 'Spartito', voce: '', sezione: '', brani: [], link: r['Spartito'] });
  parti.forEach(([nome, link, ...altri], i) => {
    brani.push({ nome, altri: altri.filter(Boolean) });
    if (link) file.push({ id: `${pezzo}-b${i}`, pezzo, tipo: 'Spartito', titolo: nome, voce: '', sezione: '', brani: [{ nome }], link });
  });
  TRACCE_VECCHIE.forEach((s, i) => {
    const link = r[`Tracce ${s}`];
    if (link) file.push({ id: `${pezzo}-t${i}`, pezzo, tipo: 'Traccia', titolo: 'Opera intera', voce: s, sezione: SEZIONI.includes(s) ? s : '', brani: [], link });
  });
  righe(r['Tracce delle parti']).map((x) => x.split(' | ').map((y) => y.trim())).filter((x) => x.length >= 3 && x[2]).forEach(([parte, s, link], i) => {
    file.push({ id: `${pezzo}-p${i}`, pezzo, tipo: 'Traccia', titolo: parte, voce: s, sezione: SEZIONI.includes(s) ? s : '', brani: [{ nome: parte }], link });
  });
  return { brani, file };
}

// Spartiti e gruppi di tracce di un pezzo dalle sue righe di file, nell'ordine in cui sono state
// aggiunte; le voci di un gruppo nell'ordine del catalogo
function materiali(file: RigaFile[], voci: Voce[]) {
  const spartiti: Spartito[] = file.filter((f) => f.tipo === 'Spartito').map((f) => ({ id: f.id, titolo: f.titolo || 'Spartito', link: f.link, brani: f.brani }));
  const tracce: GruppoTracce[] = [];
  for (const f of file.filter((x) => x.tipo === 'Traccia')) {
    const titolo = f.titolo || 'Tracce';
    let g = tracce.find((x) => confrontabile(x.titolo) === confrontabile(titolo));
    if (!g) tracce.push((g = { titolo, brani: f.brani.map((b) => b.nome), tracce: [] }));
    g.tracce.push({ id: f.id, voce: f.voce, sezione: f.sezione, link: f.link });
  }
  for (const g of tracce) g.tracce.sort((a, b) => ordineVoce(a.voce, voci) - ordineVoce(b.voce, voci));
  return { spartiti, tracce };
}

// "W.A.  Mozart" → "W. A. Mozart"
const scriviAutore = (v: string) => v.trim().replace(/\s+/g, ' ').replace(/(\p{Lu})\.(?=\S)/gu, '$1. ');

export async function catalogo(): Promise<{ pezzi: Pezzo[]; raccolte: Raccolta[] }> {
  await Promise.all([idScheda(SCHEDA, COLONNE), idScheda(SCHEDA_FILE, COLONNE_FILE)]);
  const [tutte, righeFile] = await Promise.all([leggiScheda(SCHEDA), leggiScheda(SCHEDA_FILE)]);
  const opere = tutte.filter((r) => r['ID'] && r['Titolo']);
  const nuovi: RigaFile[] = righeFile.filter((r) => r['ID'] && r['Pezzo'] && r['Link']).map((r) => ({
    id: r['ID'], riga: r.riga, pezzo: r['Pezzo'], tipo: r['Tipo'] === 'Traccia' ? 'Traccia' : 'Spartito',
    titolo: r['Titolo'], voce: r['Voce'], sezione: SEZIONI.includes(r['Sezione']) ? r['Sezione'] : '', brani: aBraniFile(r['Brani']), link: r['Link'],
  }));
  const base = opere.filter((r) => r['Tipo'] !== 'Raccolta').map((r) => {
    const v = vecchi(r, r['ID']);
    const brani = r['Brani'] ? aBrani(r['Brani']) : v.brani;
    const file = [...v.file, ...nuovi.filter((f) => f.pezzo === r['ID'])];
    return { r, brani, file, daConvertire: v.file.length > 0 || (!r['Brani'] && v.brani.length > 0) };
  });
  const voci = catalogoVoci(base.flatMap((b) => b.file.filter((f) => f.tipo === 'Traccia').map((f) => ({ nome: f.voce, sezione: f.sezione }))));
  const pezzi: Pezzo[] = base.map(({ r, brani, file, daConvertire }) => ({
    riga: r.riga,
    id: r['ID'],
    autore: r['Autore'],
    titolo: r['Titolo'],
    arrangiatore: r['Arrangiatore'] ?? '',
    stato: r['Stato'] || STATI[0],
    brani,
    ...materiali(file, voci),
    file,
    daConvertire,
    esecuzione: r['Esecuzione di riferimento'] || undefined,
    note: r['Note del Maestro'],
    cartella: r['Cartella'] || undefined,
    nomiPrima: righe(r['Nomi di prima']),
    raccolte: [],
    aggiornato: r['Aggiornato il'],
  }));
  const ids = new Set(pezzi.map((p) => p.id));
  const raccolte: Raccolta[] = opere.filter((r) => r['Tipo'] === 'Raccolta').map((r) => ({
    riga: r.riga,
    id: r['ID'],
    titolo: r['Titolo'],
    note: r['Note del Maestro'],
    contenuto: [...new Set(righe(r['Contenuto']))].filter((id) => ids.has(id)),
    aggiornato: r['Aggiornato il'],
  })).sort((a, b) => confronta(a.titolo, b.titolo));
  // Dentro una raccolta i pezzi stanno in ordine di autore, come nel resto del repertorio (dal
  // 14/10/2026, richiesta di Mario; prima nell'ordine scelto con le frecce)
  pezzi.sort(perAutore);
  const posto = new Map(pezzi.map((p, i) => [p.id, i]));
  for (const r of raccolte) r.contenuto.sort((a, b) => posto.get(a)! - posto.get(b)!);
  for (const p of pezzi) p.raccolte = raccolte.filter((r) => r.contenuto.includes(p.id)).map((r) => r.id);
  return { pezzi, raccolte };
}

// Le opere (i pezzi), senza le raccolte: è quello che serve a prove, convocazioni e bacheca
export const repertorio = async () => (await catalogo()).pezzi;

// Il testo si scrive come testo (apostrofo iniziale): niente formule né date interpretate, e niente
// numeri: un ID come «658e1234» diventerebbe 6,58E+08 (successo il 13/10/2026)
const t = (v?: string) => (v ? `'${v}` : '');

const valoriFile = (f: RigaFile, da: string) => [t(f.id), t(f.pezzo), f.tipo, t(f.titolo), t(f.voce), t(f.sezione), t(daBraniFile(f.brani)), t(f.link), adesso(), da];
const scriviFile = (f: RigaFile, da: string) => scriviRiga(SCHEDA_FILE, valoriFile(f, da), f.riga);

// La riga di un'opera. Le colonne vecchie si svuotano: se il pezzo aveva ancora dati lì, prima
// diventano righe della scheda File del repertorio, con gli stessi ID
async function scrivi(p: Omit<Pezzo, 'riga' | 'aggiornato' | 'raccolte' | 'spartiti' | 'tracce'>, riga: number | undefined, da: string) {
  const daSpostare = p.file.filter((f) => !f.riga);
  if (daSpostare.length) await aggiungiRighe(SCHEDA_FILE, daSpostare.map((f) => valoriFile(f, da)));
  await scriviRiga(SCHEDA, [t(p.id), t(p.autore), t(p.titolo), p.stato, '', '', ...TRACCE_VECCHIE.map(() => ''), t(p.esecuzione), t(p.note), p.cartella ?? '', adesso(), da,
    'Opera', t(p.arrangiatore), '', '', t(p.nomiPrima.join('\n')), t(daBrani(p.brani))], riga);
}
async function scriviRaccolta(r: Omit<Raccolta, 'riga' | 'aggiornato'>, riga: number | undefined, da: string) {
  await scriviRiga(SCHEDA, [t(r.id), '', t(r.titolo), '', '', '', ...TRACCE_VECCHIE.map(() => ''), '', t(r.note), '', adesso(), da,
    'Raccolta', '', t(r.contenuto.join('\n')), '', '', ''], riga);
}
// Prima di toccare i file di un pezzo con dati nelle colonne vecchie: si spostano e si rilegge
async function convertito(p: Pezzo, da: string): Promise<Pezzo> {
  if (!p.daConvertire) return p;
  await scrivi(p, p.riga, da);
  return (await repertorio()).find((x) => x.id === p.id) ?? p;
}

const link = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (!/^https?:\/\/\S+$/.test(s)) throw new Error(`«${s.slice(0, 60)}» non è un indirizzo web (deve iniziare con https://)`);
  return s;
};
const testoLungo = (v: FormDataEntryValue | null) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, 4000);
// " | " separa i campi nel foglio, "›" separa opera e brano nelle prove
const nomeParte = (v: FormDataEntryValue | null | string) => String(v ?? '').replace(/\s*\|\s*/g, ' - ').replace(/›/g, '-').replace(/\s+/g, ' ').trim().slice(0, 140);
const senzaEstensione = (nome: string) => nome.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_]+/g, ' ');

// La voce scelta in un modulo: una del catalogo, oppure una nuova ("altra") con nome e sezione
function voceDa(nome: string, nuova: string, sezione: string, voci: Voce[]): Voce {
  if (nome !== 'altra') {
    const v = voci.find((x) => x.nome === nome);
    if (!v) throw new Error('voce della traccia non valida: ricarica la pagina');
    return v;
  }
  const n = nomeParte(nuova).slice(0, 40);
  if (!n) throw new Error('manca il nome della voce nuova');
  const esiste = voci.find((x) => confrontabile(x.nome) === confrontabile(n));
  return esiste ?? { nome: n, sezione: SEZIONI.includes(sezione) ? sezione : '' };
}
const voceDalModulo = (f: FormData, voci: Voce[]) => voceDa(String(f.get('voce') ?? ''), String(f.get('voce-nuova') ?? ''), String(f.get('sezione-nuova') ?? ''), voci);
// I brani scelti con le caselle (valore = indice nell'opera), con la pagina se scritta
const braniDalModulo = (f: FormData, p: Pezzo): BranoNelloSpartito[] => [...new Set(f.getAll('brano').map(Number))].filter((i) => p.brani[i]).sort((a, b) => a - b)
  .map((i) => ({ nome: p.brani[i].nome, pagina: Number(f.get(`pagina-${i}`)) > 0 ? Math.floor(Number(f.get(`pagina-${i}`))) : undefined }));
const gruppoDi = (p: Pezzo, titolo: string) => p.file.filter((x) => x.tipo === 'Traccia' && confrontabile(x.titolo || 'Tracce') === confrontabile(titolo));

type Esito = { ok: boolean; messaggio: string; id?: string; ancora?: string };

// Modulo del repertorio (POST). Opere: azione=salva (id per modificare), cancella; brani:
// aggiungi-brani (testo, uno per riga), rinomina-brano (indice, nome), sposta-brano (indice,
// verso), togli-brano (indice); spartiti: salva-spartito (file, titolo, brano/pagina-<indice>);
// tracce: salva-gruppo (gruppo, titolo, brano), togli-gruppo (gruppo), cambia-voce (file, voce),
// aggiungi-link (gruppo, brano, voce, link); togli-file (file). Raccolte: salva-raccolta,
// cancella-raccolta.
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

  const trovato = id ? pezzi.find((p) => p.id === id) : undefined;
  if (id && !trovato) return { ok: false, messaggio: 'Pezzo non trovato: forse è stato cancellato.' };

  if (azione === 'cancella' && trovato) {
    // Prima si toglie dalle raccolte (scrivere non sposta le righe), poi si cancellano le righe dei
    // suoi file e la sua
    for (const r of raccolte.filter((x) => x.contenuto.includes(trovato.id))) await scriviRaccolta({ ...r, contenuto: r.contenuto.filter((x) => x !== trovato.id) }, r.riga, email);
    await cancellaRighe(SCHEDA_FILE, trovato.file.map((x) => x.riga).filter((x): x is number => Boolean(x)));
    await cancellaRiga(SCHEDA, trovato.riga);
    return { ok: true, messaggio: `«${nomeCompleto(trovato)}» tolto dal repertorio. I file restano su Drive, nella sua cartella.` };
  }

  if (azione === 'salva') {
    const titolo = String(f.get('titolo') ?? '').trim().slice(0, 140);
    if (!titolo) return { ok: false, messaggio: 'Manca il titolo.' };
    const stato = STATI.includes(f.get('stato') as (typeof STATI)[number]) ? String(f.get('stato')) : STATI[0];
    const pezzo = {
      id: trovato?.id ?? randomBytes(4).toString('hex'),
      autore: scriviAutore(String(f.get('autore') ?? '')).slice(0, 100),
      titolo,
      arrangiatore: scriviAutore(String(f.get('arrangiatore') ?? '')).slice(0, 100),
      stato,
      brani: trovato?.brani ?? [],
      file: trovato?.file ?? [],
      daConvertire: false,
      esecuzione: link(f.get('esecuzione')) || undefined,
      note: testoLungo(f.get('note')),
      cartella: trovato?.cartella,
      nomiPrima: trovato?.nomiPrima ?? [],
    };
    await scrivi(pezzo, trovato?.riga, email);
    // Raccolte scelte con le caselle (solo se il modulo le mostrava): il pezzo nuovo va in fondo
    if (f.has('raccolte-nel-modulo')) {
      const scelte = new Set(f.getAll('raccolta').map(String));
      for (const r of raccolte) {
        const dentro = r.contenuto.includes(pezzo.id);
        if (scelte.has(r.id) === dentro) continue;
        await scriviRaccolta({ ...r, contenuto: dentro ? r.contenuto.filter((x) => x !== pezzo.id) : [...r.contenuto, pezzo.id] }, r.riga, email);
      }
    }
    return { ok: true, messaggio: trovato ? `«${nomeCompleto(pezzo)}» aggiornato.` : `«${nomeCompleto(pezzo)}» aggiunto al repertorio.`, id: pezzo.id };
  }
  if (!trovato) return { ok: false, messaggio: 'Azione sconosciuta.' };

  // Da qui si toccano brani e file: prima i dati delle colonne vecchie diventano righe vere
  const p = await convertito(trovato, email);
  const esito = (messaggio: string, ancora: string, ok = true): Esito => ({ ok, messaggio, id: p.id, ancora });
  const salvaBrani = (brani: Brano[]) => scrivi({ ...p, brani }, p.riga, email);
  // I file che nominano un brano (rinominato o tolto): cambia = nuovo nome, undefined = si toglie
  const aggiornaFile = async (nome: string, cambia?: string) => {
    for (const x of p.file.filter((y) => y.brani.some((b) => confrontabile(b.nome) === confrontabile(nome)))) {
      const brani = x.brani.flatMap((b) => (confrontabile(b.nome) !== confrontabile(nome) ? [b] : cambia ? [{ ...b, nome: cambia }] : []));
      await scriviFile({ ...x, brani }, email);
    }
  };

  if (azione === 'aggiungi-brani') {
    const nuovi = righe(String(f.get('testo') ?? '')).map(nomeParte).filter(Boolean);
    const brani = [...p.brani];
    for (const nome of nuovi) if (!brani.some((b) => stessoBrano(b, nome))) brani.push({ nome, altri: [] });
    const aggiunti = brani.length - p.brani.length;
    if (!aggiunti) return esito(nuovi.length ? 'Quei brani ci sono già.' : 'Scrivi il nome di almeno un brano.', 'brani', false);
    await salvaBrani(brani);
    return esito(aggiunti === 1 ? 'Brano aggiunto.' : `${aggiunti} brani aggiunti.`, 'brani');
  }
  const i = Number(f.get('indice'));
  const brano = p.brani[i];
  if (azione === 'rinomina-brano' || azione === 'togli-brano' || azione === 'sposta-brano') {
    if (!brano) return esito('Brano non trovato: ricarica la pagina.', 'brani', false);
    if (azione === 'togli-brano') {
      await salvaBrani(p.brani.filter((_, j) => j !== i));
      await aggiornaFile(brano.nome);
      return esito(`Brano «${brano.nome}» tolto. Spartiti e tracce restano.`, 'brani');
    }
    if (azione === 'sposta-brano') {
      const j = i + (Number(f.get('verso')) < 0 ? -1 : 1);
      if (!p.brani[j]) return esito('Il brano è già lì.', 'brani');
      const brani = [...p.brani];
      [brani[i], brani[j]] = [brani[j], brani[i]];
      await salvaBrani(brani);
      return esito(`«${brano.nome}» spostato.`, 'brani');
    }
    const nome = nomeParte(f.get('nome'));
    if (!nome) return esito('Manca il nome del brano.', 'brani', false);
    if (p.brani.some((b, j) => j !== i && confrontabile(b.nome) === confrontabile(nome))) return esito(`C'è già un brano «${nome}» in quest'opera.`, 'brani', false);
    // Il nome di prima resta tra quelli che il brano ha avuto: le prove che lo nominano lo ritrovano
    const altri = [...brano.altri, brano.nome].filter((n, k, tutti) => confrontabile(n) !== confrontabile(nome) && tutti.findIndex((m) => confrontabile(m) === confrontabile(n)) === k);
    await salvaBrani(p.brani.map((b, j) => (j === i ? { nome, altri } : b)));
    await aggiornaFile(brano.nome, nome);
    return esito(`Brano rinominato: «${nome}».`, 'brani');
  }

  const voci = vociDi(pezzi);
  const file = p.file.find((x) => x.id === String(f.get('file') ?? ''));
  if (azione === 'togli-file' || azione === 'salva-spartito' || azione === 'cambia-voce') {
    if (!file?.riga) return esito('File non trovato: ricarica la pagina.', 'file', false);
    const ancora = file.tipo === 'Spartito' ? 'spartiti' : 'tracce';
    if (azione === 'togli-file') {
      await cancellaRiga(SCHEDA_FILE, file.riga);
      return esito(`${file.tipo === 'Spartito' ? `Spartito «${file.titolo}»` : `Traccia ${file.voce} di «${file.titolo}»`} tolto dal pezzo. Se è un file, resta su Drive.`, ancora);
    }
    if (azione === 'salva-spartito') {
      const titolo = nomeParte(f.get('titolo')) || file.titolo;
      await scriviFile({ ...file, titolo, brani: braniDalModulo(f, p) }, email);
      return esito(`Spartito «${titolo}» salvato.`, ancora);
    }
    const v = voceDalModulo(f, voci);
    await scriviFile({ ...file, voce: v.nome, sezione: v.sezione }, email);
    return esito(`Traccia di «${file.titolo}»: ora è ${v.nome}.`, ancora);
  }

  const gruppo = String(f.get('gruppo') ?? '');
  if (azione === 'salva-gruppo' || azione === 'togli-gruppo') {
    const dentro = gruppoDi(p, gruppo);
    if (!dentro.length) return esito('Gruppo di tracce non trovato: ricarica la pagina.', 'tracce', false);
    if (azione === 'togli-gruppo') {
      await cancellaRighe(SCHEDA_FILE, dentro.map((x) => x.riga!));
      return esito(`Tracce «${gruppo}» tolte dal pezzo. I file restano su Drive.`, 'tracce');
    }
    const titolo = nomeParte(f.get('titolo')) || gruppo;
    const brani = braniDalModulo(f, p).map((b) => ({ nome: b.nome }));
    for (const x of dentro) await scriviFile({ ...x, titolo, brani }, email);
    return esito(`Tracce «${titolo}» salvate.`, 'tracce');
  }
  if (azione === 'aggiungi-link') {
    const titolo = nomeParte(f.get('gruppo')) || 'Tracce';
    const l = link(f.get('link'));
    if (!l) return esito('Manca il link.', 'tracce', false);
    const v = voceDalModulo(f, voci);
    const esistenti = gruppoDi(p, titolo);
    const brani = esistenti[0]?.brani ?? braniDalModulo(f, p).map((b) => ({ nome: b.nome }));
    await scriviFile({ id: randomBytes(4).toString('hex'), pezzo: p.id, tipo: 'Traccia', titolo: esistenti[0]?.titolo ?? titolo, voce: v.nome, sezione: v.sezione, brani, link: l }, email);
    return esito(`Link ${v.nome} aggiunto a «${titolo}».`, 'tracce');
  }
  return { ok: false, messaggio: 'Azione sconosciuta.', id: p.id };
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
  // Dopo "Salva" si torna all'elenco (a un pezzo nuovo si propone di caricare i file); dopo le
  // azioni su brani e file si resta nel modulo, al riquadro toccato
  if (azione === 'salva-raccolta' && r.ok) return `${percorso}?${p}#r-${id}`;
  if (azione === 'salva-raccolta' && !id) p.set('nuova-raccolta', '');
  if (azione === 'salva' && r.ok) {
    if (!f.get('id') && id) p.set('file', id);
    return `${percorso}?${p}${id ? `#p-${id}` : ''}`;
  }
  if (id) p.set('modifica', id);
  if (r.ancora) p.set('in', r.ancora);
  return `${percorso}?${p}${r.ancora ? `#${r.ancora}` : ''}`;
}

// ——— File su Drive ———

// Endpoint dei file (/admin/repertorio/file): il file va nella cartella dell'opera in Spartiti
// ("Autore – Titolo", creata se manca) e poi diventa uno spartito in più del pezzo (titolo dal nome
// del file; se il nome è quello di un brano, contiene quel brano) oppure una traccia del gruppo
// indicato (titolo, brani, voce: una del catalogo o una nuova con la sua sezione).
const nomeTraccia = (voce: string, titolo: string, nome: string) => `Traccia ${voce} – ${titolo} – ${nome}`;
export const rispondiFile = (request: Request, email: string) => rispondiCaricamento(request, async (d) => {
  if (!configurato()) throw new Error('manca la variabile DRIVE_CARTELLA_SPARTITI sul server');
  const pezzi = await repertorio();
  const trovato = pezzi.find((p) => p.id === String(d.pezzo));
  if (!trovato) throw new Error('pezzo non trovato');
  const pezzo = await convertito(trovato, email);
  const cartella = pezzo.cartella ?? (await cartellaIn(DRIVE_CARTELLA_SPARTITI!, nomeCompleto(pezzo)));
  if (cartella !== pezzo.cartella) await scrivi({ ...pezzo, cartella }, pezzo.riga, email);
  if (d.uso === 'traccia') {
    const v = voceDa(String(d.voce ?? ''), String(d.voceNuova ?? ''), String(d.sezioneNuova ?? ''), vociDi(pezzi));
    const titolo = nomeParte(String(d.titolo ?? '')) || 'Tracce';
    const brani = righe(String(d.brani ?? '')).filter((n) => pezzo.brani.some((b) => b.nome === n)).join('\n');
    return { cartella, nome: nomeTraccia(v.nome, titolo, d.nome), dopo: { pezzo: pezzo.id, uso: 'traccia', titolo, brani, voce: v.nome, sezione: v.sezione } };
  }
  return { cartella, nome: d.nome, dopo: { pezzo: pezzo.id, uso: 'spartito' } };
}, async (idFile, nome, dopo) => {
  const pezzo = (await repertorio()).find((p) => p.id === dopo.pezzo);
  if (!pezzo) throw new Error('pezzo non trovato');
  const id = randomBytes(4).toString('hex');
  if (dopo.uso === 'traccia') {
    // Un gruppo che c'è già tiene il suo titolo e i suoi brani
    const esistenti = gruppoDi(pezzo, dopo.titolo);
    const brani = esistenti[0]?.brani ?? righe(dopo.brani).map((n) => ({ nome: n }));
    await scriviFile({ id, pezzo: pezzo.id, tipo: 'Traccia', titolo: esistenti[0]?.titolo ?? dopo.titolo, voce: dopo.voce, sezione: dopo.sezione, brani, link: linkFile(idFile) }, email);
    return;
  }
  const titolo = nomeParte(senzaEstensione(nome)) || 'Spartito';
  const brano = pezzo.brani.find((b) => stessoBrano(b, titolo));
  await scriviFile({ id, pezzo: pezzo.id, tipo: 'Spartito', titolo: brano?.nome ?? titolo, voce: '', sezione: '', brani: brano ? [{ nome: brano.nome }] : [], link: linkFile(idFile) }, email);
});
