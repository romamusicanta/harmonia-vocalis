// Ordine dei pezzi per autore, comune al repertorio dell'area riservata e al «Repertorio pronto»
// della pagina Per gli organizzatori.
// L'autore si scrive "W. A. Mozart" (iniziali puntate, poi il cognome), oppure "Anonimo" o
// "Tradizionale": si ordina per cognome, poi per iniziali, poi per titolo
const INIZIALI = /^((?:\p{Lu}\.\s*)+)/u;
export function cognomeEIniziali(autore: string) {
  const a = autore.trim();
  const iniziali = a.match(INIZIALI)?.[1] ?? '';
  return { cognome: a.slice(iniziali.length).trim() || a, iniziali: iniziali.replace(/\s+/g, '') };
}
export const confronta = (x: string, y: string) => x.localeCompare(y, 'it', { sensitivity: 'base' });
export const perAutore = (a: { autore: string; titolo: string }, b: { autore: string; titolo: string }) => {
  const ka = cognomeEIniziali(a.autore), kb = cognomeEIniziali(b.autore);
  return confronta(ka.cognome, kb.cognome) || confronta(ka.iniziali, kb.iniziali) || confronta(a.titolo, b.titolo);
};
