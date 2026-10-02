// I redattori segnano o tolgono l'assenza di un corista a una prova o a un concerto, anche già
// passati (le presenze vere): nel foglio "Inserita da" è il redattore.
import type { APIRoute } from 'astro';
import { coristi, eventoDa, segnaAssenza, togliAssenza } from '../../../area/dati';

export const prerender = false;

const json = (corpo: object, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const f = await request.formData();
    const e = await eventoDa(String(f.get('evento') ?? ''));
    if (!e) return json({ ok: false, errore: 'Prova o concerto non trovato: ricarica la pagina.' }, 404);
    const c = (await coristi()).find((x) => x.email === String(f.get('email') ?? '').toLowerCase());
    if (!c) return json({ ok: false, errore: 'Corista non trovato nella scheda Coristi.' }, 404);
    if (f.get('assente') === '1') await segnaAssenza(e, c, String(f.get('nota') ?? '').trim().slice(0, 300), locals.sessione!.email);
    else await togliAssenza(e.id, c.email);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, errore: `Non è stato possibile salvare: ${(e as Error).message}` }, 500);
  }
};
