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
  // Gruppo Google (1/10/2026): lo legge Francesco Cardillo
  email: 'info@romamusicanta.org',
  fondazione: 2019,

  sede: {
    nome: 'Associazione Culturale Musicale Roma Musicanta',
    indirizzo: 'Via del Forte Tiburtino 98',
    cap: '00159',
    citta: 'Roma',
  },
  // Confermato da Mario il 2/10/2026. Le prove sono anche nel calendario privato "Prove": il venerdì
  // solo prove supplementari, aggiunte volta per volta quando sono confermate
  prove: {
    nome: 'Liceo Artistico Enzo Rossi',
    indirizzo: 'Via del Frantoio 2',
    cap: '00159',
    citta: 'Roma',
    orari: 'Ogni mercoledì dalle 20:00 alle 22:00, a volte anche il venerdì',
    riquadri: [
      ['Mer', 'Ogni settimana'],
      ['Ven', 'Prove supplementari'],
      ['20:00', 'Fino alle 22:00'],
    ],
  },

  maestro: {
    nome: 'Claudio Maria Micheli',
    presentazione: 'Da oltre trent’anni sul podio dei cori romani, collaboratore di Ennio Morricone, arrangiatore e insegnante di canto.',
    anniPodio: 35, // dal debutto come direttore, nel 1991 (curriculum 2023)
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
    { sezione: 'Bassi', voci: 11 },
  ],
  numeri: [
    { valore: '2019', testo: 'Anno di nascita, con la Missa in Angustiis di Haydn' },
    { valore: '44', testo: 'Voci, in quattro sezioni' },
    { valore: '70', testo: 'Coristi circa, insieme al Coro Ruggero Giovannelli' },
    { valore: '26', testo: 'Concerti in archivio dal 2019 a oggi' },
  ],
  associatoA: [
    { nome: 'ARCL Lazio', url: 'https://www.lazioincoro.it/', descrizione: 'Associazione Regionale Cori del Lazio APS: la rete dei cori della regione.' },
    { nome: 'Feniarco', url: 'https://www.italiacori.it/coro-harmonia-vocalis-roma', descrizione: 'Federazione Nazionale Italiana delle Associazioni Regionali Corali.' },
  ],

  stagione: {
    sigla: '26/27',
    presentazione: 'Si apre con il Requiem di Mozart. Messe, oratori e grandi pagine corali con orchestra, a Roma e nel Lazio.',
  },

  // Area Amministrazione (romamusicanta.org/admin): entrano i membri del gruppo redattori@, che contiene
  // admin@ (chi gestisce il sito) e chi scrive i contenuti: concerti, prove, spartiti, foto
  amministrazione: {
    dominio: 'romamusicanta.org',
    gruppo: 'redattori@romamusicanta.org',
  },

  // Area coristi (romamusicanta.org/area): entrano i membri del gruppo coro@ (i coristi attuali, con
  // l'account dell'associazione). I membri di maestro@ (il Maestro, anche con il suo Gmail, e admin@)
  // hanno la loro area separata, /maestro
  coristi: {
    gruppo: 'coro@romamusicanta.org',
    direzione: 'maestro@romamusicanta.org',
    // Dal 5/10/2026 gli amministratori aprono tutte le aree per regola, non perché admin@ è dentro
    // maestro@ (che ora contiene solo il Maestro)
    amministratori: 'admin@romamusicanta.org',
    // Chi scrive in bacheca (gruppi presidente@ e tesoriere@: una persona ciascuno, si cambia il
    // membro quando cambia il ruolo)
    bacheca: [
      { id: 'maestro', firma: 'Il Maestro', gruppo: 'maestro@romamusicanta.org', chat: 'HV Maestro' },
      { id: 'presidente', firma: 'Il presidente', gruppo: 'presidente@romamusicanta.org', chat: 'HV' },
      { id: 'tesoriere', firma: 'Il tesoriere', gruppo: 'tesoriere@romamusicanta.org', chat: 'HV' },
      { id: 'amministratori', firma: 'Gli amministratori del sito', gruppo: 'admin@romamusicanta.org', chat: 'HV', tutti: true },
    ],
    // Area del tesoriere (/tesoriere, dal 5/10/2026): quote dei coristi e cassa del coro. La vedono il
    // tesoriere e, per regola, gli amministratori del sito (per assistenza). Quota di 20 euro al mese, da
    // settembre a giugno; onorari come nel rendiconto 2025-26 (90 € a prova per il Direttore, 80 €
    // per il sostituto, lezioni di vocalità di gruppo 25 € singola e 50 € doppia)
    tesoreria: {
      gruppi: ['tesoriere@romamusicanta.org'],
      quota: 20,
      mesi: [9, 10, 11, 12, 1, 2, 3, 4, 5, 6],
      onorari: { prova: 90, sostituto: 80, vocalitaSingola: 25, vocalitaDoppia: 50 },
      codiceFiscale: '97968110581', // dal rendiconto 2025-26
      iban: 'IT06G0306909606100000409035',
      intestatario: 'ROMA MUSICANTA',
      // Come nel prospetto delle spese fisse 2025-26: il canone alla Città Metropolitana è per la sede del Liceo
      sedi: [
        { nome: 'Liceo E. Rossi', parole: ['Enzo Rossi', 'E. Rossi', 'Liceo', 'Città Metropolitana', 'Frantoio'] },
        { nome: 'CS Intifada', parole: ['Intifada'] },
      ],
    },
  },

  // Foto di riserva, dalla scheda italiacori del coro (vedi immagini/CREDITI.md). Quelle vere si
  // cambiano su Drive, nella cartella Sito/Foto del Drive condiviso: apertura, coro, prove,
  // maestro (questa al posto di maestro.foto) e accesso, con questi nomi (.jpg o .png).
  foto: {
    apertura: 'terme.jpg',
    coro: 'palco.jpg',
    accesso: 'terme.jpg',
  },

  link: {
    youtube: 'https://www.youtube.com/@romamusicanta',
    youtubeCanale: '@romamusicanta',
    // Area coristi esterna: non serve, il sito ha la sua (per ora in anteprima, vedi funzioni)
    areaCoristi: undefined,
    schedaPdf: undefined,
  },

  calendario: {
    ics: process.env.CALENDARIO_CONCERTI_ICS,
    id: process.env.CALENDARIO_CONCERTI_ID,
  },

  aspetto: {
    veste: 'stagione',
    carattere: 'manrope',
    // Colori del sito, scelti da Mario con il pannello (1/10/2026): blu notte e giallo su fondo chiaro,
    // barra in alto e piè di pagina nello stesso blu notte del principale.
    // Sono l'unica palette del sito; chi guarda può provarne altri con il pannello.
    colori: { primario: '#0f1b23', accento: '#f2b41b', fondo: '#f5f4f0', bianco: '#ffffff', testo: '#16181f', piede: '#0f1b23', barra: '#0f1b23' },
    // Archivo largo, solo per il logo (coro/Logo.astro)
    caratteriLogo: ['Archivo:wdth,wght@125,300;125,900'],
    // Pannello "Prova la grafica" (palette, colori propri, caratteri) per chi guarda il sito
    pannelloProva: false,
  },

  funzioni: {
    ascolta: true,
    cantaConNoi: true,
    organizzatori: true,
    areaCoristi: true,
    // Avviso "Anteprima" in testa all'area coristi (spento dal 3/10/2026: tutte le pagine hanno dati veri)
    anteprimaArea: false,
  },
} satisfies ConfigCoro;
