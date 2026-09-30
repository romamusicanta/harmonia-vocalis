// Logo del coro, facoltativo. Se esiste coro/Logo.astro, i marchi di tutte le vesti lo usano
// al posto di sigla e nome. Il logo disegna con currentColor (la veste decide il colore:
// scuro su fondo chiaro, bianco su fondo scuro) e può usare var(--accento) per un dettaglio.
// I caratteri che il logo usa si dichiarano in coro.config.ts, aspetto.caratteriLogo.
type Componente = (props: any) => any;

const trovati = import.meta.glob<Componente>('/coro/Logo.astro', { eager: true, import: 'default' });

export const Logo: Componente | undefined = Object.values(trovati)[0];
