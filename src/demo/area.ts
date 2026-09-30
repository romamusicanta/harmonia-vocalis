// Dati di esempio dell'area coristi, solo per la demo.
// Nel sito vero questi dati arriveranno dai Fogli e dal Drive del coro (e dal calendario Google
// "Prove"): qui sono scritti a mano, con nomi e dati inventati. Ogni blocco indica la sua fonte.
//
// Le date sono pensate intorno al 30 settembre 2026 (OGGI): prove nelle settimane successive,
// registrazioni e presenze in quelle precedenti. I concerti sono quelli pubblici del coro
// (prossimiConcerti() del motore): qui ci sono solo i dati di convocazione.
import { coro } from '../motore/coro';
import { parti } from '../motore/concerti';
import type { Concerto } from '../motore/tipi';

// Giorno a cui si riferiscono i dati di esempio ("tra 6 giorni", "prossima prova"…)
export const OGGI = '2026-09-30';

// ——— Corista collegato ———
// Fonte nel sito vero: account Google con cui si è entrati + foglio "Coristi" (nome, sezione).
export const corista = {
  nome: 'Giulia',
  cognome: 'Rinaldi',
  sezione: 'Contralti',
  email: 'giulia.rinaldi@example.com',
};

// Sezioni e numero di voci: dall'organico del coro
export const sezioni = coro.organico.map((s) => s.sezione);
export const voci = Object.fromEntries(coro.organico.map((s) => [s.sezione, s.voci])) as Record<string, number>;
export const totaleVoci = coro.organico.reduce((n, s) => n + s.voci, 0);

// ——— Prove ———
// Fonte nel sito vero: calendario Google "Prove" (titolo, orario, luogo; nella descrizione
// i brani da preparare, uno per riga). Le assenze si scrivono nel foglio "Presenze".
export type BranoProva = {
  autore?: string;  // cognome, per la bacheca: "Mozart"
  opera: string;    // "Requiem"
  passo?: string;   // "Lacrimosa, ultime otto battute"
  chi?: string;     // "tutti", "soprani e contralti: bb. 7–25"
};

export type Prova = {
  data: string;     // "2026-10-06"
  inizio: string;   // "20:45"
  fine: string;
  titolo: string;
  straordinaria?: boolean;
  luogo?: string;   // se diverso dalla sala prove abituale
  brani: BranoProva[];
  basi?: boolean;   // basi di studio già pronte nel Drive
};

