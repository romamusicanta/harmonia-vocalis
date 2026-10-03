// Cancella una prova dal calendario "Prove" (per la prova settimanale, solo quella data)
import type { APIRoute } from 'astro';
import { cancellaProva } from '../../../admin/prove';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const id = String((await request.formData()).get('id') ?? '');
    if (!id) return Response.json({ ok: false, errore: 'manca la prova' }, { status: 400 });
    await cancellaProva(locals.sessione!, id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, errore: spiegaTesto(e) }, { status: 500 });
  }
};
