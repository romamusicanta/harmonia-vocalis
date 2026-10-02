// Video del canale YouTube.
// Con un canale vero l'elenco arriva dal feed RSS (ultimi 15 video): qui restano
// l'istantanea di riserva e, per ogni video, l'autore con cui raggrupparlo nella pagina Ascolta.
// Sono i video veri del canale @romamusicanta del Coro Harmonia Vocalis (istantanea del feed);
// titoli e sottotitoli come nel mockup della pagina Ascolta.
import type { Video } from '../src/motore/tipi';

export const canaleId: string | undefined = 'UC0gvYeL7mHpCwht3qjS5vag';

// Video in evidenza nella pagina Ascolta
export const inEvidenza = '43p4ArVIS_Q';

export const video: Video[] = [
  { id: 'od458Vk0BmQ', titolo: 'Messiah HWV 56: selezione dei brani del coro', autore: 'G. F. Händel', sottotitolo: 'Estratto', pubblicato: '2025-07-15' },
  { id: '43p4ArVIS_Q', titolo: 'Messiah HWV 56', autore: 'G. F. Händel', sottotitolo: 'Concerto · Roma, 11 maggio 2025', pubblicato: '2025-07-14' },
  { id: 'ptvL9ydrbIM', titolo: 'Hallelujah, dal Messiah', autore: 'G. F. Händel', sottotitolo: 'Estratto', pubblicato: '2025-07-13' },
  { id: 'ESqOQh6mrDo', titolo: 'Carmina Burana', autore: 'C. Orff', sottotitolo: 'Racconto della cantata scenica · Velletri, 22 giugno 2024', pubblicato: '2024-08-25' },
  { id: 'ox_zFSGyXZo', titolo: 'Qui tollis, dalla Grande Messa K 427', autore: 'W. A. Mozart', sottotitolo: 'Estratto con immagini', pubblicato: '2024-03-17' },
  // DA VERIFICARE: la Grande Messa è stata eseguita il 13/12/2023 a Marino e il 21/12 a Velletri; la data del 21 viene dal mockup
  { id: 'EfSxLDcj97I', titolo: 'Grande Messa in do minore K 427', autore: 'W. A. Mozart', sottotitolo: 'Concerto · Velletri, 21 dicembre 2023', pubblicato: '2024-01-01' },
  { id: 'vPuK-b7jOiA', titolo: 'Requiem K 626', autore: 'W. A. Mozart', sottotitolo: 'Concerto · Roma, 29 ottobre 2023', pubblicato: '2023-11-23' },
  { id: 'mArCEamDJZ4', titolo: 'Requiem K 626: Introitus, Kyrie, Dies irae', autore: 'W. A. Mozart', sottotitolo: 'Estratto', pubblicato: '2023-11-06' },
  { id: 'pJvyedPkzlI', titolo: 'Petite Messe Solennelle', autore: 'G. Rossini', sottotitolo: 'Versione orchestrale · Santa Marinella, 6 maggio 2023', pubblicato: '2023-05-25' },
  { id: 'DEUzTqAdSA0', titolo: 'Missa Choralis: Sanctus e Benedictus', autore: 'F. Liszt', sottotitolo: 'Estratto', pubblicato: '2023-03-30' },
  { id: 'QAgZzVQWjog', titolo: 'Missa Choralis: Credo', autore: 'F. Liszt', sottotitolo: 'Estratto', pubblicato: '2023-03-20' },
  { id: 'biR2coCLpsI', titolo: 'Missa Choralis: Kyrie', autore: 'F. Liszt', sottotitolo: 'Estratto', pubblicato: '2023-03-19' },
  { id: 'uRrnUCW4meQ', titolo: 'Ave Maria op. 2 n. 2', autore: 'E. Elgar', sottotitolo: 'Coro e orchestra · revisione del M° Micheli', pubblicato: '2023-02-05' },
  { id: 'IG1OVZOJSh0', titolo: 'Canta con noi!', autore: 'Il coro', sottotitolo: 'Il video per chi vuole unirsi al coro', pubblicato: '2023-01-15' },
  { id: 'npQOar9OliU', titolo: 'Stabat Mater', autore: 'G. Rossini', sottotitolo: 'Concerto · Cerveteri, 5 dicembre 2021', pubblicato: '2022-12-20' },
];
