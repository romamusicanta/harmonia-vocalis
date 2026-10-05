// Uscita dall'area coristi, del Maestro (?da=maestro) o del tesoriere (?da=tesoriere): si chiude la sessione (la stessa) e si
// torna alla pagina di accesso
import type { APIRoute } from 'astro';
import { chiudiCorista } from '../../area/accesso';

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect, url }) => {
  chiudiCorista(cookies);
  const da = url.searchParams.get('da');
  return redirect(da === 'maestro' ? '/maestro/accesso?uscito=1' : da === 'tesoriere' ? '/tesoriere/accesso?uscito=1' : '/area/accesso?uscito=1');
};
