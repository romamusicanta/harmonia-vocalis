// @ts-check
import { readdirSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Pagine fuori dalla sitemap (sono anche noindex): l'anteprima dell'area coristi e le vesti
// in prova, che stanno sotto /<veste>/
const vesti = readdirSync('src/vesti', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const escluse = new RegExp(`^/(area|${vesti.join('|')})(/|$)`);

// https://astro.build/config
export default defineConfig({
  // Indirizzo ufficiale del sito (lo stesso di coro.url): per canonical e sitemap
  site: 'https://romamusicanta.org',
  integrations: [sitemap({ filter: (pagina) => !escluse.test(new URL(pagina).pathname) })],
  // Indirizzi senza barra finale, come nei link interni: /concerti, /area/prove
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // Porta del server di sviluppo: PORT se assegnata (pannello browser), altrimenti 4321
  server: { port: Number(process.env.PORT) || 4321 },
});
