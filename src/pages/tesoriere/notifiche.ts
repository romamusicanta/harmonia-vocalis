// Notifiche push dall'area del tesoriere (InvioNotifica.astro negli avvisi): quanti dispositivi e invio
import type { APIRoute } from 'astro';
import { rispondi } from '../../area/notifiche';

export const prerender = false;
export const POST: APIRoute = ({ request, locals }) => rispondi(request, locals.corista!.email, true);
