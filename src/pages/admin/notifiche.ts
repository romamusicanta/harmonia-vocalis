// Notifiche push dall'Amministrazione (InvioNotifica.astro accanto ai pulsanti WhatsApp): quanti
// telefoni e invio, per redattori, presidente e tesoriere
import type { APIRoute } from 'astro';
import { rispondi } from '../../area/notifiche';

export const prerender = false;
export const POST: APIRoute = ({ request, locals }) => rispondi(request, locals.sessione!.email, true);
