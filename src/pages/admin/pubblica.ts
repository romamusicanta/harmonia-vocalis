// "Pubblica ora": chiama il deploy hook di Vercel, che ricostruisce il sito con i dati di adesso.
// Dalla pagina Pubblicazione arriva con fetch e risponde in JSON; senza JavaScript, un modulo
// normale torna alla pagina con il messaggio.
import type { APIRoute } from 'astro';
import { pubblica } from '../../admin/operazioni';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const daScript = request.headers.get('accept')?.includes('application/json');
  try {
    await pubblica();
    return daScript ? Response.json({ ok: true }) : redirect('/admin?pubblicato=1', 303);
  } catch (e) {
    const errore = (e as Error).message;
    return daScript ? Response.json({ ok: false, errore }, { status: 502 }) : redirect(`/admin?${new URLSearchParams({ errore })}`, 303);
  }
};
