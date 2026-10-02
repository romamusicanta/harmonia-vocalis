// "Pubblica ora": chiama il deploy hook di Vercel, che ricostruisce il sito con i dati di adesso.
import type { APIRoute } from 'astro';
import { pubblica } from '../../admin/operazioni';

export const prerender = false;

export const POST: APIRoute = async ({ redirect }) => {
  try {
    await pubblica();
    return redirect('/admin?pubblicato=1', 303);
  } catch (e) {
    return redirect(`/admin?${new URLSearchParams({ errore: (e as Error).message })}`, 303);
  }
};
