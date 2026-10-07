// Ritorno da Google: si controlla lo state, si scambia il codice e si verifica che chi entra
// faccia parte del gruppo dei coristi. Dopo una richiesta silenziosa (solo per la foto) qualunque
// problema lascia la sessione com'era, con la foto vuota per non riprovare a ogni pagina; dopo una
// richiesta automatica (chi non aveva la sessione) qualunque problema porta alla pagina di accesso,
// senza errori.
import type { APIRoute } from 'astro';
import { apreMaestro, apreTesoriere, areaDi, completaAccesso, leggiCorista, ricordaAccount, salvaCorista } from '../../area/accesso';
import { decifra } from '../../admin/sessione';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const p = url.searchParams;
  const atteso = decifra<{ stato: string; dopo: string; silenzioso?: string; automatico?: boolean }>(cookies.get('hv-stato-area')?.value);
  cookies.delete('hv-stato-area', { path: '/area' });
  const maestro = atteso?.dopo.startsWith('/maestro');
  const tesoriere = atteso?.dopo.startsWith('/tesoriere');
  const accesso = maestro ? '/maestro/accesso' : tesoriere ? '/tesoriere/accesso' : '/area/accesso';
  const errore = (m: string) => redirect(`${accesso}?${new URLSearchParams(atteso?.automatico ? { dopo: atteso.dopo } : { errore: m, dopo: atteso?.dopo ?? '/area' })}`);

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
  ricordaAccount(cookies, esito.corista.email, url.protocol === 'https:');
  // Ognuno va nella sua area: chi chiede un'area che non è sua finisce in una delle sue (coristi,
  // Maestro, tesoriere, in quest'ordine)
  const c = esito.corista;
  const sua = areaDi(c);
  if (maestro && !apreMaestro(c)) return redirect(sua);
  if (tesoriere && !apreTesoriere(c)) return redirect(sua);
  if (!maestro && !tesoriere && !c.coro && !c.amministratore) return redirect(sua);
  return redirect(atteso.dopo);
};
