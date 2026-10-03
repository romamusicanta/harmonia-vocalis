// Registrazioni della prova dal modulo di Modifica: caricamento a pezzi (src/area/registrazioni.ts,
// rispondiFileRedattore) e, con x-azione "togli" e id, il file nel cestino del Drive condiviso
import type { APIRoute } from 'astro';
import { rispondiFileRedattore, togliComeRedattore } from '../../../area/registrazioni';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  if (request.headers.get('x-azione') === 'togli') {
    try {
      await togliComeRedattore(String((await request.json()).id ?? ''));
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ ok: false, errore: spiegaTesto(e) }, { status: 500 });
    }
  }
  return rispondiFileRedattore(request, locals.sessione!.email);
};
