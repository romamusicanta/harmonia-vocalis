// Ritorno da Google: si controlla lo state, si scambia il codice e si verifica che chi entra
// faccia parte del gruppo dei coristi.
import type { APIRoute } from 'astro';
import { completaAccesso, salvaCorista } from '../../area/accesso';
import { decifra } from '../../admin/sessione';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const p = url.searchParams;
  const atteso = decifra<{ stato: string; dopo: string }>(cookies.get('hv-stato-area')?.value);
  cookies.delete('hv-stato-area', { path: '/area' });
  const maestro = atteso?.dopo.startsWith('/maestro');
  const errore = (m: string) => redirect(`${maestro ? '/maestro/accesso' : '/area/accesso'}?${new URLSearchParams({ errore: m, dopo: atteso?.dopo ?? '/area' })}`);

  if (p.get('error')) return errore('Accesso annullato su Google.');
  if (!atteso || atteso.stato !== p.get('state') || !p.get('code')) return errore('Accesso scaduto o non valido: riprova.');
  let esito;
  try {
    esito = await completaAccesso(p.get('code')!, `${url.origin}/area/callback`);
  } catch (e) {
    return errore(`Accesso non riuscito: ${(e as Error).message}`);
  }
  if (!esito.corista) return errore(esito.errore ?? 'Accesso non riuscito.');
  salvaCorista(cookies, esito.corista, url.protocol === 'https:');
  // Chi è solo nella direzione va nell'area del Maestro, chi è solo corista nell'area coristi
  if (maestro && !esito.corista.direzione) return redirect('/area');
  if (!maestro && !esito.corista.coro) return redirect('/maestro');
  return redirect(atteso.dopo);
};
