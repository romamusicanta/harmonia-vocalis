// Area Amministrazione: ogni pagina sotto /admin (tranne accesso e ritorno da Google) richiede
// una sessione valida; chi non l'ha va all'accesso con Google e poi torna dov'era.
// Le richieste che modificano qualcosa (POST) devono venire dal sito stesso.
import { defineMiddleware } from 'astro:middleware';
import { leggiSessione, salvaSessione } from './admin/sessione';
import { tokenValido } from './admin/google';

const libere = ['/admin/accedi', '/admin/callback', '/admin/esci'];

export const onRequest = defineMiddleware(async (ctx, avanti) => {
  const { pathname } = ctx.url;
  if (ctx.isPrerendered || !/^\/admin(\/|$)/.test(pathname)) return avanti();

  if (ctx.request.method !== 'GET' && ctx.request.headers.get('origin') !== ctx.url.origin) {
    return new Response('Richiesta non valida', { status: 403 });
  }
  if (libere.includes(pathname.replace(/\/$/, ''))) return avanti();

  const letta = leggiSessione(ctx.cookies);
  const sessione = letta && (await tokenValido(letta));
  if (!sessione) return ctx.redirect(`/admin/accedi?${new URLSearchParams({ dopo: pathname + ctx.url.search })}`);
  if (sessione !== letta) salvaSessione(ctx.cookies, sessione, ctx.url.protocol === 'https:');
  ctx.locals.sessione = sessione;
  const risposta = await avanti();
  risposta.headers.set('Cache-Control', 'no-store');
  risposta.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return risposta;
});
