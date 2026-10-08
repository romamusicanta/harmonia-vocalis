// I calendari "Concerti" e "Prove" li scrive solo il sito (dal 6/10/2026), con l'account di servizio
// (src/area/servizio.ts, ambito calendar.events, "Apportare modifiche agli eventi" su entrambi i
// calendari): le persone, redattori compresi, li vedono soltanto. Prima il sito scriveva a nome di chi
// era entrato nell'Amministrazione, e per questo i redattori dovevano poterli modificare anche
// direttamente in Google Calendar. Anche le letture dell'Amministrazione passano da qui, così non
// dipendono dai permessi di chi è entrato.
import { CALENDARIO_PROVE_ID } from 'astro:env/server';
import { tokenServizio } from '../area/servizio';
import { eventoApiPerDemo, inDemo } from '../area/demo';

export const CAL = 'https://www.googleapis.com/calendar/v3';

// Una chiamata al calendario; risposta vuota (cancellazione) = undefined; un evento già cancellato
// (410) non è un errore; errore leggibile, "Google (stato): messaggio", altrimenti
export async function calendario<T = any>(indirizzo: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(indirizzo, { ...init, headers: { Authorization: `Bearer ${await tokenServizio()}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) } });
  if (!r.ok && !(init.method === 'DELETE' && r.status === 410)) {
    const testo = await r.text();
    const messaggio = (() => { try { return JSON.parse(testo).error?.message; } catch { return undefined; } })();
    throw new Error(`Google (${r.status}): ${messaggio ?? testo.slice(0, 200)}`);
  }
  const dati = r.status === 204 || r.status === 410 ? undefined : await r.json();
  // Gruppo Demo (src/area/demo.ts): concerti non pubblici e note delle prove nascosti. Qui non c'è
  // cache, quindi si può nascondere già alla lettura
  if (dati && inDemo() && (init.method ?? 'GET') === 'GET') {
    const daProve = Boolean(CALENDARIO_PROVE_ID) && indirizzo.includes(`/calendars/${encodeURIComponent(CALENDARIO_PROVE_ID!)}/`);
    return (Array.isArray(dati.items) ? { ...dati, items: dati.items.map((e: any) => eventoApiPerDemo(e, daProve)) } : dati.start ? eventoApiPerDemo(dati, daProve) : dati) as T;
  }
  return dati as T;
}
