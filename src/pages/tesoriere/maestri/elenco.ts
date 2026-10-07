// Area del tesoriere: aggiunge o cambia un maestro dell'elenco (nome, onorario proposto, attivo),
// dalla pagina Maestri (src/pages/tesoriere/maestri.astro); risponde in JSON. Dal 7/10/2026.
import type { APIRoute } from 'astro';
import { configurata, numero, salvaMaestro } from '../../../area/tesoreria';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const json = (dati: object, status = 200) => new Response(JSON.stringify(dati), { status, headers: { 'Content-Type': 'application/json' } });
  if (!configurata()) return json({ errore: 'Manca il foglio della tesoreria sul server.' }, 500);
  try {
    const d = await request.json();
    await salvaMaestro({
      prima: d.prima ? String(d.prima) : undefined,
      nome: String(d.nome ?? ''),
      onorario: numero(String(d.onorario ?? '')),
      attivo: d.attivo !== false,
      note: d.note !== undefined ? String(d.note) : undefined,
    }, locals.corista!.email);
    return json({ ok: true });
  } catch (e) {
    return json({ errore: spiegaTesto(e) }, 400);
  }
};
