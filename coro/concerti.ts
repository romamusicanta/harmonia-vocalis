// Concerti del coro.
// - prossimi: usati solo se il calendario Google non è configurato o non risponde
//   (con il calendario, i prossimi concerti arrivano da lì);
// - archivio: curato a mano, con gli ID dei video YouTube dove c'è la registrazione.
// Dati INVENTATI per la demo.
import type { Concerto } from '../src/motore/tipi';

const requiem = {
  autore: 'W. A. Mozart (1756–1791)',
  opera: 'Requiem in re minore K 626',
  organico: 'per soli, coro e orchestra',
  parti: ['Introitus', 'Kyrie', 'Dies irae', 'Tuba mirum', 'Rex tremendae', 'Recordare', 'Confutatis', 'Lacrimosa', 'Domine Jesu', 'Hostias', 'Sanctus', 'Benedictus', 'Agnus Dei', 'Lux aeterna'],
};

export const prossimi: Concerto[] = [
  {
    data: '2026-10-18T18:00',
    autore: 'W. A. Mozart',
    titolo: 'Requiem K 626',
    rassegna: 'Autunno in musica 2026',
    luogo: 'Bologna',
    sala: 'Chiesa di San Giacomo',
    organizza: 'Quartiere Santo Stefano',
    ingresso: 'Libero fino a esaurimento posti',
    programma: [requiem],
    interpreti: [
      { ruolo: 'Orchestra', nome: 'Orchestra da camera Esempio' },
      { ruolo: 'Solisti', nota: 'Soprano, contralto, tenore, basso' },
    ],
    foto: 'concerto-chiesa.jpg',
  },
  {
    data: '2026-12-19T21:00',
    autore: 'J. S. Bach',
    titolo: 'Magnificat BWV 243',
    rassegna: 'Concerto di Natale',
    luogo: 'Imola',
    sala: 'Chiesa del Suffragio',
    organizza: 'Parrocchia del Suffragio',
    ingresso: 'Offerta libera per la Caritas cittadina',
    programma: [
      { autore: 'J. S. Bach (1685–1750)', opera: 'Magnificat in re maggiore BWV 243', organico: 'per soli, coro e orchestra' },
      { opera: 'Canti della tradizione natalizia', organico: 'coro a cappella' },
    ],
    foto: 'coro-palco.jpg',
  },
  {
    data: '2027-03-20',
    autore: 'J. Brahms',
    titolo: 'Ein deutsches Requiem',
    luogo: 'Modena',
    sala: 'Teatro San Carlo',
    programma: [{ autore: 'J. Brahms (1833–1897)', opera: 'Ein deutsches Requiem op. 45', organico: 'versione di Londra, per soli, coro e due pianoforti' }],
    foto: 'teatro.jpg',
  },
];

export const archivio: Concerto[] = [
  { data: '2026-06-06T21:00', autore: 'C. Orff', titolo: 'Carmina Burana', luogo: 'Bologna', sala: 'Auditorium Manzoni', foto: 'sala-concerti.jpg', video: 'demo-orff-2026' },
  { data: '2026-03-28', autore: 'G. B. Pergolesi', titolo: 'Stabat Mater', luogo: 'Ferrara', foto: 'concerto-chiesa.jpg' },
  { data: '2025-12-20', autore: 'A. Vivaldi', titolo: 'Gloria RV 589', luogo: 'Bologna', rassegna: 'Concerto di Natale', foto: 'coro-palco.jpg', video: 'demo-vivaldi-2025' },
  { data: '2025-10-18', autore: 'G. Rossini', titolo: 'Petite Messe Solennelle', luogo: 'Bologna', sala: 'Basilica di San Francesco', foto: 'teatro.jpg', video: 'demo-rossini-2025' },
  { data: '2025-05-24', autore: 'G. F. Händel', titolo: 'Messiah HWV 56', luogo: 'Bologna', video: 'demo-handel-2025' },
  { data: '2025-04-12', titolo: 'Polifonia della Settimana Santa', luogo: 'Imola', rassegna: 'Rassegna corale di Primavera' },
  { data: '2024-12-14', autore: 'J. Rutter', titolo: 'Gloria e canti di Natale', luogo: 'Castel San Pietro Terme' },
  { data: '2024-10-26', autore: 'W. A. Mozart', titolo: 'Requiem K 626', luogo: 'Bologna', sala: 'Chiesa di San Giacomo', video: 'demo-mozart-2024' },
  { data: '2024-06-15', autore: 'C. Monteverdi', titolo: 'Vespro della Beata Vergine', luogo: 'Ravenna', rassegna: 'Festival di musica antica' },
  { data: '2023-12-16', autore: 'A. Vivaldi', titolo: 'Gloria RV 589', luogo: 'Modena' },
  { data: '2023-05-20', autore: 'G. Fauré', titolo: 'Requiem op. 48', luogo: 'Bologna', video: 'demo-faure-2023' },
  { data: '2022-11-19', autore: 'G. Rossini', titolo: 'Stabat Mater', luogo: 'Faenza' },
  { data: '2012', dataIncerta: true, autore: 'C. Monteverdi', titolo: 'Vespro della Beata Vergine', luogo: 'Bologna', evidenza: 'Il primo concerto del coro' },
];
