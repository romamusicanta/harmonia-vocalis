// Area del tesoriere: sollecito delle quote a chi non le ha pagate, con una notifica personale
// (src/area/notifiche.ts: arriva solo a chi ha acceso le notifiche). Con mese, solo quel mese;
// senza, tutte le quote della stagione fino al mese in corso. azione=quanti conta senza mandare.
import type { APIRoute } from 'astro';
import { arretrati, configurata, indice, indirizziDi, MODELLO_SOLLECITO, mesiDovuti, quote, stagioneCorrente, testoSollecito } from '../../area/tesoreria';
import { coristi } from '../../area/dati';
import { inviaPersonali } from '../../area/notifiche';
import { spiegaTesto } from '../../area/errori';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const json = (dati: object, status = 200) => new Response(JSON.stringify(dati), { status, headers: { 'Content-Type': 'application/json' } });
  if (!configurata()) return json({ errore: 'Manca il foglio della tesoreria sul server.' }, 500);
  try {
    const d = await request.json();
    const [elenco, tutte] = await Promise.all([coristi(), quote()]);
    const mesi = d.mese && /^\d{4}-\d{2}$/.test(d.mese) ? [String(d.mese)] : mesiDovuti(stagioneCorrente(), tutte);
    const chi = arretrati(mesi, elenco, indice(tutte));
    const modello = String(d.modello ?? '').trim().slice(0, 600) || MODELLO_SOLLECITO;
    const messaggi = chi.map((a) => ({ indirizzi: indirizziDi(a.corista), notifica: { titolo: 'Quota del coro', testo: testoSollecito(modello, a), link: '/area#quote' } }));
    const prova = d.azione !== 'invia';
    if (!prova) console.log(`[tesoreria] sollecito da ${locals.corista!.email} a ${chi.length} coristi`);
    const r = await inviaPersonali(messaggi, prova);
    return json({ persone: chi.length, ...r });
  } catch (e) {
    return json({ errore: spiegaTesto(e) }, 500);
  }
};
