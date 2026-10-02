// Crea una prova (senza id) o ne modifica una (con id) nel calendario "Prove"
import type { APIRoute } from 'astro';
import { aggiornaProva, corpoDalModulo, creaProva } from '../../../admin/prove';

export const prerender = false;

const json = (corpo: object, status = 200) => Response.json(corpo, { status });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const f = await request.formData();
    const corpo = corpoDalModulo(f);
    if ('errore' in corpo) return json({ ok: false, errore: corpo.errore }, 400);
    const id = String(f.get('id') ?? '');
    if (id) await aggiornaProva(locals.sessione!, id, corpo);
    else await creaProva(locals.sessione!, corpo);
    return json({ ok: true, data: String(f.get('data')) });
  } catch (e) {
    return json({ ok: false, errore: (e as Error).message }, 500);
  }
};
