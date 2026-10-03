// Caricamento a pezzi delle registrazioni delle prove (vedi rispondiFile in src/area/registrazioni.ts)
import type { APIRoute } from 'astro';
import { rispondiFile } from '../../../area/registrazioni';

export const prerender = false;
export const POST: APIRoute = ({ request, locals }) => rispondiFile(request, locals.corista!.email);
