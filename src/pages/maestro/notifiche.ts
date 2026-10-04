// Notifiche push dall'area del Maestro (InvioNotifica.astro negli avvisi): quanti telefoni e invio
import type { APIRoute } from 'astro';
import { rispondi } from '../../area/notifiche';

export const prerender = false;
export const POST: APIRoute = ({ request, locals }) => rispondi(request, locals.corista!.email, true);
