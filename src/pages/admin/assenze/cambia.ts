// I redattori segnano o tolgono l'assenza di un corista a una prova o a un concerto, anche già
// passati (le presenze vere): nel foglio "Inserita da" è il redattore. Dal 25/11/2026 ogni assenza
// nuova o tolta arriva come notifica agli altri redattori (src/area/avvisoAssenze.ts).
import type { APIRoute } from 'astro';
import { avvisaRedattori } from '../../../area/avvisoAssenze';
import { coristi, eventoDa, segnaAssenza, togliAssenza } from '../../../area/dati';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;

const json = (corpo: object, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const f = await request.formData();
    const e = await eventoDa(String(f.get('evento') ?? ''));
    if (!e) return json({ ok: false, errore: 'Prova o concerto non trovato: ricarica la pagina.' }, 404);
    const c = (await coristi()).find((x) => x.email === String(f.get('email') ?? '').toLowerCase());
    if (!c) return json({ ok: false, errore: 'Corista non trovato nella scheda Coristi.' }, 404);
    const nota = String(f.get('nota') ?? '').trim().slice(0, 300);
    const da = { email: locals.sessione!.email, nome: locals.sessione!.nome };
    if (f.get('assente') === '1') {
      if (await segnaAssenza(e, c, nota, da.email)) avvisaRedattori(c, { tipo: 'segnata', evento: e }, nota, da);
    } else if (await togliAssenza(e.id, c.email)) avvisaRedattori(c, { tipo: 'ritirata', evento: e }, '', da);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, errore: `Non è stato possibile salvare. ${spiegaTesto(e)}` }, 500);
  }
};
