// Sostituisce una foto del sito nella cartella Sito/Foto del Drive condiviso
import type { APIRoute } from 'astro';
import { NOMI_FOTO_SITO, sostituisciFotoSito } from '../../../admin/operazioni';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;

const json = (corpo: object, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const f = await request.formData();
    const nome = f.get('nome') as (typeof NOMI_FOTO_SITO)[number];
    const foto = f.get('foto');
    if (!NOMI_FOTO_SITO.includes(nome)) return json({ ok: false, errore: 'posto della foto sconosciuto' }, 400);
    if (!(foto instanceof File) || !/^image\/(jpeg|png|webp)$/.test(foto.type)) return json({ ok: false, errore: 'serve un’immagine JPEG, PNG o WebP' }, 400);
    await sostituisciFotoSito(locals.sessione!, nome, foto);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, errore: spiegaTesto(e) }, 500);
  }
};
