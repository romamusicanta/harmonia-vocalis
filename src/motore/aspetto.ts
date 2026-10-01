// Catalogo di vesti grafiche, palette e caratteri disponibili nel modello.
// Il coro ne sceglie uno per tipo in coro/coro.config.ts; nella demo si cambiano dal pannello.

// Ordine = ordine nel pannello della demo. Abbinamenti consigliati: [palette, carattere].
// Una veste è pronta quando la sua cartella src/vesti/<veste>/ ha stile.css (vedi src/vesti/index.ts).
export const VESTI = {
  palco: {
    nome: 'A · Palco al buio',
    descrizione: 'Fondo scuro e foto di scena a tutta pagina: teatrale, per repertorio sinfonico e d’opera.',
    abbinamenti: [['inchiostro', 'dmserif'], ['notte', 'caslon'], ['porpora', 'fraunces'], ['oltremare', 'manrope']],
  },
  segno: {
    nome: 'B · Il segno',
    descrizione: 'Tipografica, da manifesto: molto bianco, filetti e un colore forte. Per cori con un’identità contemporanea.',
    abbinamenti: [['inchiostro', 'manrope'], ['oltremare', 'dmserif'], ['porpora', 'caslon'], ['pino', 'manrope']],
  },
  stagione: {
    nome: 'C · Stagione',
    descrizione: 'Grafica da cartellone: numeri grandi, blocchi di colore pieni, schede nette. Per cori con una stagione concertistica.',
    abbinamenti: [['porpora', 'manrope'], ['notte', 'manrope'], ['pino', 'fraunces'], ['inchiostro', 'dmserif']],
  },
  classica: {
    nome: 'D · Classica',
    descrizione: 'Grazie, impaginazione centrata e ornamenti sobri, come un programma di sala. Per musica sacra e antica.',
    abbinamenti: [['porpora', 'garamond'], ['notte', 'caslon'], ['pino', 'garamond'], ['oltremare', 'fraunces']],
  },
  calda: {
    nome: 'E · Calda',
    descrizione: 'Foto grandi, angoli morbidi, toni accoglienti. Per cori amatoriali, parrocchiali e giovanili.',
    abbinamenti: [['pino', 'fraunces'], ['porpora', 'fraunces'], ['oltremare', 'manrope'], ['notte', 'garamond']],
  },
} as const satisfies Record<string, { nome: string; descrizione: string; abbinamenti: readonly (readonly [string, string])[] }>;

export const PALETTE = {
  porpora: { nome: 'Porpora e oro', descrizione: 'Rosso porpora e oro su fondo avorio: solenne e caldo.' },
  notte: { nome: 'Notte e oro', descrizione: 'Blu notte e giallo: istituzionale e deciso.' },
  pino: { nome: 'Pino e terracotta', descrizione: 'Verde pino e terracotta: naturale e accogliente.' },
  inchiostro: { nome: 'Inchiostro e vermiglione', descrizione: 'Quasi nero e rosso-arancio: grafico e contemporaneo.' },
  oltremare: { nome: 'Oltremare e rosa antico', descrizione: 'Blu luminoso e rosa: raffinato, meno istituzionale.' },
} as const;

// Colori di base di una palette personalizzata (coro.aspetto.colori o pannello di prova);
// le sfumature (--primario-2, --linea, --tenue…) si ricavano da questi in src/stile/palette.css.
export const COLORI = {
  primario: 'Principale',
  accento: 'Accento',
  fondo: 'Fondo',
  bianco: 'Schede',
  testo: 'Testo',
} as const;
export type Colore = keyof typeof COLORI;

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
    famiglie: ['EB+Garamond:ital,wght@0,500..700;1,500..700', 'Lato:ital,wght@0,400;0,700;0,900;1,400'],
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

const conStile = Object.keys(import.meta.glob('../vesti/*/stile.css')).map((p) => p.split('/')[2]);
export const vestiPronte = (Object.keys(VESTI) as Veste[]).filter((v) => conStile.includes(v));

export function urlCaratteri(elenco: Carattere[], altre: string[] = []) {
  const famiglie = [...elenco.flatMap((c) => CARATTERI[c].famiglie), ...altre].map((f) => `family=${f}`);
  return `https://fonts.googleapis.com/css2?${famiglie.join('&')}&display=swap`;
}
