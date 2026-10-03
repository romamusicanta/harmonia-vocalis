// Ritorno da Google: si controlla lo state, si scambia il codice e si verifica che chi entra
// faccia parte del gruppo dei coristi. Dopo una richiesta silenziosa (solo per la foto) qualunque
// problema lascia la sessione com'era, con la foto vuota per non riprovare a ogni pagina.
import type { APIRoute } from 'astro';
import { completaAccesso, leggiCorista, salvaCorista } from '../../area/accesso';
import { decifra } from '../../admin/sessione';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const p = url.searchParams;
  const atteso = decifra<{ stato: string; dopo: string; silenzioso?: string }>(cookies.get('hv-stato-area')?.value);
  cookies.delete('hv-stato-area', { path: '/area' });
  const maestro = atteso?.dopo.startsWith('/maestro');
  const errore = (m: string) => redirect(`${maestro ? '/maestro/accesso' : '/area/accesso'}?${new URLSearchParams({ errore: m, dopo: atteso?.dopo ?? '/area' })}`);

  const sessione = leggiCorista(cookies);
  if (atteso?.silenzioso && sessione?.email === atteso.silenzioso) {
    let foto = '';
    if (atteso.stato === p.get('state') && p.get('code')) {
      try {
        const esito = await completaAccesso(p.get('code')!, `${url.origin}/area/callback`);
        if (esito.corista?.email === sessione.email) foto = esito.corista.foto ?? '';
      } catch { /* resta senza foto */ }
    }
    salvaCorista(cookies, { ...sessione, foto }, url.protocol === 'https:');
    return redirect(atteso.dopo);
  }

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
