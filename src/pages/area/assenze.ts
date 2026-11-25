// Il corista segna o ritira le sue assenze (foglio "Coristi e assenze", scheda Assenze), solo per
// prove e concerti non ancora iniziati: dopo, le correggono i redattori dall'area Amministrazione.
// azione=segna (evento, nota: se c'è già aggiorna la nota) · togli (evento) · periodo (dal, al, nota)
// · ritira-periodo (dal, al: toglie le sue assenze delle prove e dei concerti non ancora iniziati)
// Dal 25/11/2026 ogni assenza nuova o ritirata, e ogni periodo, arriva ai redattori come notifica push
// (src/area/avvisoAssenze.ts); i cambi della sola nota no.
import type { APIRoute } from 'astro';
import { aperto, assenze, coristaDi, eventi, eventoDa, segnaAssenza, segnaPresenze, togliAssenza, type Evento } from '../../area/dati';
import { avvisaRedattori } from '../../area/avvisoAssenze';
import { spiegaTesto } from '../../area/errori';

export const prerender = false;

const json = (corpo: object, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const io = await coristaDi(locals.corista!.email);
    if (!io) return json({ ok: false, errore: 'Il tuo indirizzo non è nella scheda Coristi: scrivi ai redattori.' }, 403);
    if (!segnaPresenze(io)) return json({ ok: false, errore: 'Il Maestro non segna assenze: non conta nelle presenze.' }, 403);
    const f = await request.formData();
    const azione = f.get('azione');
    const nota = String(f.get('nota') ?? '').trim().slice(0, 300);
    const da = { email: io.email };

    if (azione === 'periodo') {
      const dal = String(f.get('dal') ?? ''), al = String(f.get('al') ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dal) || !/^\d{4}-\d{2}-\d{2}$/.test(al) || al < dal) return json({ ok: false, errore: 'Scegli le due date, la seconda dopo la prima.' }, 400);
      const elenco = (await eventi(dal, al)).filter(aperto);
      const nuove: Evento[] = [];
      for (const e of elenco) if (await segnaAssenza(e, io, nota, io.email)) nuove.push(e);
      if (nuove.length) avvisaRedattori(io, { tipo: 'periodo-segnato', dal, al, eventi: nuove }, nota, da);
      return json({ ok: true, segnate: elenco.map((e) => e.id) });
    }

    if (azione === 'ritira-periodo') {
      const dal = String(f.get('dal') ?? ''), al = String(f.get('al') ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dal) || !/^\d{4}-\d{2}-\d{2}$/.test(al) || al < dal) return json({ ok: false, errore: 'Scegli le due date, la seconda dopo la prima.' }, 400);
      const mie = new Set((await assenze()).filter((a) => a.email === io.email).map((a) => a.idEvento));
      const elenco = (await eventi(dal, al)).filter((e) => aperto(e) && mie.has(e.id));
      const tolte: Evento[] = [];
      for (const e of elenco) if (await togliAssenza(e.id, io.email)) tolte.push(e);
      if (tolte.length) avvisaRedattori(io, { tipo: 'periodo-ritirato', dal, al, eventi: tolte }, '', da);
      return json({ ok: true, ritirate: tolte.map((e) => e.id) });
    }

    const e = await eventoDa(String(f.get('evento') ?? ''));
    if (!e) return json({ ok: false, errore: 'Prova o concerto non trovato: ricarica la pagina.' }, 404);
    if (!aperto(e)) return json({ ok: false, errore: 'È già iniziato: per correggere scrivi ai redattori.' }, 400);
    if (azione === 'segna') {
      if (await segnaAssenza(e, io, nota, io.email)) avvisaRedattori(io, { tipo: 'segnata', evento: e }, nota, da);
    } else if (azione === 'togli') {
      if (await togliAssenza(e.id, io.email)) avvisaRedattori(io, { tipo: 'ritirata', evento: e }, '', da);
    } else return json({ ok: false, errore: 'azione sconosciuta' }, 400);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, errore: `Non è stato possibile salvare. ${spiegaTesto(e)}` }, 500);
  }
};
