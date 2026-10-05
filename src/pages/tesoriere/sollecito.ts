// Area del tesoriere: sollecito delle quote a chi non le ha pagate (Sollecito.astro nel Riepilogo).
// Con mese, solo quel mese; senza, tutte le quote della stagione fino al mese in corso.
// azione=quanti: l'elenco di chi deve pagare (nomi, mesi, importo, email) e quanti hanno le notifiche
// accese, senza mandare niente; azione=invia: a ciascuno la sua notifica personale (src/area/notifiche.ts).
import type { APIRoute } from 'astro';
import { arretrati, configurata, euro, indice, indirizziDi, MODELLO_SOLLECITO, mesiDovuti, nomeMese, quote, stagioneCorrente, testoSollecito } from '../../area/tesoreria';
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
    return json({
      persone: chi.length,
      totale: euro(chi.reduce((t, a) => t + a.importo, 0)),
      elenco: chi.map((a) => ({ nome: `${a.corista.nome} ${a.corista.cognome}`, mesi: a.mesi.map(nomeMese), importo: euro(a.importo) })),
      email: chi.map((a) => a.corista.email),
      ...r,
    });
  } catch (e) {
    return json({ errore: spiegaTesto(e) }, 500);
  }
};
