// Area coristi: caricamento a pezzi di una foto di un concerto (src/area/fotoConcerti.ts)
import type { APIRoute } from 'astro';
import { rispondiFotoCorista } from '../../../area/fotoConcerti';

export const prerender = false;
export const POST: APIRoute = ({ request, locals }) => rispondiFotoCorista(request, locals.corista!.email);
