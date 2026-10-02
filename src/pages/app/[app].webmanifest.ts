// Manifest della PWA: il sito si installa sul telefono (Aggiungi a schermata Home). Uno per il sito
// pubblico e uno per ogni area riservata, così chi la installa da lì la apre direttamente sull'area.
// Colori e nome da coro.config.ts; icone in public/icone (il diapason della favicon, da rifare a mano
// se cambiano i colori, come public/favicon.svg).
import type { APIRoute } from 'astro';
import { coro } from '../../motore/coro';

const app = {
  sito: { nome: coro.nome, breve: coro.sigla, avvio: '/', descrizione: coro.descrizione },
  coristi: { nome: `Area coristi · ${coro.nome}`, breve: `${coro.sigla} Coristi`, avvio: '/area', descrizione: 'Calendario delle prove e dei concerti, assenze, materiali del coro.' },
  maestro: { nome: `Area del Maestro · ${coro.nome}`, breve: `${coro.sigla} Maestro`, avvio: '/maestro', descrizione: 'Chi c’è e chi manca alle prove e ai concerti.' },
  admin: { nome: `Amministrazione · ${coro.nome}`, breve: `${coro.sigla} Admin`, avvio: '/admin', descrizione: 'Concerti, prove, foto e assenze del sito.' },
};
export type App = keyof typeof app;

export const getStaticPaths = () => Object.keys(app).map((a) => ({ params: { app: a } }));

export const GET: APIRoute = ({ params }) => {
  const a = app[params.app as App];
  const colori = coro.aspetto.colori;
  const icone = [192, 512].flatMap((n) => [
    { src: `/icone/icona-${n}.png`, sizes: `${n}x${n}`, type: 'image/png', purpose: 'any' },
    { src: `/icone/icona-maschera-${n}.png`, sizes: `${n}x${n}`, type: 'image/png', purpose: 'maskable' },
  ]);
  return new Response(JSON.stringify({
    id: a.avvio,
    name: a.nome,
    short_name: a.breve,
    description: a.descrizione,
    lang: 'it',
    start_url: a.avvio,
    scope: '/',
    display: 'standalone',
    background_color: colori?.fondo ?? '#ffffff',
    theme_color: colori?.primario ?? '#000000',
    icons: icone,
  }, null, 2), { headers: { 'Content-Type': 'application/manifest+json' } });
};
