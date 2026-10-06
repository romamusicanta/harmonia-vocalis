// Una pagina pubblica vista (src/area/visite.ts): la manda lo script di src/layouts/Base.astro con
// navigator.sendBeacon. Non conta bot, chi è entrato nelle aree riservate (cookie hv-coro; i
// redattori li esclude lo script) né le richieste da altri siti. Si scrive solo in produzione: in
// locale, per provare, STATISTICHE_LOCALI=1.
import type { APIRoute } from 'astro';
import { configurato, dispositivoDi, eUnBot, impronta, provenienzaDi, registra } from '../../area/visite';
import { oggi } from '../../area/dati';

export const prerender = false;

const nulla = () => new Response(null, { status: 204 });

export const POST: APIRoute = async ({ request, cookies, clientAddress, url }) => {
  if (!configurato() || (process.env.VERCEL_ENV !== 'production' && process.env.STATISTICHE_LOCALI !== '1')) return nulla();
  if (request.headers.get('origin') !== url.origin) return nulla();
  const ua = request.headers.get('user-agent') ?? '';
  if (eUnBot(ua) || cookies.has('hv-coro') || cookies.has('hv-corista')) return nulla();
  let d: { p?: string; t?: string; r?: string; s?: string };
  try { d = JSON.parse(await request.text()); } catch { return nulla(); }
  const pagina = String(d.p ?? '').slice(0, 200);
  if (!pagina.startsWith('/') || /^\/(admin|area|maestro|tesoriere|api)(\/|$)/.test(pagina)) return nulla();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress || '';
  const giorno = oggi();
  const ora = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(new Date());
  registra([
    giorno, ora, impronta(ip, ua, giorno), pagina, String(d.t ?? '').slice(0, 120),
    /^\/en(\/|$)/.test(pagina) ? 'en' : 'it',
    provenienzaDi(String(d.r ?? ''), String(d.s ?? ''), url.hostname),
    dispositivoDi(ua),
  ]);
  return nulla();
};
