// Testi lunghi del coro, in Markdown in coro/testi/<nome>.md (intestazione YAML + corpo).
import type { MarkdownInstance } from 'astro';

const testi = import.meta.glob<MarkdownInstance<Record<string, any>>>('/coro/testi/*.md', { eager: true });

export function testo<T extends Record<string, any> = Record<string, any>>(nome: string) {
  const t = testi[`/coro/testi/${nome}.md`];
  if (!t) throw new Error(`Testo non trovato: coro/testi/${nome}.md`);
  return { dati: t.frontmatter as T, Contenuto: t.Content };
}
