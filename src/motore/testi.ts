// Testi lunghi del coro, in Markdown in coro/testi/<nome>.md (intestazione YAML + corpo).
import type { MarkdownInstance } from 'astro';

// La versione inglese sta in coro/testi/en/<nome>.md; se manca, resta l'italiano.
import type { Lingua } from './lingua';

const testi = import.meta.glob<MarkdownInstance<Record<string, any>>>('/coro/testi/{*,en/*}.md', { eager: true });

export function testo<T extends Record<string, any> = Record<string, any>>(nome: string, lingua: Lingua = 'it') {
  const t = (lingua === 'en' && testi[`/coro/testi/en/${nome}.md`]) || testi[`/coro/testi/${nome}.md`];
  if (!t) throw new Error(`Testo non trovato: coro/testi/${nome}.md`);
  return { dati: t.frontmatter as T, Contenuto: t.Content };
}
