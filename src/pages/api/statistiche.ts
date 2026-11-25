// Riepilogo notturno delle visite (src/area/visite.ts), chiamato ogni notte dal timer della VPS
// (deploy/, web-timer@harmonia-vocalis-statistiche):
// i totali dei giorni finiti nella scheda "Visite per giorno" e via le visite più vecchie di 13 mesi.
// La chiamata porta CRON_SECRET (in app.env); senza, non fa niente.
import type { APIRoute } from 'astro';
import { CRON_SECRET } from 'astro:env/server';
import { configurato, riepilogoNotturno } from '../../area/visite';
import { pulisciCandidature } from '../../area/candidature';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) return new Response('Non autorizzato', { status: 401 });
  if (!configurato()) return new Response('Statistiche non configurate', { status: 503 });
  try {
    const r = await riepilogoNotturno();
    // Anche le candidature più vecchie di 12 mesi (src/area/candidature.ts), come dice la privacy
    const candidature = await pulisciCandidature().catch((e) => { console.error(`[candidature] pulizia non riuscita: ${(e as Error).message}`); return 0; });
    return new Response(`Giorni riassunti: ${r.riassunti}; visite vecchie cancellate: ${r.cancellate}; candidature vecchie cancellate: ${candidature}`);
  } catch (e) {
    console.error(`[visite] riepilogo non riuscito: ${(e as Error).message}`);
    return new Response('Riepilogo non riuscito', { status: 502 });
  }
};
