// La casella "In home" dell'elenco dei concerti: scrive "Home: sì" o "Home: no" nella descrizione
// dell'evento (al posto di una riga Home già presente), senza toccare il resto.
import type { APIRoute } from 'astro';
import { aggiornaEvento, leggiEvento } from '../../../admin/operazioni';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const s = locals.sessione!;
  try {
    const f = await request.formData();
    const id = String(f.get('evento') ?? '');
    const home = f.get('home') === '1';
    const e = await leggiEvento(s, id);
    const righe = (e.description ?? '').split('\n').filter((r) => !/^\s*home\s*:/i.test(r.replace(/<[^>]+>/g, '')));
    while (righe.length && !righe.at(-1)!.trim()) righe.pop();
    await aggiornaEvento(s, id, { description: [...righe, `Home: ${home ? 'sì' : 'no'}`].join('\n') });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, errore: (e as Error).message }, { status: 500 });
  }
};
