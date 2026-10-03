// Punto di accesso ai dati del coro: configurazione validata, immagini, modalità demo.
import configGrezza from '../../coro/coro.config';
import { schemaCoro } from './schema';
import inglese from '../../coro/coro.en';
import type { Lingua } from './lingua';

const esito = schemaCoro.safeParse(configGrezza);
if (!esito.success) {
  const righe = esito.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`coro/coro.config.ts non è valido:\n${righe}`);
}

export const coro = esito.data;

// Demo di vendita: pannello di scelta, area coristi aperta con dati di esempio, vesti alternative.
// Si attiva con DEMO=1 (npm run dev, npm run build:demo).
export const DEMO = process.env.DEMO === '1';

// Le immagini del coro stanno in coro/immagini e si indicano per nome di file. Prima della build
// scripts/scarica-allegati.mjs porta da Drive in coro/immagini/drive/ quelle allegate agli eventi
// del calendario ("drive/<id>.<ext>") e le foto del sito della cartella Sito/Foto ("drive/sito/…").
const immagini = import.meta.glob<{ default: ImageMetadata }>('/coro/immagini/{*,drive/*,drive/sito/*}.{jpg,jpeg,png,webp,avif,svg}', { eager: true });

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
