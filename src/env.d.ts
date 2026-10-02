// Tipi globali: la sessione dell'area Amministrazione (src/middleware.ts) e l'ora della build
// (astro.config.mjs, vite.define)
declare namespace App {
  interface Locals {
    sessione?: import('./admin/sessione').Sessione;
  }
}

declare const __ORA_BUILD__: string;
