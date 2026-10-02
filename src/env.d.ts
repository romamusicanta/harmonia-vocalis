// Tipi globali: le sessioni dell'area Amministrazione e dell'area coristi (src/middleware.ts) e l'ora della build
// (astro.config.mjs, vite.define)
declare namespace App {
  interface Locals {
    sessione?: import('./admin/sessione').Sessione;
    corista?: import('./area/accesso').Corista;
  }
}

declare const __ORA_BUILD__: string;
