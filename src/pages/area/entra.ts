// Accesso all'area coristi e a quella del Maestro (dopo=/maestro): si va da Google e si torna su
// /area/callback. Un valore casuale
// (state) in un cookie protegge il ritorno da richieste estranee.
import { randomBytes } from 'node:crypto';
import type { APIRoute } from 'astro';
import { configurato, urlAccesso } from '../../area/accesso';
import { cifra } from '../../admin/sessione';

export const prerender = false;

export const GET: APIRoute = ({ url, cookies, redirect }) => {
  if (!configurato()) return redirect(`/area/accesso?${new URLSearchParams({ errore: 'L’accesso non è ancora configurato: mancano le credenziali di Google sul server.', dopo: url.searchParams.get('dopo') ?? '/area' })}`);
  const dopo = url.searchParams.get('dopo') ?? '/area';
  const stato = randomBytes(16).toString('hex');
  cookies.set('hv-stato-area', cifra({ stato, dopo: /^\/(area|maestro)(\/|$)/.test(dopo) ? dopo : '/area' }), { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/area', maxAge: 600 });
  return redirect(urlAccesso(`${url.origin}/area/callback`, stato));
};
