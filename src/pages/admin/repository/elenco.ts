// Chorus Repository: il contenuto di una cartella per la finestra «Importa» (src/admin/SceltaRepository.astro),
// ?cartella=<id>&tipi=immagini|spartiti|audio. Nella demo non si apre: il repository non è pubblico
import type { APIRoute } from 'astro';
import { elencoRepository, type Tipi } from '../../../admin/repository';
import { inDemo } from '../../../area/demo';
import { spiegaTesto } from '../../../area/errori';

export const prerender = false;
export const GET: APIRoute = async ({ url }) => {
  if (inDemo()) return Response.json({ ok: false, errore: 'Nella demo il Chorus Repository non si apre.' }, { status: 403 });
  const tipi = (['immagini', 'spartiti', 'audio'] as Tipi[]).find((t) => t === url.searchParams.get('tipi')) ?? 'immagini';
  try {
    return Response.json({ ok: true, ...(await elencoRepository(url.searchParams.get('cartella') ?? undefined, tipi)) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return Response.json({ ok: false, errore: spiegaTesto(e) }, { status: 500 });
  }
};
