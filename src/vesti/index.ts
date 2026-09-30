// Registro delle vesti grafiche, costruito da solo leggendo le cartelle src/vesti/<veste>/.
//
// Stagione è la veste di base: le sue pagine e le sue classi CSS sono il vocabolario comune.
// Ogni altra veste:
//   - carica sempre stagione/stile.css e sopra il proprio stile.css, che ridefinisce ciò che cambia;
//   - può ridefinire i componenti dei punti chiave con un file omonimo nella propria cartella
//     (Testata, Piede, TestataArea, PiedeArea, Home, SchedaConcerto); quelli che mancano
//     vengono da Stagione.
// Una veste è pronta (selezionabile nella demo) quando la sua cartella ha stile.css.
import type { Veste } from '../motore/aspetto';

type Componente = (props: any) => any;
const NOMI = ['Testata', 'Piede', 'TestataArea', 'PiedeArea', 'Home', 'SchedaConcerto'] as const;
type NomeComponente = (typeof NOMI)[number];

export type ComponentiVeste = Record<NomeComponente, Componente> & { stili: string[] };

const componenti = import.meta.glob<Componente>('./*/*.astro', { eager: true, import: 'default' });
const stili = import.meta.glob<string>('./*/stile.css', { eager: true, query: '?url', import: 'default' });

const cartella = (percorso: string) => percorso.split('/')[1];

export const vestiConStile = Object.keys(stili).map(cartella) as Veste[];

function componente(veste: string, nome: NomeComponente): Componente {
  return componenti[`./${veste}/${nome}.astro`] ?? componenti[`./stagione/${nome}.astro`];
}

export function componentiVeste(veste: Veste): ComponentiVeste {
  const v = vestiConStile.includes(veste) ? veste : 'stagione';
  const fogli = v === 'stagione' ? [stili['./stagione/stile.css']] : [stili['./stagione/stile.css'], stili[`./${v}/stile.css`]];
  return { ...(Object.fromEntries(NOMI.map((n) => [n, componente(v, n)])) as Record<NomeComponente, Componente>), stili: fogli };
}

export const vesti = new Proxy({} as Record<Veste, ComponentiVeste>, {
  get: (_, veste: string) => componentiVeste(veste as Veste),
});
