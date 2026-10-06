// Amministrazione: caricamento a pezzi di una foto di un concerto dalla Modifica del concerto, come
// quello dei coristi (src/area/fotoConcerti.ts), a nome del redattore
import type { APIRoute } from 'astro';
import { rispondiFotoCorista } from '../../../area/fotoConcerti';

export const prerender = false;
export const POST: APIRoute = ({ request, locals }) => rispondiFotoCorista(request, locals.sessione!.email);
