// Concerti del coro.
// - prossimi: usati solo se il calendario Google non è configurato o non risponde
//   (con il calendario, i prossimi concerti arrivano da lì);
// - archivio: curato a mano, con gli ID dei video YouTube dove c'è la registrazione.
// Sono i dati del Coro Harmonia Vocalis, dal mockup del sito e da italiacori.
// DA VERIFICARE: anni e luoghi dell'archivio sono ricavati da italiacori e dalle date di
// pubblicazione dei video; vanno confermati dal direttivo.
import type { Concerto } from '../src/motore/tipi';

const requiem = {
  autore: 'W. A. Mozart (1756–1791)',
  opera: 'Requiem in re minore K 626',
  organico: 'per soli, coro e orchestra',
  parti: ['Introitus', 'Kyrie', 'Dies irae', 'Tuba mirum', 'Rex tremendae', 'Recordare', 'Confutatis', 'Lacrimosa', 'Domine Jesu', 'Hostias', 'Sanctus', 'Benedictus', 'Agnus Dei', 'Lux aeterna'],
};

export const prossimi: Concerto[] = [
  {
    // Dati dalla locandina ufficiale (coro/immagini/locandina-rignano.jpg)
    data: '2026-10-04T20:30',
    autore: 'W. A. Mozart',
    titolo: 'Requiem in re minore K 626',
    rassegna: 'Autunno Musicale 2026',
    luogo: 'Rignano Flaminio (RM)',
    sala: 'Chiesa di S. Giuseppe',
    indirizzo: 'Chiesa di S. Giuseppe, Via Carlo Alberto dalla Chiesa, 1, 00068 Rignano Flaminio RM, Italia',
    organizza: 'Comune di Rignano Flaminio',
    ingresso: 'libero',
    evidenza: "Per gli 800 anni dalla morte di San Francesco d'Assisi",
    programma: [requiem],
    interpreti: [
      { ruolo: 'Orchestra', nome: 'Orchestra delle Cento Città' },
      { ruolo: 'Canta insieme a noi', nome: 'Coro Ruggero Giovannelli' },
      { ruolo: 'Soprano', nome: 'Anastasia Demchenko' },
      { ruolo: 'Contralto', nome: 'Stefania Scolastici' },
      { ruolo: 'Tenore', nome: 'Antonio Sapio' },
      { ruolo: 'Basso', nome: 'Massimo Simeoli' },
    ],
    foto: 'terme.jpg',
    locandina: 'locandina-rignano.jpg',
  },
];

export const archivio: Concerto[] = [
  // Dalla stagione 2024/25 i concerti di cui abbiamo la locandina sono nel calendario "Concerti"
  // (eventi passati, con la locandina allegata): qui restano solo gli altri.

  // Stagione 2024/25
  // DA VERIFICARE: la locandina del Festival Sacro del Lazio 2025 (17/5, Campagnano) non nomina il coro
  { data: '2025-05-17', titolo: 'Festival Sacro', luogo: 'Campagnano di Roma' },
  { data: '2024-12-21', autore: 'G. Puccini', titolo: 'Messa di Gloria', luogo: 'Segni' },
  { data: '2024-12-13', titolo: 'Concerto di Santa Lucia', luogo: 'Marino' },
  { data: '2024-11-30', autore: 'G. Puccini', titolo: 'Messa di Gloria', luogo: 'Albano Laziale' },
  { data: '2024-11-24', autore: 'G. Fauré · G. Puccini', titolo: 'Fauré e Puccini', luogo: 'Roma' },

  // Stagione 2023/24
  { data: '2024-08-31', autore: 'C. Orff', titolo: 'Carmina Burana', luogo: 'Anagni', rassegna: 'Festival Medievale' },
  { data: '2024-06-22', autore: 'C. Orff', titolo: 'Carmina Burana', luogo: 'Velletri', video: 'ESqOQh6mrDo' },
  { data: '2024-06-21', autore: 'C. Orff', titolo: 'Carmina Burana', luogo: 'Roma' },
  { data: '2024-05-19', autore: 'G. Puccini', titolo: 'Messa di Gloria', luogo: 'Roma' },
  // DA VERIFICARE: data da precisare (nel mockup è nella stagione 2023/24; con il solo anno
  // il modello la mette nella 2024/25)
  { data: '2024', dataIncerta: true, autore: 'W. A. Mozart', titolo: 'Grande Messa in do minore K 427', luogo: 'Roma' },
  { data: '2023-12-21', autore: 'W. A. Mozart', titolo: 'Grande Messa in do minore K 427', luogo: 'Marino', video: 'EfSxLDcj97I' },
  { data: '2023-10-29', autore: 'W. A. Mozart', titolo: 'Requiem K 626', luogo: 'Roma', video: 'vPuK-b7jOiA' },

  // Stagione 2022/23
  { data: '2023-05-06', autore: 'G. Rossini', titolo: 'Petite Messe Solennelle', luogo: 'Santa Marinella', video: 'pJvyedPkzlI' },
  // DA VERIFICARE: data da precisare (nel mockup sono nella stagione 2022/23; con il solo anno
  // il modello le mette nella 2023/24)
  { data: '2023', dataIncerta: true, autore: 'G. Puccini', titolo: 'Musiche di Puccini', luogo: 'Marino' },
  // Tre estratti video: Kyrie (qui), Credo (QAgZzVQWjog), Sanctus e Benedictus (DEUzTqAdSA0)
  { data: '2023', dataIncerta: true, autore: 'F. Liszt', titolo: 'Missa Choralis', luogo: 'Velletri e Frattocchie (Marino)', video: 'biR2coCLpsI' },

  // Stagione 2021/22
  { data: '2022-05-21', autore: 'W. A. Mozart', titolo: 'Requiem K 626', luogo: 'Grosseto' },
  { data: '2022-04-09', titolo: 'Concerto', luogo: 'Bolsena' },
  { data: '2022-03-06', autore: 'W. A. Mozart', titolo: 'Requiem K 626', luogo: 'Velletri' },
  { data: '2021-12-05', autore: 'G. Rossini', titolo: 'Stabat Mater', luogo: 'Cerveteri', video: 'npQOar9OliU' },

  // Stagione 2019/20
  // DA VERIFICARE: data da precisare ("fine 2019")
  { data: '2019', dataIncerta: true, autore: 'F. J. Haydn', titolo: 'Missa in Angustiis', luogo: 'Roma e Segni', evidenza: 'Il primo concerto del coro' },
];
