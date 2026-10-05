// Area coristi: un corista toglie una foto che ha caricato (nel cestino del Drive condiviso)
import type { APIRoute } from 'astro';
import { togliFoto } from '../../../area/fotoConcerti';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    await togliFoto(String((await request.json()).id ?? ''), locals.corista!.email);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, errore: spiegaTesto(e) }, { status: 500 });
  }
};
