// Dati del modulo di candidatura della pagina Canta con noi, comuni alla pagina (statica) e al
// server che lo riceve (src/area/candidature.ts, /api/candidatura)

// I registri del menu; «Non lo so» lo decide l'audizione
export const REGISTRI = [
  { it: 'Soprano', en: 'Soprano' },
  { it: 'Contralto', en: 'Alto' },
  { it: 'Tenore', en: 'Tenor' },
  { it: 'Baritono', en: 'Baritone' },
  { it: 'Basso', en: 'Bass' },
  { it: 'Non lo so', en: 'I don’t know' },
] as const;

// Nessuna età minima (decisione di Mario del 25/11/2026): il limite serve solo a scartare i numeri sbagliati
export const ETA_MINIMA = 5;
export const MAGGIORE_ETA = 18;