export const prove: Prova[] = [
  {
    data: '2026-10-06', inizio: '20:45', fine: '22:45',
    titolo: 'Prova d’insieme · Requiem',
    brani: [
      { autore: 'Mozart', opera: 'Requiem', passo: 'Introitus e Kyrie', chi: 'tutti' },
      { autore: 'Mozart', opera: 'Requiem', passo: 'Lacrimosa, ultime otto battute', chi: 'tutti' },
      { autore: 'Mozart', opera: 'Requiem', passo: 'Confutatis', chi: 'soprani e contralti: bb. 7–25' },
    ],
    basi: true,
  },
  {
    data: '2026-10-10', inizio: '15:00', fine: '18:30',
    titolo: 'Prova straordinaria · tutte le sezioni',
    straordinaria: true,
    brani: [
      { autore: 'Mozart', opera: 'Requiem', passo: 'esecuzione completa con il pianista accompagnatore', chi: 'tutti' },
    ],
    basi: true,
  },
  {
    data: '2026-10-13', inizio: '20:45', fine: '22:45',
    titolo: 'Prova d’insieme · Requiem',
    brani: [
      { autore: 'Mozart', opera: 'Requiem', passo: 'Domine Jesu e Hostias', chi: 'tutti' },
      { autore: 'Mozart', opera: 'Requiem', passo: 'Sanctus e Benedictus', chi: 'tutti' },
    ],
    basi: true,
  },
  {
    data: '2026-10-16', inizio: '20:30', fine: '23:00',
    titolo: 'Prova generale con orchestra',
    luogo: 'Chiesa di San Giacomo',
    brani: [
      { autore: 'Mozart', opera: 'Requiem', passo: 'esecuzione completa con orchestra e solisti', chi: 'tutti' },
    ],
    basi: true,
  },
  {
    data: '2026-10-20', inizio: '20:45', fine: '22:45',
    titolo: 'Concerto di Natale · prima lettura',
    brani: [
      { autore: 'Bach', opera: 'Magnificat', passo: 'Magnificat anima mea e Omnes generationes', chi: 'tutti' },
    ],
  },
  {
    data: '2026-10-27', inizio: '20:45', fine: '22:45',
    titolo: 'Prova di sezione',
    brani: [
      { autore: 'Bach', opera: 'Magnificat', passo: 'soprani e contralti 20:45, tenori e bassi 21:45' },
    ],
  },
  {
    data: '2026-11-03', inizio: '20:45', fine: '22:45',
    titolo: 'Prova d’insieme',
    brani: [
      { autore: 'Bach', opera: 'Magnificat', passo: 'ripasso dei brani letti a ottobre', chi: 'tutti' },
      { opera: 'Canti di Natale', passo: 'brani comunicati dalla Direttrice', chi: 'tutti' },
    ],
  },
  {
    data: '2026-11-10', inizio: '20:45', fine: '22:45',
    titolo: 'Prova d’insieme',
    brani: [
      { opera: 'Canti di Natale', passo: 'lettura per sezioni', chi: 'tutti' },
    ],
  },
];

export const prossimaProva = prove.find((p) => p.data >= OGGI) ?? prove[0];
export const luogoProva = (p: Prova) => p.luogo ?? coro.prove.nome;

// ——— Convocazioni ai concerti ———
// Fonte nel sito vero: calendario Google "Concerti" (data, luogo, programma) + foglio
// "Convocazioni" (orari della giornata, abito, cosa portare, come arrivare) + risposte dei
// coristi nello stesso foglio. La chiave è la data del concerto, come nel calendario.
export type Convocazione = {
  orari: { ora: string; cosa: string }[];
  abito: string;
  portare: string[];
  arrivare: string;
  entro: string;    // scadenza per la conferma, data ISO
  // Risposte per sezione (i "in attesa" sono le voci restanti)
  risposte: Record<string, { si: number; no: number }>;
};

export const convocazioni: Record<string, Convocazione> = {
  '2026-10-18': {
    orari: [
      { ora: '16:00', cosa: 'Ritrovo in sacrestia' },
      { ora: '16:30', cosa: 'Prova acustica con orchestra e solisti' },
      { ora: '17:30', cosa: 'Pausa, cambio d’abito' },
      { ora: '18:00', cosa: 'Concerto' },
    ],
    abito: 'Abito da concerto nero, cartellina nera',
    portare: ['<b>Abito da concerto nero</b>, scarpe nere', 'Cartellina nera con lo spartito e le note della Direttrice', 'Una bottiglietta d’acqua'],
    arrivare: 'La chiesa è in centro storico, in zona a traffico limitato: meglio arrivare in autobus o in bicicletta.',
    entro: '2026-10-06',
    risposte: {
      Soprani: { si: 10, no: 1 },
      Contralti: { si: 9, no: 0 },
      Tenori: { si: 7, no: 1 },
      Bassi: { si: 8, no: 0 },
    },
  },
};

// Titolo breve per le schede dell'area: "Mozart, Requiem K 626"
export const titoloBreve = (c: Concerto) => [c.autore?.split(/\s+/).at(-1), c.titolo].filter(Boolean).join(', ');
export const convocazione = (c: Concerto) => convocazioni[c.data.slice(0, 10)];

