// Punto di accesso ai dati del coro: configurazione validata, immagini, modalità demo.
import configGrezza from '../../coro/coro.config';
import { schemaCoro } from './schema';
import inglese from '../../coro/coro.en';
import { applicaTestiCoro } from './testiSito';
import type { Lingua } from './lingua';

const esito = schemaCoro.safeParse(configGrezza);
if (!esito.success) {
  const righe = esito.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`coro/coro.config.ts non è valido:\n${righe}`);
}

export const coro = esito.data;

// I testi principali cambiati dall'Amministrazione (src/motore/testiSito.ts), in italiano e in inglese
applicaTestiCoro(coro, inglese);

// I coristi attuali per sezione, contati alla build dalla scheda Coristi (scripts/scarica-allegati.mjs,
// dal 18/10/2026): prendono il posto delle voci di coro.config.ts, che restano di riserva e per la demo
const fileOrganico = import.meta.glob<Record<string, number>>('/coro/immagini/drive/organico.json', { eager: true, import: 'default' });
const organicoVero = process.env.DEMO === '1' ? undefined : Object.values(fileOrganico)[0];
if (organicoVero) for (const s of coro.organico) if (typeof organicoVero[s.sezione] === 'number') s.voci = organicoVero[s.sezione];
// Il totale delle voci, anche per i numeri di Il coro (valore: 'voci')
export const totaleVoci = () => coro.organico.reduce((n, s) => n + s.voci, 0);

// Demo di vendita: pannello di scelta, area coristi aperta con dati di esempio, vesti alternative.
// Si attiva con DEMO=1 (npm run dev, npm run build:demo).
export const DEMO = process.env.DEMO === '1';

// Le immagini del coro stanno in coro/immagini e si indicano per nome di file. Prima della build
// scripts/scarica-allegati.mjs porta da Drive in coro/immagini/drive/ quelle allegate agli eventi
// del calendario ("drive/<id>.<ext>"), le foto del sito della cartella Sito/Foto ("drive/sito/…") e le
// foto dei concerti messe nel sito pubblico dai redattori ("drive/concerti/<data>/<id>.jpg").
const immagini = import.meta.glob<{ default: ImageMetadata }>('/coro/immagini/{*,drive/*,drive/sito/*,drive/maestro/*,drive/concerti/*/*}.{jpg,jpeg,png,webp,avif,svg}', { eager: true });

// Foto del sito: quelle della cartella Sito/Foto di Drive, se ci sono, al posto di coro.config.ts
const fotoDrive = (nome: string) => !DEMO ? Object.keys(immagini).find((k) => k.startsWith(`/coro/immagini/drive/sito/${nome}.`))?.slice('/coro/immagini/'.length) : undefined;
coro.foto.apertura = fotoDrive('apertura') ?? coro.foto.apertura;
coro.foto.coro = fotoDrive('coro') ?? coro.foto.coro;
coro.foto.prove = fotoDrive('prove') ?? coro.foto.prove;
coro.foto.accesso = fotoDrive('accesso') ?? fotoDrive('apertura') ?? coro.foto.accesso;
coro.maestro.foto = fotoDrive('maestro') ?? coro.maestro.foto;

export function immagine(nome: string) {
  const trovata = immagini[`/coro/immagini/${nome}`];
  if (!trovata) throw new Error(`Immagine non trovata in coro/immagini: ${nome}`);
  return trovata.default;
}

export const esisteImmagine = (nome: string) => `/coro/immagini/${nome}` in immagini;

// Le foto dei concerti messe nel sito pubblico (src/area/fotoConcerti.ts), dall'elenco scritto da
// scripts/scarica-allegati.mjs: data del concerto, ora del caricamento, scelta per la home, copertina.
// Senza elenco (build di prima del 13/10/2026), quelle presenti nelle cartelle, senza scelte
interface FotoPubblica { file: string; data: string; caricata?: string; home?: boolean; copertina?: boolean; ordineHome?: number }
const elencoFoto = import.meta.glob<FotoPubblica[]>('/coro/immagini/drive/concerti/elenco.json', { eager: true, import: 'default' });
const fotoPubbliche = (): FotoPubblica[] => {
  if (DEMO) return [];
  const elenco = Object.values(elencoFoto)[0];
  if (elenco) return elenco.filter((f) => `/coro/immagini/${f.file}` in immagini);
  return Object.keys(immagini)
    .map((k) => k.match(/^\/coro\/immagini\/(drive\/concerti\/(\d{4}-\d{2}-\d{2})\/[^/]+)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ file: m[1], data: m[2] }));
};
// Nell'ordine di un album: prima la copertina, poi nell'ordine in cui sono state caricate
const ordineAlbum = (a: FotoPubblica, b: FotoPubblica) => Number(Boolean(b.copertina)) - Number(Boolean(a.copertina)) || (a.caricata ?? a.file).localeCompare(b.caricata ?? b.file);

// Quante foto «Home» scorrono nel carosello della home (dal 13/10/2026, decisione di Mario): il browser le
// scarica tutte all'apertura, quindi poche. Le altre restano «Home» ma non si vedono
export const LIMITE_CAROSELLO = 10;

// Le foto scelte per la home (le più belle dei concerti), nell'ordine del carosello scelto dai redattori
// (ordineHome; quelle senza, dopo, dal concerto più recente), come nomi per immagine() con la data del
// concerto. Le stesse regole di fotoDelCarosello in src/area/fotoConcerti.ts
export const fotoInHome = () =>
  fotoPubbliche()
    .filter((f) => f.home)
    .sort((a, b) => (a.ordineHome ?? Infinity) - (b.ordineHome ?? Infinity) || b.data.localeCompare(a.data) || (b.caricata ?? '').localeCompare(a.caricata ?? ''))
    .map((f) => ({ nome: f.file, data: f.data }));

