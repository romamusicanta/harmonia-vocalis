// @ts-check
import { readdirSync } from 'node:fs';
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// Pagine fuori dalla sitemap (sono anche noindex): l'anteprima dell'area coristi, l'area
// Amministrazione, l'area del Maestro e le vesti in prova, che stanno sotto /<veste>/
const vesti = readdirSync('src/vesti', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const escluse = new RegExp(`^/(area|admin|maestro|${vesti.join('|')})(/|$)`);

// Area coristi riservata: fuori dalla demo le sue pagine non si prerenderizzano ma girano come
// funzione, così src/middleware.ts può lasciarle vedere solo ai coristi entrati con Google
const areaRiservata = {
  name: 'area-riservata',
  hooks: {
    'astro:route:setup': ({ route }) => {
      if (process.env.DEMO !== '1' && /\/area\/[^/]+\.astro$/.test(route.component)) route.prerender = false;
    },
  },
};

// https://astro.build/config
export default defineConfig({
  // Indirizzo ufficiale del sito (lo stesso di coro.url): per canonical e sitemap
  site: 'https://romamusicanta.org',
  integrations: [areaRiservata, sitemap({ filter: (pagina) => !escluse.test(new URL(pagina).pathname) })],
  // Il sito è statico; solo l'area Amministrazione (src/pages/admin, prerender = false) e l'area
  // coristi girano come funzione su Vercel
  adapter: vercel(),
  // Variabili dell'area Amministrazione e dell'area coristi, lette quando la pagina viene richiesta
  // (non nella build)
  env: {
    schema: {
      GOOGLE_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      SESSIONE_SEGRETO: envField.string({ context: 'server', access: 'secret', optional: true }),
      VERCEL_DEPLOY_HOOK: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Firma delle chiamate del cron di Vercel a /api/ricostruisci
      CRON_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      CALENDARIO_CONCERTI_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      DRIVE_CARTELLA_CONCERTI: envField.string({ context: 'server', access: 'secret', optional: true }),
      DRIVE_CARTELLA_FOTO: envField.string({ context: 'server', access: 'secret', optional: true }),
      DRIVE_CARTELLA_SPARTITI: envField.string({ context: 'server', access: 'secret', optional: true }),
      DRIVE_CARTELLA_REGISTRAZIONI: envField.string({ context: 'server', access: 'secret', optional: true }),
      CORISTI_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      CORISTI_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Area coristi: foglio "Coristi e assenze" e calendario privato "Prove"
      FOGLIO_CORISTI_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      CALENDARIO_PROVE_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Area del tesoriere: foglio "Tesoreria – quote e cassa" (cartella Tesoreria del Drive condiviso)
      FOGLIO_TESORERIA_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Notifiche push ai coristi (src/area/notifiche.ts)
      VAPID_PUBLIC_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      VAPID_PRIVATE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Federazione delle identità verso l'account di servizio (anche per la build, vedi scripts/)
      GCP_PROJECT_NUMBER: envField.string({ context: 'server', access: 'secret', optional: true }),
      GCP_SERVICE_ACCOUNT_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      GCP_WORKLOAD_IDENTITY_POOL_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
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
