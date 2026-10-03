// Il corista segna o ritira le sue assenze (foglio "Coristi e assenze", scheda Assenze), solo per
// prove e concerti non ancora iniziati: dopo, le correggono i redattori dall'area Amministrazione.
// azione=segna (evento, nota: se c'è già aggiorna la nota) · togli (evento) · periodo (dal, al, nota)
import type { APIRoute } from 'astro';
import { aperto, coristaDi, eventi, eventoDa, segnaAssenza, togliAssenza } from '../../area/dati';
import { spiegaTesto } from '../../area/errori';

export const prerender = false;

const json = (corpo: object, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const io = await coristaDi(locals.corista!.email);
    if (!io) return json({ ok: false, errore: 'Il tuo indirizzo non è nella scheda Coristi: scrivi ai redattori.' }, 403);
    const f = await request.formData();
    const azione = f.get('azione');
    const nota = String(f.get('nota') ?? '').trim().slice(0, 300);

    if (azione === 'periodo') {
      const dal = String(f.get('dal') ?? ''), al = String(f.get('al') ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dal) || !/^\d{4}-\d{2}-\d{2}$/.test(al) || al < dal) return json({ ok: false, errore: 'Scegli le due date, la seconda dopo la prima.' }, 400);
      const elenco = (await eventi(dal, al)).filter(aperto);
      for (const e of elenco) await segnaAssenza(e, io, nota, io.email);
      return json({ ok: true, segnate: elenco.map((e) => e.id) });
    }

    const e = await eventoDa(String(f.get('evento') ?? ''));
    if (!e) return json({ ok: false, errore: 'Prova o concerto non trovato: ricarica la pagina.' }, 404);
    if (!aperto(e)) return json({ ok: false, errore: 'È già iniziato: per correggere scrivi ai redattori.' }, 400);
    if (azione === 'segna') await segnaAssenza(e, io, nota, io.email);
    else if (azione === 'togli') await togliAssenza(e.id, io.email);
    else return json({ ok: false, errore: 'azione sconosciuta' }, 400);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, errore: `Non è stato possibile salvare. ${spiegaTesto(e)}` }, 500);
  }
};
