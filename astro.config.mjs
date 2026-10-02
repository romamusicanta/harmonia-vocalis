// @ts-check
import { readdirSync } from 'node:fs';
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// Pagine fuori dalla sitemap (sono anche noindex): l'anteprima dell'area coristi, l'area
// Amministrazione e le vesti in prova, che stanno sotto /<veste>/
const vesti = readdirSync('src/vesti', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const escluse = new RegExp(`^/(area|admin|${vesti.join('|')})(/|$)`);

// https://astro.build/config
export default defineConfig({
  // Indirizzo ufficiale del sito (lo stesso di coro.url): per canonical e sitemap
  site: 'https://romamusicanta.org',
  integrations: [sitemap({ filter: (pagina) => !escluse.test(new URL(pagina).pathname) })],
  // Il sito è statico; solo l'area Amministrazione (src/pages/admin, prerender = false) gira come
  // funzione su Vercel
  adapter: vercel(),
  // Variabili dell'area Amministrazione, lette quando la pagina viene richiesta (non nella build)
  env: {
    schema: {
      GOOGLE_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      SESSIONE_SEGRETO: envField.string({ context: 'server', access: 'secret', optional: true }),
      VERCEL_DEPLOY_HOOK: envField.string({ context: 'server', access: 'secret', optional: true }),
      CALENDARIO_CONCERTI_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      DRIVE_CARTELLA_CONCERTI: envField.string({ context: 'server', access: 'secret', optional: true }),
      DRIVE_CARTELLA_FOTO: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  // Quando è stata costruita la versione online, per l'area Amministrazione
  vite: { define: { __ORA_BUILD__: JSON.stringify(new Date().toISOString()) } },
  // Indirizzi senza barra finale, come nei link interni: /concerti, /area/prove
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // Porta del server di sviluppo: PORT se assegnata (pannello browser), altrimenti 4321
  server: { port: Number(process.env.PORT) || 4321 },
});
