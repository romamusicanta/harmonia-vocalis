// Area Amministrazione: ogni pagina sotto /admin (tranne accesso e ritorno da Google) richiede
// una sessione valida; chi non l'ha va all'accesso con Google e poi torna dov'era.
// Le richieste che modificano qualcosa (POST) devono venire dal sito stesso.
// Area coristi: le pagine sotto /area (non prerenderizzate fuori dalla demo, vedi astro.config.mjs)
// si aprono solo a chi è entrato ed è nel gruppo dei coristi; /area/direzione (i report) solo al
// gruppo della direzione, che non vede il resto dell'area.
import { defineMiddleware } from 'astro:middleware';
import { leggiSessione, salvaSessione } from './admin/sessione';
import { tokenValido } from './admin/google';
import { chiudiCorista, coristaValido, eCorista, leggiCorista, salvaCorista } from './area/accesso';

const libere = ['/admin/accedi', '/admin/callback', '/admin/esci'];
const libereArea = ['/area/accesso', '/area/entra', '/area/callback', '/area/esci'];

const riservata = (risposta: Response) => {
  risposta.headers.set('Cache-Control', 'no-store');
  risposta.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return risposta;
};

export const onRequest = defineMiddleware(async (ctx, avanti) => {
  const { pathname } = ctx.url;
  if (ctx.isPrerendered) return avanti();

  if (/^\/[^/]+\/area(\/|$)/.test(pathname)) return new Response(null, { status: 404 });
  if (/^\/area(\/|$)/.test(pathname)) {
    if (libereArea.includes(pathname.replace(/\/$/, ''))) return riservata(await avanti());
    const letto = leggiCorista(ctx.cookies);
    const corista = letto && (await coristaValido(letto));
    if (!corista) {
      if (letto) chiudiCorista(ctx.cookies);
      return ctx.redirect(`/area/accesso?${new URLSearchParams({ dopo: pathname + ctx.url.search, ...(letto ? { errore: 'Il tuo indirizzo non è più nell’elenco dei coristi.' } : {}) })}`);
    }
    if (corista !== letto) salvaCorista(ctx.cookies, corista, ctx.url.protocol === 'https:');
    if (ctx.request.method !== 'GET' && ctx.request.headers.get('origin') !== ctx.url.origin) {
      return new Response('Richiesta non valida', { status: 403 });
    }
    const direzione = /^\/area\/direzione(\/|$)/.test(pathname);
    if (direzione && !corista.direzione) return ctx.redirect('/area');
    if (!direzione && !eCorista(corista)) return ctx.redirect('/area/direzione');
    ctx.locals.corista = corista;
    return riservata(await avanti());
  }

  if (!/^\/admin(\/|$)/.test(pathname)) return avanti();

  if (ctx.request.method !== 'GET' && ctx.request.headers.get('origin') !== ctx.url.origin) {
    return new Response('Richiesta non valida', { status: 403 });
  }
  if (libere.includes(pathname.replace(/\/$/, ''))) return avanti();

  const letta = leggiSessione(ctx.cookies);
  const sessione = letta && (await tokenValido(letta));
  if (!sessione) return ctx.redirect(`/admin/accedi?${new URLSearchParams({ dopo: pathname + ctx.url.search })}`);
  if (sessione !== letta) salvaSessione(ctx.cookies, sessione, ctx.url.protocol === 'https:');
  ctx.locals.sessione = sessione;
  return riservata(await avanti());
});
