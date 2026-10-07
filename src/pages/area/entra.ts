// Accesso all'area coristi, a quella del Maestro (dopo=/maestro) e a quella del tesoriere (dopo=/tesoriere): si va da Google e si torna su
// /area/callback. Con silenzioso=1 (dal middleware, per chi è già dentro ma senza la foto) si
// chiede a Google senza mostrare niente; con automatico=1 (dal middleware, per chi non ha la sessione:
// dal 7/10/2026) anche, con l'account ricordato, e se Google non risponde subito si va alla pagina di
// accesso. Un valore casuale
// (state) in un cookie protegge il ritorno da richieste estranee.
import { randomBytes } from 'node:crypto';
import type { APIRoute } from 'astro';
import { accountRicordato, configurato, leggiCorista, urlAccesso } from '../../area/accesso';
import { cifra } from '../../admin/sessione';

export const prerender = false;

export const GET: APIRoute = ({ url, cookies, redirect }) => {
  if (!configurato()) return redirect(`/area/accesso?${new URLSearchParams({ errore: 'L’accesso non è ancora configurato: mancano le credenziali di Google sul server.', dopo: url.searchParams.get('dopo') ?? '/area' })}`);
  const dopo = url.searchParams.get('dopo') ?? '/area';
  const stato = randomBytes(16).toString('hex');
  const silenzioso = url.searchParams.has('silenzioso') ? leggiCorista(cookies)?.email : undefined;
  const automatico = !silenzioso && url.searchParams.has('automatico');
  const tacito = silenzioso ?? (automatico ? accountRicordato(cookies) ?? true : undefined);
  cookies.set('hv-stato-area', cifra({ stato, silenzioso, automatico, dopo: /^\/(area|maestro|tesoriere)(\/|$)/.test(dopo) ? dopo : '/area' }), { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/area', maxAge: 600 });
  return redirect(urlAccesso(`${url.origin}/area/callback`, stato, tacito));
};
