// Video del canale YouTube.
// Con un canale vero l'elenco arriva dal feed RSS (ultimi 15 video): qui restano
// l'istantanea di riserva e, per ogni video, l'autore con cui raggrupparlo nella pagina Ascolta.
// Video INVENTATI per la demo: gli ID non esistono su YouTube, le miniature sono in coro/immagini.
import type { Video } from '../src/motore/tipi';

export const canaleId: string | undefined = undefined;

// Video in evidenza nella pagina Ascolta
export const inEvidenza = 'demo-handel-2025';

export const video: Video[] = [
  { id: 'demo-orff-2026', titolo: 'Carmina Burana', autore: 'C. Orff', sottotitolo: 'Concerto · Bologna, 6 giugno 2026', pubblicato: '2026-06-20', miniatura: 'sala-concerti.jpg' },
  { id: 'demo-vivaldi-2025', titolo: 'Gloria RV 589', autore: 'A. Vivaldi', sottotitolo: 'Concerto di Natale · Bologna, 20 dicembre 2025', pubblicato: '2026-01-08', miniatura: 'coro-palco.jpg' },
  { id: 'demo-rossini-2025', titolo: 'Petite Messe Solennelle', autore: 'G. Rossini', sottotitolo: 'Concerto · Bologna, 18 ottobre 2025', pubblicato: '2025-11-02', miniatura: 'teatro.jpg' },
  { id: 'demo-handel-2025', titolo: 'Messiah HWV 56', autore: 'G. F. Händel', sottotitolo: 'Concerto completo · Bologna, 24 maggio 2025', pubblicato: '2025-06-10', miniatura: 'concerto-chiesa.jpg' },
  { id: 'demo-handel-hallelujah', titolo: 'Hallelujah, dal Messiah', autore: 'G. F. Händel', sottotitolo: 'Estratto', pubblicato: '2025-06-12', miniatura: 'coro-palco.jpg' },
  { id: 'demo-mozart-2024', titolo: 'Requiem K 626', autore: 'W. A. Mozart', sottotitolo: 'Concerto · Bologna, 26 ottobre 2024', pubblicato: '2024-11-15', miniatura: 'concerto-chiesa.jpg' },
  { id: 'demo-mozart-lacrimosa', titolo: 'Lacrimosa, dal Requiem K 626', autore: 'W. A. Mozart', sottotitolo: 'Estratto', pubblicato: '2024-11-16', miniatura: 'teatro.jpg' },
  { id: 'demo-faure-2023', titolo: 'Requiem op. 48', autore: 'G. Fauré', sottotitolo: 'Concerto · Bologna, 20 maggio 2023', pubblicato: '2023-06-01', miniatura: 'sala-concerti.jpg' },
  { id: 'demo-canta-con-noi', titolo: 'Canta con noi!', autore: 'Il coro', sottotitolo: 'Un anno di prove e concerti in tre minuti', pubblicato: '2025-09-01', miniatura: 'leggio.jpg' },
];
