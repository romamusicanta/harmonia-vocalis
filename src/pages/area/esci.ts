// Uscita dall'area coristi o del Maestro (?da=maestro): si chiude la sessione (la stessa) e si
// torna alla pagina di accesso
import type { APIRoute } from 'astro';
import { chiudiCorista } from '../../area/accesso';

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect, url }) => {
  chiudiCorista(cookies);
  return redirect(url.searchParams.get('da') === 'maestro' ? '/maestro/accesso?uscito=1' : '/area/accesso?uscito=1');
};
