// Punto di accesso ai dati del coro: configurazione validata, immagini, modalità demo.
import configGrezza from '../../coro/coro.config';
import { schemaCoro } from './schema';

const esito = schemaCoro.safeParse(configGrezza);
if (!esito.success) {
  const righe = esito.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`coro/coro.config.ts non è valido:\n${righe}`);
}

export const coro = esito.data;

// Demo di vendita: pannello di scelta, area coristi aperta con dati di esempio, vesti alternative.
// Si attiva con DEMO=1 (npm run dev, npm run build:demo).
export const DEMO = process.env.DEMO === '1';

// Le immagini del coro stanno in coro/immagini e si indicano per nome di file.
const immagini = import.meta.glob<{ default: ImageMetadata }>('/coro/immagini/*.{jpg,jpeg,png,webp,avif,svg}', { eager: true });

export function immagine(nome: string) {
  const trovata = immagini[`/coro/immagini/${nome}`];
  if (!trovata) throw new Error(`Immagine non trovata in coro/immagini: ${nome}`);
  return trovata.default;
}

export const indirizzo = (l: { indirizzo: string; cap: string; citta: string }) => `${l.indirizzo}, ${l.cap} ${l.citta}`;

// L'area coristi vera (accesso con Google) è ancora da fare: per ora esiste solo nella demo.
export const AREA_CORISTI = DEMO && coro.funzioni.areaCoristi;
