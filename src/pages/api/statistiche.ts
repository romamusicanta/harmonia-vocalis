// Riepilogo notturno delle visite (src/area/visite.ts), chiamato dal cron di Vercel (vercel.json):
// i totali dei giorni finiti nella scheda "Visite per giorno" e via le visite più vecchie di 13 mesi.
// Vercel firma la chiamata con CRON_SECRET; senza, non fa niente.
import type { APIRoute } from 'astro';
import { CRON_SECRET } from 'astro:env/server';
import { configurato, riepilogoNotturno } from '../../area/visite';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) return new Response('Non autorizzato', { status: 401 });
  if (!configurato()) return new Response('Statistiche non configurate', { status: 503 });
  try {
    const r = await riepilogoNotturno();
    return new Response(`Giorni riassunti: ${r.riassunti}; visite vecchie cancellate: ${r.cancellate}`);
  } catch (e) {
    console.error(`[visite] riepilogo non riuscito: ${(e as Error).message}`);
    return new Response('Riepilogo non riuscito', { status: 502 });
  }
};