// ——— Repertorio in studio ———
// Fonte nel sito vero: Drive del coro, cartella "Spartiti e basi" (una sottocartella per
// opera, con dentro una cartella per sezione) + foglio "Note del Maestro".
export type OperaStudio = {
  autore: string;
  titolo: string;
  concerto: string;         // data del concerto per cui si studia
  // Senza materiali l'opera compare come segnaposto "in arrivo"
  materiali?: {
    basi: { sezione: string; tracce: number; minuti: number; aggiornate: string }[];
    riferimento: { minuti: number };   // base "Tutte le voci"
    // Tracce della sezione del corista, movimento per movimento
    tracce: { titolo: string; durata: string }[];
    spartito: { titolo: string; descrizione: string };
    note: { data: string; testo: string }[];
    altri: { titolo: string; descrizione: string; icona: 'documento' | 'nota' }[];
  };
  inArrivo?: string;
};

export const repertorio: OperaStudio[] = [
  {
    autore: 'W. A. Mozart',
    titolo: 'Requiem K 626',
    concerto: '2026-10-18',
    materiali: {
      basi: [
        { sezione: 'Soprani', tracce: 11, minuti: 36, aggiornate: '2026-09-21' },
        { sezione: 'Contralti', tracce: 11, minuti: 36, aggiornate: '2026-09-21' },
        { sezione: 'Tenori', tracce: 11, minuti: 35, aggiornate: '2026-09-19' },
        { sezione: 'Bassi', tracce: 11, minuti: 35, aggiornate: '2026-09-19' },
      ],
      riferimento: { minuti: 52 },
      tracce: [
        { titolo: 'Introitus', durata: '4:48' },
        { titolo: 'Kyrie', durata: '2:41' },
        { titolo: 'Dies irae', durata: '1:52' },
        { titolo: 'Rex tremendae', durata: '2:05' },
        { titolo: 'Confutatis', durata: '2:38' },
        { titolo: 'Lacrimosa', durata: '3:14' },
        { titolo: 'Domine Jesu', durata: '3:40' },
        { titolo: 'Hostias', durata: '4:21' },
        { titolo: 'Sanctus e Osanna', durata: '1:44' },
        { titolo: 'Agnus Dei', durata: '3:33' },
        { titolo: 'Lux aeterna', durata: '5:10' },
      ],
      spartito: { titolo: 'Requiem K 626 · completo', descrizione: 'Riduzione per canto e pianoforte · PDF, 64 pagine' },
      note: [
        { data: '2026-09-29', testo: '<b>Lacrimosa:</b> niente rallentando nelle ultime otto battute, lo indico io. <b>Confutatis:</b> «Voca me» piano e legato, senza calare.' },
        { data: '2026-09-15', testo: '<b>Kyrie:</b> le entrate del fugato devono essere nette. Studiate con la base «Tutte le voci» per sentire chi entra prima di voi.' },
      ],
      altri: [
        { titolo: 'Pronuncia del latino', descrizione: 'Scheda con le regole usate dal coro', icona: 'documento' },
        { titolo: 'Testo e traduzione', descrizione: 'Latino e italiano a fronte', icona: 'nota' },
      ],
    },
  },
  {
    autore: 'J. S. Bach',
    titolo: 'Magnificat BWV 243',
    concerto: '2026-12-19',
    inArrivo: 'Spartito e basi compariranno qui appena caricati nel Drive, prima della lettura del 20 ottobre.',
  },
];

