// Crea un concerto dal modulo /admin/concerti/nuovo: cartella su Drive con locandina e copertina,
// evento nel calendario "Concerti" scritto secondo la convenzione di src/motore/concerti.ts.
import type { APIRoute } from 'astro';
import { corpoEvento, datiDalModulo, nomeCartella, stagione } from '../../../admin/concerto';
import { caricaImmagini, cartellaConcerto, creaEvento, eventiDelGiorno } from '../../../admin/operazioni';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;

const json = (corpo: object, status = 200) => Response.json(corpo, { status });

export const POST: APIRoute = async ({ request, locals }) => {
  const s = locals.sessione!;
  try {
    const f = await request.formData();
    const d = datiDalModulo(f);
    if ('errore' in d) return json({ ok: false, errore: d.errore }, 400);

    // Un concerto già in calendario quel giorno: si crea solo con la conferma
    if (!f.get('conferma')) {
      const [gia] = await eventiDelGiorno(s, d.data);
      if (gia) return json({ ok: false, giaPresente: gia.summary ?? 'senza titolo' });
    }

    const cartella = await cartellaConcerto(s, stagione(d.data), nomeCartella(d));
    const allegati = await caricaImmagini(s, f, cartella);
    if ('errore' in allegati) return json({ ok: false, errore: allegati.errore }, 400);
    const evento = await creaEvento(s, { ...corpoEvento(d), attachments: allegati.nuovi });
    return json({ ok: true, evento: evento.htmlLink, cartella: `https://drive.google.com/drive/folders/${cartella}` });
  } catch (e) {
    return json({ ok: false, errore: spiegaTesto(e) }, 500);
  }
};
