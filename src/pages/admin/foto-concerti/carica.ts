// Amministrazione: caricamento a pezzi (o importazione dal Chorus Repository) di una foto di un concerto
// dal modulo del concerto, come quello dei coristi (src/area/fotoConcerti.ts), a nome del redattore. Un
// concerto non ancora nell'elenco (per esempio uno vecchio appena creato) si cerca nel calendario
import type { APIRoute } from 'astro';
import { rispondiFotoCorista } from '../../../area/fotoConcerti';
import { leggiConcerto } from '../../../admin/stati';
import { datiDaEvento } from '../../../admin/concerto';

export const prerender = false;
export const POST: APIRoute = ({ request, locals }) => rispondiFotoCorista(request, locals.sessione!.email, async (id) => {
  const { e } = await leggiConcerto(id).catch(() => ({ e: undefined }));
  if (!e) return undefined;
  const d = datiDaEvento(e);
  if (!d.data) return undefined;
  const titolo = [d.opere[0]?.autore?.split(/\s+/).at(-1), d.opere[0]?.opera || e.summary].filter(Boolean).join(' · ');
  return { id: e.id, data: d.data.slice(0, 10), titolo: titolo || 'Concerto' };
});
