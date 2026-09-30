// Catalogo di vesti grafiche, palette e caratteri disponibili nel modello.
// Il coro ne sceglie uno per tipo in coro/coro.config.ts; nella demo si cambiano dal pannello.

export const VESTI = {
  stagione: {
    nome: 'C · Stagione',
    descrizione: 'Grafica da cartellone: numeri grandi, blocchi di colore pieni, schede nette. Per cori con una stagione concertistica.',
    pronta: true,
    // Abbinamenti consigliati: [palette, carattere]
    abbinamenti: [
      ['porpora', 'manrope'],
      ['notte', 'manrope'],
      ['pino', 'fraunces'],
      ['inchiostro', 'dmserif'],
    ],
  },
  palco: {
    nome: 'A · Palco al buio',
    descrizione: 'Fondo scuro e foto di scena: teatrale, per repertorio sinfonico e d’opera.',
    pronta: false,
    abbinamenti: [],
  },
  segno: {
    nome: 'B · Il segno',
    descrizione: 'Tipografica e grafica, con molto bianco e un segno forte.',
    pronta: false,
    abbinamenti: [],
  },
  classica: {
    nome: 'D · Classica',
    descrizione: 'Grazie, impaginazione centrata: musica sacra e antica.',
    pronta: false,
    abbinamenti: [],
  },
  calda: {
    nome: 'E · Calda',
    descrizione: 'Foto grandi e angoli morbidi: cori amatoriali, parrocchiali, giovanili.',
    pronta: false,
    abbinamenti: [],
  },
} as const satisfies Record<string, { nome: string; descrizione: string; pronta: boolean; abbinamenti: readonly (readonly [string, string])[] }>;

export const PALETTE = {
  porpora: { nome: 'Porpora e oro', descrizione: 'Rosso porpora e oro su fondo avorio: solenne e caldo.' },
  notte: { nome: 'Notte e oro', descrizione: 'Blu notte e giallo: istituzionale e deciso.' },
  pino: { nome: 'Pino e terracotta', descrizione: 'Verde pino e terracotta: naturale e accogliente.' },
  inchiostro: { nome: 'Inchiostro e vermiglione', descrizione: 'Quasi nero e rosso-arancio: grafico e contemporaneo.' },
  oltremare: { nome: 'Oltremare e rosa antico', descrizione: 'Blu luminoso e rosa: raffinato, meno istituzionale.' },
} as const;

// famiglie: parametro "family" di Google Fonts per ogni carattere del set
export const CARATTERI = {
  manrope: {
    nome: 'Manrope',
    descrizione: 'Senza grazie, pulito e contemporaneo, per titoli e testo.',
    famiglie: ['Manrope:wght@400..800'],
  },
  fraunces: {
    nome: 'Fraunces + Source Sans',
    descrizione: 'Grazie morbide e moderne, calde e molto leggibili.',
    famiglie: ['Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700', 'Source+Sans+3:ital,wght@0,400..800;1,400..800'],
  },
  garamond: {
    nome: 'EB Garamond + Lato',
    descrizione: 'Il Garamond dei libri e dei programmi di sala: tradizionale ed elegante.',
    famiglie: ['EB+Garamond:wght@500..700', 'Lato:wght@400;700;900'],
  },
  caslon: {
    nome: 'Libre Caslon + Libre Franklin',
    descrizione: 'Forte contrasto tra tratti spessi e sottili: solenne, da frontespizio.',
    famiglie: ['Libre+Caslon+Display', 'Libre+Franklin:wght@400..800'],
  },
  dmserif: {
    nome: 'DM Serif + DM Sans',
    descrizione: 'Grazie ad alto contrasto e forme piene: da locandina teatrale.',
    famiglie: ['DM+Serif+Display', 'DM+Sans:opsz,wght@9..40,400..800'],
  },
} as const;

export type Veste = keyof typeof VESTI;
export type Palette = keyof typeof PALETTE;
export type Carattere = keyof typeof CARATTERI;

export const vestiPronte = (Object.keys(VESTI) as Veste[]).filter((v) => VESTI[v].pronta);

export function urlCaratteri(elenco: Carattere[]) {
  const famiglie = elenco.flatMap((c) => CARATTERI[c].famiglie).map((f) => `family=${f}`);
  return `https://fonts.googleapis.com/css2?${famiglie.join('&')}&display=swap`;
}
