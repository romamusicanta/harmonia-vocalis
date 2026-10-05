// Area Amministrazione: ogni pagina sotto /admin (tranne accesso e ritorno da Google) richiede
// una sessione valida; chi non l'ha va all'accesso con Google e poi torna dov'era.
// Le richieste che modificano qualcosa (POST) devono venire dal sito stesso.
// Area coristi: le pagine sotto /area (non prerenderizzate fuori dalla demo, vedi astro.config.mjs)
// si aprono solo a chi è entrato ed è nel gruppo dei coristi. Area del Maestro (/maestro, i
// report): solo al gruppo della direzione, con lo stesso accesso con Google e la stessa sessione.
// Area del tesoriere (/tesoriere, quote e cassa): solo ai gruppi della tesoreria, idem. Gli amministratori
// del sito (coro.coristi.amministratori) aprono tutte le aree.
import { defineMiddleware } from 'astro:middleware';
import { leggiSessione, salvaSessione } from './admin/sessione';
import { conFoto, tokenValido } from './admin/google';
import { apreArea, apreMaestro, apreTesoriere, areaDi, chiudiCorista, coristaValido, leggiCorista, salvaCorista } from './area/accesso';

const libere = ['/admin/accedi', '/admin/callback', '/admin/esci'];
const libereArea = ['/area/accesso', '/area/entra', '/area/callback', '/area/esci'];
const libereMaestro = ['/maestro/accesso'];
const libereTesoriere = ['/tesoriere/accesso'];

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
  const tesoriere = /^\/tesoriere(\/|$)/.test(pathname);
  if (area || maestro || tesoriere) {
    if ((area ? libereArea : maestro ? libereMaestro : libereTesoriere).includes(pathname.replace(/\/$/, ''))) return riservata(await avanti());
    const accesso = maestro ? '/maestro/accesso' : tesoriere ? '/tesoriere/accesso' : '/area/accesso';
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
    if (maestro && !apreMaestro(corista)) return ctx.redirect(`/maestro/accesso?${new URLSearchParams({ errore: `L’indirizzo ${corista.email} non è tra quelli che possono vedere l’area del Maestro.` })}`);
    // /area/notifiche anche per la direzione: lì si iscrivono i telefoni di tutte e due le aree
    if (area && !apreArea(corista) && pathname !== '/area/notifiche') return ctx.redirect(areaDi(corista));
    // L'area del tesoriere solo ai gruppi della tesoreria
    if (tesoriere && !apreTesoriere(corista)) return ctx.redirect(`/tesoriere/accesso?${new URLSearchParams({ errore: `L’indirizzo ${corista.email} non è tra quelli che possono vedere l’area del tesoriere.` })}`);
    // Le sessioni aperte prima della foto del profilo la prendono da Google, senza chiedere niente
    if (corista.foto === undefined && ctx.request.method === 'GET' && ctx.request.headers.get('sec-fetch-mode') === 'navigate') {
      return ctx.redirect(`/area/entra?${new URLSearchParams({ silenzioso: '1', dopo: pathname + ctx.url.search })}`);
    }
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
  // Le sessioni aperte prima della foto del profilo la prendono subito, con il token che hanno
  const completa = sessione.foto === undefined ? await conFoto(sessione) : sessione;
  if (completa !== letta) salvaSessione(ctx.cookies, completa, ctx.url.protocol === 'https:');
  ctx.locals.sessione = completa;
  // Chi ha solo un ruolo nella bacheca (tesoriere, presidente…) vede solo gli avvisi (e ne manda la notifica)
  if (completa.redattore === false && !/^\/admin\/(avvisi|notifiche)\/?$/.test(pathname)) return ctx.redirect('/admin/avvisi');
  return riservata(await avanti());
});
