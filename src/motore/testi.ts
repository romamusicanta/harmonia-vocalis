// Testi lunghi del coro, in Markdown in coro/testi/<nome>.md (intestazione YAML + corpo).
import type { MarkdownInstance } from 'astro';

// La versione inglese sta in coro/testi/en/<nome>.md; se manca, resta l'italiano.
// I testi cambiati dall'Amministrazione (src/motore/testiSito.ts) vincono: i campi dell'intestazione
// salvati, e il corpo da coro/immagini/drive/testi/<nome>.md (scritto prima della build).
import type { Lingua } from './lingua';
import { campiDelTesto } from './testiSito';

const testi = import.meta.glob<MarkdownInstance<Record<string, any>>>(['/coro/testi/{*,en/*}.md', '/coro/immagini/drive/testi/{*,en/*}.md'], { eager: true });
const DEMO = process.env.DEMO === '1';

export function testo<T extends Record<string, any> = Record<string, any>>(nome: string, lingua: Lingua = 'it') {
  const drive = (percorso: string) => (DEMO ? undefined : testi[`/coro/immagini/drive/testi/${percorso}`]);
  const t = (lingua === 'en' && (drive(`en/${nome}.md`) ?? testi[`/coro/testi/en/${nome}.md`])) || drive(`${nome}.md`) || testi[`/coro/testi/${nome}.md`];
  if (!t) throw new Error(`Testo non trovato: coro/testi/${nome}.md`);
  // titoli: le sottosezioni del corpo ("## titolo"), con l'identificativo per i link
  return {
    dati: { ...t.frontmatter, ...(DEMO ? {} : campiDelTesto(nome, lingua)) } as T,
    Contenuto: t.Content,
    titoli: t.getHeadings().filter((h) => h.depth === 2),
    markdown: t.rawContent(),
  };
}
