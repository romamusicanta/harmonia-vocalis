// Area del tesoriere: salva come è andata una prova per gli onorari (chi l'ha diretta, onorario,
// lezione di vocalità), aggiunge una prova non in calendario o la toglie (elimina). Dalla pagina
// Maestri (src/pages/tesoriere/maestri.astro); risponde in JSON.
import type { APIRoute } from 'astro';
import { configurata, numero, salvaProvaMaestro } from '../../../area/tesoreria';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const json = (dati: object, status = 200) => new Response(JSON.stringify(dati), { status, headers: { 'Content-Type': 'application/json' } });
  if (!configurata()) return json({ errore: 'Manca il foglio della tesoreria sul server.' }, 500);
  try {
    const d = await request.json();
    const r = await salvaProvaMaestro({
      id: d.id ? String(d.id) : undefined,
      data: d.data ? String(d.data) : undefined,
      maestro: d.maestro !== undefined ? String(d.maestro) : undefined,
      onorario: d.onorario !== undefined && d.onorario !== '' ? numero(String(d.onorario)) : undefined,
      vocalita: d.vocalita ? String(d.vocalita) : undefined,
      note: d.note !== undefined ? String(d.note) : undefined,
      elimina: Boolean(d.elimina),
    }, locals.corista!.email);
    return json({ ok: true, ...r });
  } catch (e) {
    return json({ errore: spiegaTesto(e) }, 500);
  }
};
