// Dati di riserva, usati quando il calendario Google "Concerti" non è collegato
// (variabile CALENDARIO_CONCERTI_ICS non impostata) o non risponde.

export type Concerto = {
  titolo: string;
  programma?: string;
  data: string; // ISO; se manca l'ora si mostra solo il giorno
  luogo: string;
  organizzatore?: string;
  note?: string;
};

export const prossimiConcerti: Concerto[] = [
  {
    titolo: 'Autunno Musicale 2026',
    programma: 'W. A. Mozart — Requiem K 626',
    data: '2026-10-04',
    luogo: 'Rignano Flaminio (RM)',
    organizzatore: 'Comune di Rignano Flaminio',
  },
];

// Archivio dei programmi eseguiti, collegati alle registrazioni sul canale YouTube.
// Anni ricavati da italiacori e dalle date di pubblicazione dei video: DA VERIFICARE.
export type Programma = {
  autore: string;
  opera: string;
  anno: number;
  luoghi?: string;
  video?: string; // ID del video YouTube
  estratti?: { titolo: string; video: string }[];
};

export const archivio: Programma[] = [
  {
    autore: 'G. F. Händel',
    opera: 'Messiah HWV 56',
    anno: 2025,
    video: '43p4ArVIS_Q',
    estratti: [
      { titolo: 'Selezione brani del coro', video: 'od458Vk0BmQ' },
      { titolo: 'Hallelujah', video: 'ptvL9ydrbIM' },
    ],
  },
  {
    autore: 'C. Orff',
    opera: 'Carmina Burana',
    anno: 2024,
    luoghi: 'Velletri, 22 giugno 2024',
    video: 'ESqOQh6mrDo',
  },
  {
    autore: 'G. Puccini',
    opera: 'Messa di Gloria',
    anno: 2024,
  },
  {
    autore: 'W. A. Mozart',
    opera: 'Grande Messa in do minore K 427',
    anno: 2023,
    luoghi: '21 dicembre 2023',
    video: 'EfSxLDcj97I',
    estratti: [{ titolo: 'Qui tollis', video: 'ox_zFSGyXZo' }],
  },
  {
    autore: 'W. A. Mozart',
    opera: 'Requiem K 626',
    anno: 2023,
    video: 'vPuK-b7jOiA',
    estratti: [{ titolo: 'Introitus, Kyrie, Dies irae', video: 'mArCEamDJZ4' }],
  },
  {
    autore: 'G. Rossini',
    opera: 'Petite Messe Solennelle (versione orchestrale)',
    anno: 2023,
    video: 'pJvyedPkzlI',
  },
  {
    autore: 'F. Liszt',
    opera: 'Missa Choralis',
    anno: 2023,
    estratti: [
      { titolo: 'Kyrie', video: 'biR2coCLpsI' },
      { titolo: 'Credo', video: 'QAgZzVQWjog' },
      { titolo: 'Sanctus e Benedictus', video: 'DEUzTqAdSA0' },
    ],
  },
  {
    autore: 'E. Elgar',
    opera: 'Ave Maria op. 2 n. 2',
    anno: 2023,
    video: 'uRrnUCW4meQ',
  },
  {
    autore: 'W. A. Mozart',
    opera: 'Requiem K 626',
    anno: 2022,
    luoghi: 'Velletri, 6 marzo 2022',
  },
  {
    autore: 'G. Rossini',
    opera: 'Stabat Mater',
    anno: 2021,
    luoghi: 'Cerveteri, 5 dicembre 2021',
    video: 'npQOar9OliU',
  },
  {
    autore: 'F. J. Haydn',
    opera: 'Missa in Angustiis (Nelson-Messe)',
    anno: 2019,
    luoghi: 'Roma e Segni — il primo concerto del coro',
  },
];
