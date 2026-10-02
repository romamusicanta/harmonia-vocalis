// Uscita dall'area coristi: si chiude la sessione e si torna alla pagina di accesso
import type { APIRoute } from 'astro';
import { chiudiCorista } from '../../area/accesso';

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect }) => {
  chiudiCorista(cookies);
  return redirect('/area/accesso?uscito=1');
};
