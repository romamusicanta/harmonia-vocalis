// Iscrizione e cancellazione del telefono alle notifiche push (src/area/notifiche.ts), da
// InvitoNotifiche.astro nell'area coristi e in quella del Maestro (il middleware lascia passare qui
// anche chi è solo nella direzione)
import type { APIRoute } from 'astro';
import { rispondi } from '../../area/notifiche';

export const prerender = false;
export const POST: APIRoute = ({ request, locals }) => rispondi(request, locals.corista!.email, false);
