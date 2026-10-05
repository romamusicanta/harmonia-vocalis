// Amministrazione → Foto dei concerti: chi vede una foto (pubblica, coristi, nascosta) o, con
// togli, la foto nel cestino del Drive condiviso. Risponde in JSON.
import type { APIRoute } from 'astro';
import { cambiaVisibilita, togliFoto, type Visibilita } from '../../../area/fotoConcerti';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const d = await request.json();
    const email = locals.sessione!.email;
    if (d.togli) await togliFoto(String(d.id ?? ''), email, true);
    else await cambiaVisibilita(String(d.id ?? ''), d.visibilita as Visibilita, email);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, errore: spiegaTesto(e) }, { status: 500 });
  }
};
