// Quando è stata costruita la versione che risponde adesso: la pagina Pubblicazione lo chiede
// ogni pochi secondi dopo "Pubblica ora", e quando cambia la nuova versione è online.
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () => new Response(JSON.stringify({ build: __ORA_BUILD__ }), { headers: { 'Content-Type': 'application/json' } });
