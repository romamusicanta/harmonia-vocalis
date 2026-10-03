// Caricamento a pezzi di spartiti e brani del repertorio (vedi rispondiFile in src/area/repertorio.ts)
import type { APIRoute } from 'astro';
import { rispondiFile } from '../../../area/repertorio';

export const prerender = false;
export const POST: APIRoute = ({ request, locals }) => rispondiFile(request, locals.sessione!.email);
