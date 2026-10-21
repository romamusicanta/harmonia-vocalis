// Elimina un concerto dal modulo /admin/concerti/modifica (src/admin/stati.ts, eliminaConcerto)
import type { APIRoute } from 'astro';
import { eliminaConcerto } from '../../../admin/stati';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const id = String((await request.formData()).get('evento') ?? '');
    if (!id) return Response.json({ ok: false, errore: 'manca il concerto' }, { status: 400 });
    return Response.json({ ok: true, ...(await eliminaConcerto(id)) });
  } catch (e) {
    console.error('[concerto]', e);
    return Response.json({ ok: false, errore: spiegaTesto(e) }, { status: 500 });
  }
};
