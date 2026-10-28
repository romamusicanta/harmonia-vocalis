// Foto del sito → Il Maestro: carica una foto (già ridotta dal browser) nella cartella Sito/Foto/Maestro
// del Drive condiviso; entra subito nel carosello, in fondo (src/admin/fotoMaestro.ts). Con il campo
// repository (id del file) la foto si importa dal Chorus Repository (src/admin/repository.ts)
import type { APIRoute } from 'astro';
import { caricaFotoMaestro } from '../../../admin/fotoMaestro';
import { spiegaTesto } from '../../../area/errori';
import { immagineDalRepository } from '../../../admin/repository';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const dati = await request.formData();
    const daRepository = dati.get('repository');
    const foto = daRepository ? await immagineDalRepository(String(daRepository)) : dati.get('foto');
    if (!(foto instanceof File) || !foto.size) throw new Error('nessuna foto');
    return Response.json({ ok: true, id: await caricaFotoMaestro(locals.sessione!, foto) });
  } catch (e) {
    return Response.json({ ok: false, errore: spiegaTesto(e) }, { status: 500 });
  }
};
