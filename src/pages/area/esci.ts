// Uscita dall'area coristi, del Maestro (?da=maestro) o del tesoriere (?da=tesoriere): si chiude la sessione (la stessa) e si
// torna alla pagina di accesso. Dal 7/10/2026 si esce anche dall'Amministrazione (un solo accesso, una
// sola uscita) e non si rientra in silenzio finché non si accede di nuovo (segnaUscita)
import type { APIRoute } from 'astro';
import { chiudiCorista, segnaUscita } from '../../area/accesso';
import { chiudiSessione } from '../../admin/sessione';

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect, url }) => {
  chiudiCorista(cookies);
  chiudiSessione(cookies);
  segnaUscita(cookies, url.protocol === 'https:');
  const da = url.searchParams.get('da');
  return redirect(da === 'maestro' ? '/maestro/accesso?uscito=1' : da === 'tesoriere' ? '/tesoriere/accesso?uscito=1' : '/area/accesso?uscito=1');
};
