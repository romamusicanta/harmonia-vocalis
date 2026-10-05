// Area del tesoriere: segna la quota di un corista per un mese (pagata, esonerato, da pagare; per una
// quota pagata anche importo e data, se diversi dal solito), oppure (azione=riporto) il riporto della
// stagione prima di un corista (cifra, vuota = quella calcolata; versato sì o no),
// oppure (azione=senza-quota) un mese in cui la quota non si raccoglie, o (azione=quota-base) la quota
// base di un mese per tutti (giugno, settembre). Dalla pagina Quote (src/pages/tesoriere/quote.astro); risponde in JSON.
import type { APIRoute } from 'astro';
import { configurata, numero, segnaMeseSenzaQuota, segnaQuota, segnaQuotaBase, segnaRiporto, type StatoQuota } from '../../../area/tesoreria';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const json = (dati: object, status = 200) => new Response(JSON.stringify(dati), { status, headers: { 'Content-Type': 'application/json' } });
  if (!configurata()) return json({ errore: 'Manca il foglio della tesoreria sul server.' }, 500);
  try {
    const d = await request.json();
    const da = locals.corista!.email;
    if (d.azione === 'riporto') {
      const cifra = d.cifra === undefined ? undefined : String(d.cifra).trim() === '' ? null : numero(String(d.cifra));
      await segnaRiporto(String(d.email ?? ''), Number(d.anno), { cifra, versato: d.versato === undefined ? undefined : Boolean(d.versato) }, da);
      return json({ ok: true });
    }
    if (d.azione === 'quota-base') {
      await segnaQuotaBase(String(d.mese ?? ''), numero(String(d.importo ?? '')), da);
      return json({ ok: true });
    }
    if (d.azione === 'senza-quota') {
      await segnaMeseSenzaQuota(String(d.mese ?? ''), Boolean(d.senza), String(d.nota ?? ''), da);
      return json({ ok: true });
    }
    const stato = (['pagata', 'esonerato', 'da-pagare'] as StatoQuota[]).find((s) => s === d.stato);
    if (!stato) return json({ errore: 'Stato non valido.' }, 400);
    const importo = d.importo !== undefined && d.importo !== '' ? numero(String(d.importo)) : undefined;
    await segnaQuota(String(d.email ?? ''), String(d.mese ?? ''), stato, String(d.nota ?? ''), da, d.pagataIl ? String(d.pagataIl) : undefined, importo);
    return json({ ok: true });
  } catch (e) {
    return json({ errore: spiegaTesto(e) }, 500);
  }
};
