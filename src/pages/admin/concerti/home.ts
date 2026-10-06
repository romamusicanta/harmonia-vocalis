// La casella "In home" dell'elenco dei concerti: scrive "Home: sì" o "Home: no" nella descrizione
// dell'evento (al posto di una riga Home già presente), senza toccare il resto.
import type { APIRoute } from 'astro';
import { leggiConcerto, salvaConcerto } from '../../../admin/stati';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const f = await request.formData();
    const id = String(f.get('evento') ?? '');
    const home = f.get('home') === '1';
    const { e } = await leggiConcerto(id);
    const righe = (e.description ?? '').split('\n').filter((r) => !/^\s*home\s*:/i.test(r.replace(/<[^>]+>/g, '')));
    while (righe.length && !righe.at(-1)!.trim()) righe.pop();
    // Anche nella copia pubblica, se il concerto è in cartellone
    await salvaConcerto(id, { description: [...righe, `Home: ${home ? 'sì' : 'no'}`].join('\n') }, undefined);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, errore: spiegaTesto(e) }, { status: 500 });
  }
};
