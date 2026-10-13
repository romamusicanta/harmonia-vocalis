// Amministrazione → Foto dei concerti: il nuovo ordine del carosello della home (ids = tutte le foto
// «Home», nell'ordine). Risponde in JSON.
import type { APIRoute } from 'astro';
import { ordinaCarosello } from '../../../area/fotoConcerti';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  try {
    const d = await request.json();
    if (!Array.isArray(d.ids)) throw new Error('Ordine non valido.');
    await ordinaCarosello(d.ids.map(String));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, errore: spiegaTesto(e) }, { status: 500 });
  }
};