// Fonte nel sito vero: Drive del coro, cartella "Spartiti e basi" (una sottocartella per opera)
export const archivioSpartiti: { titolo: string; autore: string; contenuto: string }[] = [
  { titolo: 'Requiem K 626', autore: 'W. A. Mozart', contenuto: 'Spartito · basi SCTB' },
  { titolo: 'Magnificat BWV 243', autore: 'J. S. Bach', contenuto: 'Spartito' },
  { titolo: 'Carmina Burana', autore: 'C. Orff', contenuto: 'Spartito · basi SCTB · pronuncia del latino' },
  { titolo: 'Stabat Mater', autore: 'G. B. Pergolesi', contenuto: 'Spartito · basi SC' },
  { titolo: 'Gloria RV 589', autore: 'A. Vivaldi', contenuto: 'Spartito · basi SCTB' },
  { titolo: 'Petite Messe Solennelle', autore: 'G. Rossini', contenuto: 'Spartito · basi SCTB' },
  { titolo: 'Messiah HWV 56', autore: 'G. F. Händel', contenuto: 'Spartito · basi SCTB' },
  { titolo: 'Vespro della Beata Vergine', autore: 'C. Monteverdi', contenuto: 'Spartito · edizione del coro' },
  { titolo: 'Requiem op. 48', autore: 'G. Fauré', contenuto: 'Spartito · basi SCTB' },
  { titolo: 'Gloria e canti di Natale', autore: 'J. Rutter', contenuto: 'Spartiti' },
];

// ——— Registrazioni delle prove ———
// Fonte nel sito vero: Drive del coro, cartella "Registrazioni prove" (una sottocartella per
// data; chi carica è il proprietario del file).
export type GiornoRegistrato = {
  data: string;
  caricatoDa: string;
  sezione: string;
  tracce: { titolo: string; durata: string }[];
};

export const registrazioni: GiornoRegistrato[] = [
  {
    data: '2026-09-29', caricatoDa: 'Davide R.', sezione: 'tenori',
    tracce: [
      { titolo: 'Requiem · Lacrimosa (tutti)', durata: '4:12' },
      { titolo: 'Requiem · Lacrimosa, ultime 8 battute (ripetizione)', durata: '1:38' },
      { titolo: 'Requiem · Domine Jesu (tutti)', durata: '3:55' },
    ],
  },
  {
    data: '2026-09-26', caricatoDa: 'Francesca L.', sezione: 'soprani',
    tracce: [
      { titolo: 'Requiem · Confutatis, soprani e contralti', durata: '2:47' },
      { titolo: 'Requiem · Confutatis (tutti)', durata: '2:41' },
      { titolo: 'Requiem · Rex tremendae (tutti)', durata: '2:09' },
      { titolo: 'Requiem · Lacrimosa, prima lettura a sezioni', durata: '6:30' },
    ],
  },
  {
    data: '2026-09-22', caricatoDa: 'Davide R.', sezione: 'tenori',
    tracce: [
      { titolo: 'Requiem · Kyrie, fugato lento', durata: '3:20' },
      { titolo: 'Requiem · Kyrie (tutti, a tempo)', durata: '2:44' },
    ],
  },
  {
    data: '2026-09-15', caricatoDa: 'Giorgio P.', sezione: 'bassi',
    tracce: [
      { titolo: 'Requiem · Introitus (tutti)', durata: '5:02' },
      { titolo: 'Requiem · Dies irae (tutti)', durata: '1:58' },
      { titolo: 'Requiem · Dies irae, bassi da soli', durata: '1:31' },
    ],
  },
];

// ——— Presenze ———
// Fonte nel sito vero: foglio "Presenze" (una riga per assenza segnalata, con nota facoltativa;
// il registro delle presenze lo compila la segreteria a ogni prova) + organico per sezione.

// Assenze e ritardi segnalati per la prossima prova
export const assenzeProssima: { nome: string; sezione: string; nota?: string }[] = [
  { nome: 'Francesca L.', sezione: 'Soprani', nota: 'Turno di lavoro serale' },
  { nome: 'Irene C.', sezione: 'Soprani', nota: 'Influenza, spero di esserci sabato' },
  { nome: 'Marta V.', sezione: 'Contralti', nota: 'Fuori città per lavoro' },
  { nome: 'Davide R.', sezione: 'Tenori' },
  { nome: 'Giorgio P.', sezione: 'Bassi', nota: 'Visita medica' },
  { nome: 'Roberto S.', sezione: 'Bassi', nota: 'Riunione a scuola dei figli' },
];
export const ritardiProssima: { nome: string; sezione: string; ora: string }[] = [
  { nome: 'Elisa N.', sezione: 'contralti', ora: '21:30' },
];

