// Crea un concerto dal modulo /admin/concerti/nuovo: cartella su Drive con locandina e copertina,
// evento nel calendario "Prove" scritto secondo la convenzione di src/motore/concerti.ts, con il suo
// stato; se è già in cartellone, anche la copia nel calendario pubblico "Concerti" (src/admin/stati.ts).
import type { APIRoute } from 'astro';
import { completaInglese, ingleseScritto, corpoEvento, datiDalModulo, nomeCartella, stagione } from '../../../admin/concerto';
import { caricaImmagini, cartellaConcerto, eventiDelGiorno } from '../../../admin/operazioni';
import { creaConcerto, statoValido } from '../../../admin/stati';
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
    const avvisoInglese = await completaInglese(d);
    const evento = await creaConcerto(s, { ...corpoEvento(d), attachments: allegati.nuovi }, statoValido(f.get('stato')) ?? 'da-confermare');
    return json({ ok: true, id: evento.id, evento: evento.htmlLink, cartella: `https://drive.google.com/drive/folders/${cartella}`, avviso: avvisoInglese, inglese: ingleseScritto(d) });
  } catch (e) {
    return json({ ok: false, errore: spiegaTesto(e) }, 500);
  }
};
