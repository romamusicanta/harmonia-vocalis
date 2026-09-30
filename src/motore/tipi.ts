// Tipi dei dati del coro condivisi da tutte le vesti.

export type Brano = {
  // Autore per esteso con date, o abbreviato: "W. A. Mozart (1756–1791)"
  autore?: string;
  opera: string;
  organico?: string;   // "per soli, coro e orchestra"
  parti?: string[];    // movimenti o brani, per il programma dettagliato
};

export type Concerto = {
  // Data ISO: "2026-10-18" (solo giorno) o "2026-10-18T18:00" (con orario, ora di Roma).
  // Per i concerti di cui si conosce solo l'anno: "2019" con dataIncerta.
  data: string;
  dataIncerta?: boolean;
  autore?: string;       // abbreviato, per le schede: "W. A. Mozart"
  titolo: string;        // opera o titolo del programma: "Requiem K 626"
  rassegna?: string;
  luogo?: string;        // città: "Bologna"
  sala?: string;         // "Chiesa di San Giacomo"
  indirizzo?: string;    // indirizzo completo, per la mappa (dal calendario, se scelto da Google Maps)
  organizza?: string;
  ingresso?: string;
  programma?: Brano[];
  interpreti?: { ruolo: string; nome?: string; nota?: string }[];
  video?: string;        // ID del video YouTube, se c'è la registrazione
  foto?: string;         // nome del file in coro/immagini
  evidenza?: string;     // etichetta speciale: "Il primo concerto del coro"
};

export type Video = {
  id: string;
  titolo: string;
  autore?: string;       // per il raggruppamento nella pagina Ascolta
  sottotitolo?: string;  // "Concerto · Bologna, 18 ottobre 2025"
  pubblicato: string;    // data ISO
  miniatura?: string;    // file in coro/immagini, al posto della miniatura YouTube (demo)
};
