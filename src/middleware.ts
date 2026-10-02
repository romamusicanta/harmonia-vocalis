// Area Amministrazione: ogni pagina sotto /admin (tranne accesso e ritorno da Google) richiede
// una sessione valida; chi non l'ha va all'accesso con Google e poi torna dov'era.
// Le richieste che modificano qualcosa (POST) devono venire dal sito stesso.
// Area coristi: le pagine sotto /area (non prerenderizzate fuori dalla demo, vedi astro.config.mjs)
// si aprono solo a chi è entrato ed è nel gruppo dei coristi. Area del Maestro (/maestro, i
// report): solo al gruppo della direzione, con lo stesso accesso con Google e la stessa sessione.
import { defineMiddleware } from 'astro:middleware';
import { leggiSessione, salvaSessione } from './admin/sessione';
import { tokenValido } from './admin/google';
import { chiudiCorista, coristaValido, eCorista, leggiCorista, salvaCorista } from './area/accesso';

const libere = ['/admin/accedi', '/admin/callback', '/admin/esci'];
const libereArea = ['/area/accesso', '/area/entra', '/area/callback', '/area/esci'];
const libereMaestro = ['/maestro/accesso'];

const riservata = (risposta: Response) => {
  risposta.headers.set('Cache-Control', 'no-store');
  risposta.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return risposta;
};

export const onRequest = defineMiddleware(async (ctx, avanti) => {
  const { pathname } = ctx.url;
  if (ctx.isPrerendered) return avanti();

  if (/^\/[^/]+\/area(\/|$)/.test(pathname)) return new Response(null, { status: 404 });
  if (pathname === '/area/direzione' || pathname.startsWith('/area/direzione/')) return ctx.redirect('/maestro', 301);
  const area = /^\/area(\/|$)/.test(pathname);
  const maestro = /^\/maestro(\/|$)/.test(pathname);
  if (area || maestro) {
    if ((area ? libereArea : libereMaestro).includes(pathname.replace(/\/$/, ''))) return riservata(await avanti());
    const accesso = maestro ? '/maestro/accesso' : '/area/accesso';
    const letto = leggiCorista(ctx.cookies);
    const corista = letto && (await coristaValido(letto));
    if (!corista) {
      if (letto) chiudiCorista(ctx.cookies);
      return ctx.redirect(`${accesso}?${new URLSearchParams({ dopo: pathname + ctx.url.search, ...(letto ? { errore: 'Il tuo indirizzo non è più nell’elenco.' } : {}) })}`);
    }
    // Si riscrive anche quando c'è ancora il cookie di prima (solo su /area), per passarlo a /
    if (corista !== letto || ctx.cookies.has('hv-corista')) salvaCorista(ctx.cookies, corista, ctx.url.protocol === 'https:');
    if (ctx.request.method !== 'GET' && ctx.request.headers.get('origin') !== ctx.url.origin) {
      return new Response('Richiesta non valida', { status: 403 });
    }
    // L'area del Maestro è solo per la direzione, l'area coristi solo per i coristi
    if (maestro && !corista.direzione) return ctx.redirect(`/maestro/accesso?${new URLSearchParams({ errore: `L’indirizzo ${corista.email} non è tra quelli che possono vedere l’area del Maestro.` })}`);
    if (area && !eCorista(corista)) return ctx.redirect('/maestro');
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
