// Configurazione del coro. Tutto ciò che distingue un coro dall'altro sta nella cartella coro/:
// questo file, i testi in coro/testi/, i concerti in coro/concerti.ts, le foto in coro/immagini/.
//
// Sono i dati del Coro Harmonia Vocalis (Associazione Culturale Musicale Roma Musicanta).
// Le voci marcate "DA VERIFICARE" vanno confermate dal direttivo.
import type { ConfigCoro } from '../src/motore/schema';

export default {
  nome: 'Coro Harmonia Vocalis',
  tipo: 'Coro polifonico misto',
  sigla: 'HV',
  citta: 'Roma',
  associazione: 'Associazione Culturale Musicale Roma Musicanta',
  affiliazioni: 'Associato ARCL e Feniarco',
  descrizione:
    'Coro polifonico misto di Roma diretto dal M° Claudio Maria Micheli. Repertorio sacro e sinfonico, dal Barocco a Morricone.',
  url: 'https://romamusicanta.org',
  // DA VERIFICARE: quando esisterà, sostituire con info@romamusicanta.org
  email: 'romamusicanta@gmail.com',
  fondazione: 2019,

  sede: {
    nome: 'Associazione Culturale Musicale Roma Musicanta',
    indirizzo: 'Via del Forte Tiburtino 98',
    cap: '00159',
    citta: 'Roma',
  },
  // DA VERIFICARE: italiacori indica Via del Frantoio 2 (Liceo Artistico Enzo Rossi),
  // la descrizione del canale YouTube indica Via di Casal Bruciato 15.
  prove: {
    nome: 'Liceo Artistico Enzo Rossi',
    indirizzo: 'Via del Frantoio 2',
    cap: '00159',
    citta: 'Roma',
    orari: 'Ogni mercoledì e due venerdì al mese, dalle 20:00 alle 22:00',
    riquadri: [
      ['Mer', 'Ogni settimana'],
      ['Ven', 'Due volte al mese'],
      ['20:00', 'Fino alle 22:00'],
    ],
  },

  maestro: {
    nome: 'Claudio Maria Micheli',
    presentazione: 'Da oltre trent’anni sul podio dei cori romani, collaboratore di Ennio Morricone, arrangiatore e insegnante di canto.',
    anniPodio: 30,
    foto: 'maestro.jpg',
  },

  direttivo: [
    { nome: 'Francesco Cardillo', ruolo: 'Presidente' },
    { nome: 'Luciano Bet', ruolo: 'Vicepresidente' },
    { nome: 'Claudio Maria Micheli', ruolo: 'Direttore' },
    { nome: 'Emanuela Ghirardin', ruolo: 'Tesoriere' },
  ],
  organico: [
    { sezione: 'Soprani', voci: 11 },
    { sezione: 'Contralti', voci: 12 },
    { sezione: 'Tenori', voci: 10 },
    { sezione: 'Baritoni e bassi', voci: 11 },
  ],
  numeri: [
    { valore: '2019', testo: 'Anno di nascita, con la Missa in Angustiis di Haydn' },
    { valore: '44', testo: 'Voci, in quattro sezioni' },
    { valore: '70', testo: 'Coristi circa, insieme al Coro Ruggero Giovannelli' },
    { valore: '26', testo: 'Concerti in archivio dal 2019 a oggi' },
  ],
  associatoA: [
    { nome: 'ARCL Lazio', descrizione: 'Associazione Regionale Cori del Lazio APS: la rete dei cori della regione.' },
    { nome: 'Feniarco', descrizione: 'Federazione Nazionale Italiana delle Associazioni Regionali Corali.' },
  ],

  stagione: {
    sigla: '26/27',
    presentazione: 'Si apre con il Requiem di Mozart. Messe, oratori e grandi pagine corali con orchestra, a Roma e nel Lazio.',
  },

  // Foto della scheda italiacori del coro, come nel mockup (vedi immagini/CREDITI.md)
  foto: {
    apertura: 'terme.jpg',
    coro: 'palco.jpg',
    accesso: 'terme.jpg',
  },

  link: {
    youtube: 'https://www.youtube.com/@romamusicanta',
    youtubeCanale: '@romamusicanta',
    // Finché l'area coristi vera (accesso con Google) non è pronta, il collegamento porta
    // all'anteprima del mockup, con dati di esempio e un avviso.
    areaCoristi: '/mockup/sito/area.html',
    schedaPdf: undefined,
  },

  calendario: {
    ics: process.env.CALENDARIO_CONCERTI_ICS,
    id: process.env.CALENDARIO_CONCERTI_ID,
  },

  aspetto: {
    veste: 'classica',
    palette: 'porpora',
    carattere: 'garamond',
    // Archivo largo, solo per il logo (coro/Logo.astro)
    caratteriLogo: ['Archivo:wdth,wght@125,300;125,900'],
  },

  funzioni: {
    ascolta: true,
    cantaConNoi: true,
    organizzatori: true,
    areaCoristi: true,
  },
} satisfies ConfigCoro;
