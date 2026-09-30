// Configurazione del coro. Tutto ciò che distingue un coro dall'altro sta nella cartella coro/:
// questo file, i testi in coro/testi/, i concerti in coro/concerti.ts, le foto in coro/immagini/.
//
// Questo è il CORO DI FANTASIA della demo: nome, persone, luoghi e date sono inventati.
import type { ConfigCoro } from '../src/motore/schema';

export default {
  nome: 'Coro Esempio',
  tipo: 'Coro polifonico misto',
  sigla: 'CE',
  citta: 'Bologna',
  associazione: 'Associazione Musicale Esempio APS',
  affiliazioni: 'Associato AERCO e Feniarco',
  descrizione:
    'Coro polifonico misto di Bologna diretto dal M° Livia Serafini. Repertorio sacro e sinfonico, dal Rinascimento al Novecento.',
  url: 'https://www.coroesempio.it',
  email: 'info@coroesempio.it',
  fondazione: 2012,

  sede: {
    nome: 'Associazione Musicale Esempio APS',
    indirizzo: 'Via delle Rose 12',
    cap: '40121',
    citta: 'Bologna',
  },
  prove: {
    nome: 'Sala parrocchiale di San Luca',
    indirizzo: 'Via dei Glicini 4',
    cap: '40125',
    citta: 'Bologna',
    orari: 'Ogni martedì dalle 20:45 alle 22:45, e un sabato pomeriggio al mese',
    riquadri: [
      ['Mar', 'Ogni settimana'],
      ['Sab', 'Una volta al mese'],
      ['20:45', 'Fino alle 22:45'],
    ],
  },

  maestro: {
    nome: 'Livia Serafini',
    presentazione: 'Direttrice e pianista, da vent’anni sul podio: polifonia rinascimentale, oratorio, musica del Novecento.',
    anniPodio: 20,
    foto: 'maestro.jpg',
  },

  direttivo: [
    { nome: 'Marco Bellini', ruolo: 'Presidente' },
    { nome: 'Anna Ferri', ruolo: 'Vicepresidente' },
    { nome: 'Livia Serafini', ruolo: 'Direttrice' },
    { nome: 'Paola Guidi', ruolo: 'Segretaria' },
    { nome: 'Luca Mazzoni', ruolo: 'Tesoriere' },
  ],
  organico: [
    { sezione: 'Soprani', voci: 12 },
    { sezione: 'Contralti', voci: 11 },
    { sezione: 'Tenori', voci: 8 },
    { sezione: 'Bassi', voci: 9 },
  ],
  numeri: [
    { valore: '2012', testo: 'Anno di nascita, con i Vespri di Monteverdi' },
    { valore: '40', testo: 'Voci, in quattro sezioni' },
    { valore: '3', testo: 'Rassegne organizzate in città, ogni anno' },
    { valore: '60+', testo: 'Concerti dal 2012 a oggi' },
  ],
  associatoA: [
    { nome: 'AERCO', descrizione: 'Associazione Emiliano Romagnola Cori: la rete dei cori della regione.', url: 'https://www.aerco.it' },
    { nome: 'Feniarco', descrizione: 'Federazione Nazionale Italiana delle Associazioni Regionali Corali.', url: 'https://www.feniarco.it' },
  ],

  stagione: {
    sigla: '26/27',
    presentazione: 'Si apre con il Requiem di Mozart. Messe, oratori e polifonia a cappella, a Bologna e in Emilia.',
  },

  foto: {
    apertura: 'concerto-chiesa.jpg',
    coro: 'spartiti.jpg',
    accesso: 'leggio.jpg',
  },

  link: {
    youtube: 'https://www.youtube.com/@coroesempio',
    youtubeCanale: '@coroesempio',
    instagram: 'https://www.instagram.com/coroesempio',
    schedaPdf: undefined,
  },

  calendario: {
    ics: process.env.CALENDARIO_CONCERTI_ICS,
    id: process.env.CALENDARIO_CONCERTI_ID,
  },

  aspetto: {
    veste: 'stagione',
    palette: 'porpora',
    carattere: 'manrope',
  },

  funzioni: {
    ascolta: true,
    cantaConNoi: true,
    organizzatori: true,
    areaCoristi: true,
  },
} satisfies ConfigCoro;
