// Accesso con il codice via email (dal 7/10/2026, src/area/codice.ts), dal modulo
// src/area/AccessoCodice.astro delle pagine di accesso: { azione: 'chiedi', indirizzo } manda il
// codice; { azione: 'verifica', codice, dopo } apre la sessione delle aree e, a chi ne ha diritto,
// quella dell'Amministrazione (un solo accesso per tutte le aree), poi dice dove andare.
import type { APIRoute } from 'astro';
import { apreArea, apreMaestro, apreTesoriere, areaDi, ricordaAccount, salvaCorista } from '../../area/accesso';
import { avvisaAccessoAmministrazione, chiediCodice, codiceConfigurato, dispositivoDa, verificaCodice } from '../../area/codice';
import { sessioneDalleAree } from '../../admin/google';
import { salvaSessione } from '../../admin/sessione';
import { spiega, spiegaTesto } from '../../area/errori';

export const prerender = false;

const json = (dati: object, status = 200) => new Response(JSON.stringify(dati), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request, cookies, url }) => {
  if (request.headers.get('origin') !== url.origin) return json({ errore: 'Richiesta non valida.' }, 403);
  if (!codiceConfigurato()) return json({ errore: 'L’accesso con il codice non è ancora attivo: usa «Accedi con Google».' }, 503);
  const secure = url.protocol === 'https:';
  const dati = (await request.json().catch(() => ({}))) as { azione?: string; indirizzo?: string; codice?: string; dopo?: string };

  if (dati.azione === 'chiedi') {
    const indirizzo = String(dati.indirizzo ?? '').trim();
    if (!indirizzo || indirizzo.length > 200) return json({ errore: 'Scrivi il tuo indirizzo email.' }, 400);
    try {
      await chiediCodice(indirizzo, cookies, secure);
    } catch (e) {
      console.error('[codice] invio non riuscito:', e);
      return json({ errore: `Non riesco a mandare il codice adesso. ${spiegaTesto(e)} Riprova tra poco o usa «Accedi con Google».`, dettaglio: spiega(e).dettaglio ?? String(e) }, 502);
    }
    return json({ ok: true });
  }

  if (dati.azione === 'verifica') {
    let esito;
    try {
      esito = await verificaCodice(String(dati.codice ?? ''), cookies, secure);
    } catch (e) {
      return json({ errore: `Non riesco a controllare il codice adesso. ${spiegaTesto(e)}` }, 502);
    }
    if (!esito.corista) return json({ errore: esito.errore ?? 'Accesso non riuscito.' }, 400);
    const c = esito.corista;
    salvaCorista(cookies, c, secure);
    ricordaAccount(cookies, c.email, secure);
    const amministrazione = await sessioneDalleAree(c);
    if (amministrazione) {
      salvaSessione(cookies, amministrazione, secure);
      if (amministrazione.redattore !== false && !amministrazione.demo) {
        await avvisaAccessoAmministrazione(c, esito.destinatario!, dispositivoDa(request.headers.get('user-agent') ?? '')).catch((e) => console.error('[codice] avviso non spedito:', e));
      }
    }
    // Dove voleva andare, se è sua; altrimenti la sua prima area
    const dopo = String(dati.dopo ?? '');
    const sua =
      (/^\/admin(\/|$)/.test(dopo) && amministrazione) ||
      (/^\/maestro(\/|$)/.test(dopo) && apreMaestro(c)) ||
      (/^\/tesoriere(\/|$)/.test(dopo) && apreTesoriere(c)) ||
      (/^\/area(\/|$)/.test(dopo) && apreArea(c));
    const prima = amministrazione && !c.coro && !c.direzione && !c.tesoreria ? '/admin' : areaDi(c);
    return json({ ok: true, vai: sua ? dopo : prima });
  }

  return json({ errore: 'Richiesta non valida.' }, 400);
};