// Registro delle ultime prove: presenti per sezione e presenza del corista collegato
export const storicoPresenze: { data: string; presenti: Record<string, number>; tu: boolean; nota?: string }[] = [
  { data: '2026-09-29', presenti: { Soprani: 11, Contralti: 11, Tenori: 7, Bassi: 8 }, tu: true },
  { data: '2026-09-26', presenti: { Soprani: 12, Contralti: 10, Tenori: 8, Bassi: 9 }, tu: true },
  { data: '2026-09-22', presenti: { Soprani: 10, Contralti: 10, Tenori: 7, Bassi: 8 }, tu: true },
  { data: '2026-09-15', presenti: { Soprani: 9, Contralti: 9, Tenori: 6, Bassi: 8 }, tu: false },
  { data: '2026-09-08', presenti: { Soprani: 11, Contralti: 10, Tenori: 7, Bassi: 7 }, tu: true },
  { data: '2026-09-01', presenti: { Soprani: 8, Contralti: 8, Tenori: 5, Bassi: 6 }, tu: true, nota: 'prima prova dopo la pausa estiva' },
];

// ——— Avvisi della bacheca ———
// Fonte nel sito vero: foglio "Avvisi" del direttivo (data, autore, titolo, testo), scritto
// dalle pagine di amministrazione del sito.
export const avvisi: { data: string; autore: string; titolo: string; testo: string; nuovo?: boolean }[] = [
  {
    data: '2026-09-29', autore: 'La Direttrice', nuovo: true,
    titolo: 'Lacrimosa: studiatelo con la base',
    testo: 'Martedì riprendiamo le ultime otto battute. Riascoltate la registrazione di stasera: si sente bene dove rallentiamo.',
  },
  {
    data: '2026-09-28', autore: 'Il Presidente', nuovo: true,
    titolo: 'Requiem del 18 ottobre: passaparola',
    testo: 'Le locandine sono nel Drive, cartella «Comunicazione». Chi può ne stampi qualcuna per la parrocchia, il lavoro e i negozi del quartiere.',
  },
  {
    data: '2026-09-18', autore: 'Il Tesoriere',
    titolo: 'Quote associative 2026/27',
    testo: 'Si versano alla prova oppure con bonifico: le coordinate sono nel Drive, cartella «Associazione».',
  },
];

// ——— Formattazione ———

export const giorno = (iso: string) => parti({ data: iso });
// "21 set"
export const dataBreve = (iso: string) => { const d = giorno(iso); return `${Number(d.giorno)} ${d.meseBreve.toLowerCase()}`; };
// "28 settembre 2026"
export const dataEstesa = (iso: string) => { const d = giorno(iso); return `${Number(d.giorno)} ${d.mese.toLowerCase()} ${d.anno}`; };
// "martedì 6 ottobre"
export const dataGiorno = (iso: string) => { const d = giorno(iso); return `${d.giornoSettimana.toLowerCase()} ${Number(d.giorno)} ${d.mese.toLowerCase()}`; };

// "Tra 6 giorni", rispetto a OGGI
export function traGiorni(iso: string) {
  const n = Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(OGGI)) / 86_400_000);
  return n <= 0 ? 'Oggi' : n === 1 ? 'Domani' : `Tra ${n} giorni`;
}

export const percento = (parte: number, totale: number) => `${totale ? Math.round((parte / totale) * 1000) / 10 : 0}%`;

export const iniziali = (nome: string) => nome.split(/\s+/).map((p) => p.charAt(0)).join('').toUpperCase();