// Le foto del concerto di quel giorno (AAAA-MM-GG), copertina per prima, come nomi per immagine()
export const fotoDelConcerto = (data: string) => fotoPubbliche().filter((f) => f.data === data).sort(ordineAlbum).map((f) => f.file);

// La copertina scelta dai redattori tra le foto del concerto di quel giorno (la stella in Foto dei concerti)
export const copertinaDelConcerto = (data: string) => fotoPubbliche().find((f) => f.data === data && f.copertina)?.file;

// Il carosello della pagina «Il Maestro» (dal 13/10/2026, src/admin/fotoMaestro.ts): le foto scelte dai
// redattori, nel loro ordine, al più LIMITE_CAROSELLO, dall'elenco scritto da scripts/scarica-allegati.mjs
const elencoMaestro = import.meta.glob<string[]>('/coro/immagini/drive/maestro/elenco.json', { eager: true, import: 'default' });
export const fotoCaroselloMaestro = () =>
  DEMO ? [] : (Object.values(elencoMaestro)[0] ?? []).filter((f) => `/coro/immagini/${f}` in immagini).slice(0, LIMITE_CAROSELLO);

// Le foto dei capitoli della pagina «Il Coro» (dal 19/10/2026): quelle caricate in Foto del sito
// (Sito/Foto/capitolo-1 … capitolo-4); dove manca, una scelta automatica: la foto delle prove, poi le foto
// «Home» dei concerti, una per concerto, di riserva le altre foto del sito, mai la foto grande in alto
// né una già usata da un altro capitolo. Le usano la pagina e Amministrazione → Foto del sito.
export const CAPITOLI_CORO = 4;
export function fotoCapitoli(quanti = CAPITOLI_CORO) {
  const unaPerConcerto: string[] = [];
  for (const f of fotoInHome()) if (!unaPerConcerto.some((n) => n.includes(`/${f.data}/`))) unaPerConcerto.push(f.nome);
  const scelte = Array.from({ length: quanti }, (_, i) => fotoDrive(`capitolo-${i + 1}`));
  const automatiche = [...new Set([coro.foto.prove, ...unaPerConcerto, ...fotoInHome().map((f) => f.nome), coro.foto.apertura, coro.maestro.foto])]
    .filter((f): f is string => Boolean(f) && f !== coro.foto.coro && !scelte.includes(f));
  return scelte.map((f) => {
    if (f) return { nome: f, caricata: true };
    const auto = automatiche.shift();
    return auto ? { nome: auto, caricata: false } : undefined;
  });
}

// Gli album: un concerto (giorno) con le sue foto, dal più recente
export const albumFoto = () => {
  const giorni = [...new Set(fotoPubbliche().map((f) => f.data))].sort((a, b) => b.localeCompare(a));
  return giorni.map((data) => ({ data, foto: fotoDelConcerto(data) }));
};

// Sezioni dell'organico. Al singolare parola per parola, per le voci del modulo di candidatura:
// "Tenori" → "Tenore", "Baritoni e bassi" → "Baritono e basso".
export const sezioneAlSingolare = (sezione: string) => sezione.replace(/\p{L}+/gu, (p) => (p === 'e' ? p : p.replace(/ori$/, 'ore').replace(/i$/, 'o')));

// In elenco, in minuscolo: "soprani, contralti, tenori e bassi"; se l'ultima sezione ha già una
// "e" ("baritoni e bassi") la si attacca con la virgola, per non scrivere "tenori e baritoni e bassi"
export function elencoSezioni(organico: { sezione: string }[], lingua: Lingua = 'it') {
  const e = lingua === 'en' ? 'and' : 'e';
  const nomi = organico.map((s) => s.sezione.toLowerCase());
  const ultima = nomi.pop();
  if (!nomi.length || !ultima) return ultima ?? '';
  return `${nomi.join(', ')}${new RegExp(` ${e} `).test(ultima) ? ', ' : ` ${e} `}${ultima}`;
}

// I dati del coro in una lingua: in inglese i testi di coro/coro.en.ts sopra quelli di
// coro.config.ts (oggetti fusi, elenchi voce per voce, elenchi di elenchi sostituiti)
function fondi(base: any, sopra: any): any {
  if (sopra === undefined) return base;
  if (Array.isArray(base) && Array.isArray(sopra)) {
    return Array.isArray(sopra[0]) ? sopra : base.map((v, i) => fondi(v, sopra[i]));
  }
  if (base && typeof base === 'object' && sopra && typeof sopra === 'object') {
    return Object.fromEntries(Object.keys({ ...base, ...sopra }).map((k) => [k, fondi(base[k], sopra[k])]));
  }
  return sopra;
}

export const coroIn = (lingua: Lingua): typeof coro => (lingua === 'en' ? fondi(coro, inglese) : coro);

export const indirizzo = (l: { indirizzo: string; cap: string; citta: string }) => `${l.indirizzo}, ${l.cap} ${l.citta}`;

// L'area coristi esiste nella demo (dati di esempio) e nel sito vero quando l'accesso dei coristi
// con Google è configurato (coro.coristi) o, in attesa, come anteprima. ANTEPRIMA_AREA mostra solo
// l'avviso "Anteprima" in testa all'area.
export const ANTEPRIMA_AREA = !DEMO && coro.funzioni.areaCoristi && coro.funzioni.anteprimaArea;
export const AREA_CORISTI = coro.funzioni.areaCoristi && (DEMO || ANTEPRIMA_AREA || Boolean(coro.coristi));
