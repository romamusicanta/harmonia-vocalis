// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Indirizzi senza barra finale, come nei link interni: /concerti, /area/prove
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // Porta del server di sviluppo: PORT se assegnata (pannello browser), altrimenti 4321
  server: { port: Number(process.env.PORT) || 4321 },
});
