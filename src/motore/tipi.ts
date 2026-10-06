// Tipi dei dati del coro condivisi da tutte le vesti.

export type Brano = {
  // Autore per esteso con date, o abbreviato: "W. A. Mozart (1756–1791)"
  autore?: string;
  opera: string;
  organico?: string;   // "per soli, coro e orchestra"
  parti?: string[];    // movimenti o brani, per il programma dettagliato
  // Traduzioni inglesi dell'opera e dell'organico (righe "Opera EN:" e "Organico EN:" dopo l'opera)
  en?: { opera?: string; organico?: string };
};

export type Concerto = {
  // Data ISO: "2026-10-18" (solo giorno) o "2026-10-18T18:00" (con orario, ora di Roma).
  // Per i concerti di cui si conosce solo l'anno: un giorno qualsiasi di quella stagione con
  // dataIncerta (riga "Data: solo l'anno" dell'evento), e il sito mostra solo l'anno.
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
  altriVideo?: string[]; // altri video del concerto (estratti, altre parti): righe "Video:" dopo la prima
  foto?: string;         // nome del file in coro/immagini
  locandina?: string;    // locandina ufficiale (file in coro/immagini), al posto di quella generata
  evidenza?: string;     // etichetta speciale: "Il primo concerto del coro"
  home?: boolean;        // in home page (riga "Home: sì/no" dell'evento); senza, solo se è in programma
  // Traduzioni nell'evento ("Evidenza EN: …", scritte dal modulo dell'Amministrazione): hanno la
  // precedenza su quelle automatiche. Titolo e organico sono delle righe di prima del 6/10/2026, valgono
  // per la prima e per l'ultima opera; quelle nuove stanno sulle opere (Brano.en)
  en?: Partial<Record<'titolo' | 'evidenza' | 'organico' | 'ingresso', string>>;
};

export type Video = {
  id: string;
  titolo: string;
  autore?: string;       // per il raggruppamento nella pagina Ascolta
  sottotitolo?: string;  // "Concerto · Bologna, 18 ottobre 2025"
  pubblicato: string;    // data ISO
  miniatura?: string;    // file in coro/immagini, al posto della miniatura YouTube (demo)
};
