// Foto del sito → Il Maestro: con carosello (true/false) una foto entra o esce dal carosello, con ids il
// nuovo ordine del carosello, con togli la foto va nel cestino del Drive condiviso. Risponde in JSON.
import type { APIRoute } from 'astro';
import { nelCarosello, ordinaFotoMaestro, togliFotoMaestro } from '../../../admin/fotoMaestro';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  try {
    const d = await request.json();
    if (Array.isArray(d.ids)) await ordinaFotoMaestro(d.ids.map(String));
    else if (d.togli) await togliFotoMaestro(String(d.id ?? ''));
    else if (typeof d.carosello === 'boolean') await nelCarosello(String(d.id ?? ''), d.carosello);
    else throw new Error('Richiesta non valida.');
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, errore: spiegaTesto(e) }, { status: 500 });
  }
};
