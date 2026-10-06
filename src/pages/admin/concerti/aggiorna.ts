// Aggiorna un concerto dal modulo /admin/concerti/modifica: riscrive titolo, luogo, date e
// descrizione dell'evento e, se arrivano, carica la nuova locandina o la nuova foto principale
// nella cartella del concerto e le allega al posto delle precedenti (che restano su Drive).
import type { APIRoute } from 'astro';
import { completaInglese, ingleseScritto, corpoEvento, datiDalModulo, eLocandina, nomeCartella, stagione } from '../../../admin/concerto';
import { caricaImmagini, cartellaConcerto, cartellaDelFile } from '../../../admin/operazioni';
import { leggiConcerto, salvaConcerto, statoValido } from '../../../admin/stati';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;

const json = (corpo: object, status = 200) => Response.json(corpo, { status });

export const POST: APIRoute = async ({ request, locals }) => {
  const s = locals.sessione!;
  try {
    const f = await request.formData();
    const id = String(f.get('evento') ?? '');
    const d = datiDalModulo(f);
    if ('errore' in d) return json({ ok: false, errore: d.errore }, 400);
    const { e } = await leggiConcerto(s, id);
    let allegati = e.attachments ?? [];

    const nuovaLocandina = f.get('locandina') instanceof File && (f.get('locandina') as File).size > 0;
    const nuovaCopertina = f.get('copertina') instanceof File && (f.get('copertina') as File).size > 0;
    let cartella: string | undefined;
    if (nuovaLocandina || nuovaCopertina) {
      // La cartella del concerto: quella di un file già allegato, altrimenti si crea come per un nuovo concerto
      const primo = allegati.find((a) => a.fileId);
      cartella = (primo && (await cartellaDelFile(s, primo.fileId!))) ?? (await cartellaConcerto(s, stagione(d.data), nomeCartella(d)));
      const caricati = await caricaImmagini(s, f, cartella);
      if ('errore' in caricati) return json({ ok: false, errore: caricati.errore }, 400);
      // Le nuove prendono il posto delle vecchie dello stesso tipo, nell'evento e nelle righe della descrizione
      if (nuovaLocandina) { allegati = allegati.filter((a) => !eLocandina(a.title)); d.rigaLocandina = ''; }
      if (nuovaCopertina) { allegati = allegati.filter((a) => eLocandina(a.title) || !a.mimeType.startsWith('image/')); d.rigaFoto = ''; }
      allegati = [...allegati, ...caricati.nuovi];
    }

    const avvisoInglese = await completaInglese(d);
    // Lo stato decide se il concerto è (o resta) anche nel calendario pubblico
    const aggiornato = await salvaConcerto(s, id, { ...corpoEvento(d), attachments: allegati.map(({ fileUrl, title, mimeType }) => ({ fileUrl, title, mimeType })) }, statoValido(f.get('stato')));
    return json({ ok: true, evento: aggiornato.htmlLink, cartella: cartella && `https://drive.google.com/drive/folders/${cartella}`, avviso: avvisoInglese, inglese: ingleseScritto(d) });
  } catch (e) {
    return json({ ok: false, errore: spiegaTesto(e) }, 500);
  }
};
