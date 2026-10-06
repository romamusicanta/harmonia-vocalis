// Traduzioni inglesi dei concerti: il dizionario delle voci ricorrenti e le istruzioni per Claude.
// Le usano la build (src/motore/inglese.ts, per i testi che l'evento non traduce) e il modulo del
// concerto dell'Amministrazione (src/admin/concerto.ts), che scrive le traduzioni nell'evento.

export const DIZIONARIO: Record<string, string> = {
  // Ruoli
  soprano: 'Soprano', soprani: 'Sopranos', mezzosoprano: 'Mezzo-soprano', contralto: 'Contralto', contralti: 'Contraltos',
  tenore: 'Tenor', tenori: 'Tenors', baritono: 'Baritone', baritoni: 'Baritones', basso: 'Bass', bassi: 'Basses',
  controtenore: 'Countertenor', solisti: 'Soloists', orchestra: 'Orchestra', direttore: 'Conductor',
  'maestro del coro': 'Chorus master', 'maestro dei cori': 'Chorus master', 'maestro di coro': 'Chorus master',
  'canta insieme a noi': 'Also singing', pianoforte: 'Piano', pianoforti: 'Pianos', organo: 'Organ',
  percussioni: 'Percussion', 'voce recitante': 'Narrator', ensemble: 'Ensemble', coro: 'Choir', cori: 'Choirs',
  // Ingresso
  libero: 'Free admission', 'ingresso libero': 'Free admission', 'a offerta libera': 'Free, donations welcome',
  'a offerta': 'Free, donations welcome', 'offerta libera': 'Free, donations welcome',
  // Organico
  'per soli, coro e orchestra': 'for soloists, choir and orchestra',
  'oratorio per soli, coro e orchestra': 'oratorio for soloists, choir and orchestra',
};

export const daDizionario = (t: string): string | undefined => DIZIONARIO[t.trim().toLowerCase()];

export const ISTRUZIONI = `You translate short texts from the concert archive of an Italian choir into British English, for its website.
Rules:
- Return exactly one item per input text, with the input copied unchanged in "it".
- Keep proper names unchanged: people, choirs, orchestras, places, festivals, institutions.
- Musical works: use the title usual in English concert programmes. Keep Latin and established original titles (Requiem, Stabat Mater, Carmina Burana, Messa di Gloria, Petite Messe Solennelle, Missa in Angustiis, Messiah). Translate key signatures ("in re minore" → "in D minor") and generic words ("Grande Messa" → "Great Mass", "Concerto per Santa Lucia" → "Concert for Saint Lucy"). Write catalogue numbers as "K. 626", "HWV 56".
- Performer roles: the usual English term (Soprano, Mezzo-soprano, Tenor, Conductor…).
- Video titles and captions: "Concerto · Roma, 11 maggio 2025" → "Concert · Rome, 11 May 2025"; "selezione dei brani del coro" → "selection of the choral movements".
- Short, plain, no added words or quotes.`;
