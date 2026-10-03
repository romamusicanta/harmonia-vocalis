// Area del Maestro (scrive l'account di servizio). Crea una prova (senza id) o ne modifica una (con id) nel calendario "Prove"
import type { APIRoute } from 'astro';
import { aggiornaProva, corpoDalModulo, creaProva } from '../../../admin/prove';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;

const json = (corpo: object, status = 200) => Response.json(corpo, { status });

export const POST: APIRoute = async ({ request }) => {
  try {
    const f = await request.formData();
    const corpo = corpoDalModulo(f);
    if ('errore' in corpo) return json({ ok: false, errore: corpo.errore }, 400);
    const id = String(f.get('id') ?? '');
    if (id) await aggiornaProva('servizio', id, corpo);
    else await creaProva('servizio', corpo);
    return json({ ok: true, data: String(f.get('data')) });
  } catch (e) {
    return json({ ok: false, errore: spiegaTesto(e) }, 500);
  }
};
