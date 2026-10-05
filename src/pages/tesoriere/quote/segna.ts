// Area del tesoriere: segna la quota di un corista per un mese (pagata, esonerato, da pagare), dalla
// pagina Quote (src/pages/tesoriere/quote.astro). Risponde in JSON.
import type { APIRoute } from 'astro';
import { configurata, segnaQuota, type StatoQuota } from '../../../area/tesoreria';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const json = (dati: object, status = 200) => new Response(JSON.stringify(dati), { status, headers: { 'Content-Type': 'application/json' } });
  if (!configurata()) return json({ errore: 'Manca il foglio della tesoreria sul server.' }, 500);
  try {
    const d = await request.json();
    const stato = (['pagata', 'esonerato', 'da-pagare'] as StatoQuota[]).find((s) => s === d.stato);
    if (!stato) return json({ errore: 'Stato non valido.' }, 400);
    await segnaQuota(String(d.email ?? ''), String(d.mese ?? ''), stato, String(d.nota ?? ''), locals.corista!.email, d.pagataIl ? String(d.pagataIl) : undefined);
    return json({ ok: true });
  } catch (e) {
    return json({ errore: spiegaTesto(e) }, 500);
  }
};
