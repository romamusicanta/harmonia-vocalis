// Dati generali del coro. Le voci marcate "DA VERIFICARE" vanno confermate dal direttivo.

export const site = {
  nome: 'Coro Harmonia Vocalis',
  associazione: 'Associazione Culturale Musicale Roma Musicanta',
  url: 'https://romamusicanta.org',
  descrizione:
    'Coro polifonico misto di Roma diretto dal M° Claudio Maria Micheli. Repertorio sacro e sinfonico dal Barocco a Morricone.',

  // DA VERIFICARE: quando esisterà, sostituire con info@romamusicanta.org
  email: 'romamusicanta@gmail.com',

  sede: {
    nome: 'Sede legale',
    indirizzo: 'Via del Forte Tiburtino, 98 — 00159 Roma',
  },

  // DA VERIFICARE: italiacori indica Via del Frantoio 2 (Liceo Artistico Enzo Rossi),
  // la descrizione del canale YouTube indica Via di Casal Bruciato 15.
  prove: {
    luogo: 'Liceo Artistico Enzo Rossi',
    indirizzo: 'Via del Frantoio, 2 — 00159 Roma',
    orari: 'Ogni mercoledì e due venerdì al mese, dalle 20:00 alle 22:00',
  },

  maestro: 'Claudio Maria Micheli',

  direttivo: [
    { nome: 'Francesco Cardillo', ruolo: 'Presidente' },
    { nome: 'Luciano Bet', ruolo: 'Vicepresidente' },
    { nome: 'Claudio Maria Micheli', ruolo: 'Direttore' },
    { nome: 'Emanuela Ghirardin', ruolo: 'Tesoriere' },
  ],

  organico: [
    { voce: 'Soprani', n: 11 },
    { voce: 'Contralti', n: 12 },
    { voce: 'Tenori', n: 10 },
    { voce: 'Baritoni e Bassi', n: 11 },
  ],

  link: {
    youtube: 'https://www.youtube.com/@romamusicanta',
    youtubeChannelId: 'UC0gvYeL7mHpCwht3qjS5vag',
    italiacori: 'https://www.italiacori.it/coro-harmonia-vocalis-roma',
    // DA VERIFICARE: indirizzo reale del Google Site riservato ai coristi
    areaCoristi: 'https://sites.google.com/romamusicanta.org/area-coristi',
    // Indirizzo pubblico iCal del calendario "Concerti" (facoltativo, vedi AGENTS.md)
    calendarioIcs: import.meta.env.CALENDARIO_CONCERTI_ICS as string | undefined,
    // ID del calendario "Concerti", per il pulsante "Iscriviti al calendario"
    calendarioId: import.meta.env.CALENDARIO_CONCERTI_ID as string | undefined,
  },
};
