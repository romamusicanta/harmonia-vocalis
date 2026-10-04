// Ricostruzione dopo mezzanotte, chiamata dal cron di Vercel (vercel.json, "crons"): il sito è
// statico e decide in fase di build quali concerti sono in programma e quali passati, così il
// concerto della sera prima passa nell'archivio appena cambia il giorno. Vercel firma la
// chiamata con CRON_SECRET; senza, non fa niente.
import type { APIRoute } from 'astro';
import { CRON_SECRET } from 'astro:env/server';
import { pubblica } from '../../admin/operazioni';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) return new Response('Non autorizzato', { status: 401 });
  try {
    await pubblica();
    return new Response('Ricostruzione avviata');
  } catch (e) {
    console.error(`[ricostruzione] ${(e as Error).message}`);
    return new Response('Ricostruzione non avviata', { status: 502 });
  }
};
