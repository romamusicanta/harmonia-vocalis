// Area Amministrazione: ogni pagina sotto /admin (tranne accesso e ritorno da Google) richiede
// una sessione valida; chi non l'ha va all'accesso con Google e poi torna dov'era.
// Le richieste che modificano qualcosa (POST) devono venire dal sito stesso.
// Area coristi: le pagine sotto /area (non prerenderizzate fuori dalla demo, vedi astro.config.mjs)
// si aprono solo a chi è entrato ed è nel gruppo dei coristi. Area del Maestro (/maestro, i
// report): solo al gruppo della direzione, con lo stesso accesso con Google e la stessa sessione.
// Area del tesoriere (/tesoriere, quote e cassa): solo ai gruppi della tesoreria, idem. Gli amministratori
// del sito (coro.coristi.amministratori) aprono tutte le aree; nell'area del tesoriere loro e i redattori
// (dal 7/10/2026) solo in lettura: nessuna richiesta che modifica (POST), niente Avvisi.
// Gruppo Demo (dal 7/10/2026, src/area/demo.ts): Amministrazione e area del Maestro in sola lettura, con
// ogni richiesta dentro il contesto demo (nomi inventati, note nascoste); dell'area del tesoriere vede al
// posto di ogni sezione la sua anteprima (src/pages/tesoriere/anteprima/[sezione].astro).
import { defineMiddleware } from 'astro:middleware';
import { leggiSessione, salvaSessione } from './admin/sessione';
import { conDemo, MESSAGGIO_DEMO } from './area/demo';
import { conFoto, tokenValido } from './admin/google';
import { apreArea, apreMaestro, apreTesoriere, scriveTesoriere, areaDi, chiudiCorista, coristaValido, leggiCorista, rientroSilenzioso, salvaCorista } from './area/accesso';

const libere = ['/admin/accedi', '/admin/callback', '/admin/esci'];
const libereArea = ['/area/accesso', '/area/entra', '/area/callback', '/area/esci'];
const libereMaestro = ['/maestro/accesso'];
const libereTesoriere = ['/tesoriere/accesso'];

// Le richieste che modificano qualcosa, rifiutate in modalità demo (le pagine mostrano il messaggio)
const rifiutaDemo = () => new Response(JSON.stringify({ errore: MESSAGGIO_DEMO }), { status: 403, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
// Le sezioni dell'area del tesoriere, per l'anteprima della demo
const sezioneTesoriere = (pathname: string) => ({ '': 'riepilogo', quote: 'riepilogo', cassa: 'cassa', maestri: 'maestri', rendiconto: 'rendiconto', avvisi: 'avvisi' } as Record<string, string>)[pathname.replace(/^\/tesoriere\/?/, '').replace(/\/$/, '')];

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
      // Senza sessione si prova prima a rientrare in silenzio con Google (dal 7/10/2026: per esempio
      // dopo un mese, o arrivando dall'Amministrazione se l'accesso lì non ha aperto le aree)
      if (!letto && rientroSilenzioso(ctx.cookies, ctx.request)) return ctx.redirect(`/area/entra?${new URLSearchParams({ automatico: '1', dopo: pathname + ctx.url.search })}`);
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
    // Gruppo Demo: niente modifiche; dell'area del tesoriere solo le anteprime
    if (corista.demo) {
      if (ctx.request.method !== 'GET') return rifiutaDemo();
      ctx.locals.corista = corista;
      if (tesoriere && !pathname.startsWith('/tesoriere/anteprima/')) {
        const s = sezioneTesoriere(pathname);
        return s ? riservata(await conDemo(true, () => avanti(`/tesoriere/anteprima/${s}`))) : ctx.redirect('/tesoriere');
      }
      return riservata(await conDemo(true, () => avanti()));
    }
    // Redattori e amministratori: area del tesoriere in sola lettura
    if (tesoriere && !scriveTesoriere(corista)) {
      if (ctx.request.method !== 'GET') return new Response(JSON.stringify({ errore: 'Hai l’area del tesoriere in sola lettura: solo il tesoriere può modificare i dati.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      if (/^\/tesoriere\/avvisi\/?$/.test(pathname)) return ctx.redirect('/tesoriere');
    }
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
  // Gruppo Demo: si guarda tutto, non si salva niente
  if (completa.demo) {
    if (ctx.request.method !== 'GET') return rifiutaDemo();
    return riservata(await conDemo(true, () => avanti()));
  }
  return riservata(await avanti());
});
