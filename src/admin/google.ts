// Accesso con Google all'area Amministrazione e chiamate alle API di Google a nome di chi è entrato.
// Il client OAuth "web" sta nel progetto Google Cloud harmonia-vocalis-510406 (consenso Interno:
// solo account del dominio). Entrano i redattori (gruppo coro.amministrazione.gruppo) e, per i soli
// avvisi della bacheca, chi ha un ruolo in coro.coristi.bacheca (il presidente; Maestro e tesoriere
// vanno invece nella loro area): per loro
// la sessione ha redattore = false e il middleware apre solo /admin/avvisi. Il Maestro no: ha la
// sua area, e chi è solo nel gruppo della direzione viene mandato lì.
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from 'astro:env/server';
import { coro } from '../motore/coro';
import type { Sessione } from './sessione';

const AMBITI = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive',
  // Per sapere se chi entra fa parte del gruppo dei redattori
  'https://www.googleapis.com/auth/cloud-identity.groups.readonly',
];

export const configurato = () => Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && coro.amministrazione);

export function urlAccesso(ritorno: string, stato: string) {
  const p = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    redirect_uri: ritorno,
    response_type: 'code',
    scope: AMBITI.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    hd: coro.amministrazione!.dominio,
    state: stato,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

interface Token { access_token: string; expires_in: number; refresh_token?: string; scope: string }

async function token(corpo: Record<string, string>): Promise<Token> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID!, client_secret: GOOGLE_CLIENT_SECRET!, ...corpo }),
  });
  if (!r.ok) throw new Error(`Google ha rifiutato il token (${r.status})`);
  return r.json();
}

// Dopo il ritorno da Google: chi è, e se è un amministratore
export async function completaAccesso(codice: string, ritorno: string): Promise<{ sessione?: Sessione; errore?: string; altrove?: string; persona?: { email: string; nome: string; foto?: string } }> {
  const t = await token({ code: codice, redirect_uri: ritorno, grant_type: 'authorization_code' });
  const mancanti = AMBITI.filter((a) => a.startsWith('https://www.googleapis.com/auth/') && !t.scope.split(' ').includes(a));
  if (mancanti.length) return { errore: 'Per usare l’area servono tutti i permessi richiesti (calendario, Drive, gruppi): riprova e lasciali selezionati.' };
  const io = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${t.access_token}` } })).json();
  const { dominio, gruppo } = coro.amministrazione!;
  if (!io.email_verified || io.hd !== dominio) return { errore: `Si entra solo con un account @${dominio}.` };
  const suoi = await gruppiDi(t.access_token, io.email);
  const redattore = suoi.has(gruppo.toLowerCase());
  // Il Maestro e il tesoriere scrivono gli avvisi dalla loro area (/maestro/avvisi, /tesoriere/avvisi):
  // il loro ruolo nella bacheca non apre l'Amministrazione, dove entrano solo se sono anche redattori
  // o amministratori
  const direzione = coro.coristi?.direzione?.toLowerCase();
  const tesoreria = (coro.coristi?.tesoreria?.gruppi ?? []).map((g) => g.toLowerCase());
  const conAreaPropria = (g: string) => g === direzione || tesoreria.includes(g);
  const conRuolo = (coro.coristi?.bacheca ?? []).some((r) => !conAreaPropria(r.gruppo.toLowerCase()) && suoi.has(r.gruppo.toLowerCase()) && !(r.tranne && suoi.has(r.tranne.toLowerCase())));
  const persona = { email: io.email, nome: io.given_name ?? io.name ?? io.email, foto: io.picture ?? '' };
  if (!redattore && !conRuolo && direzione && suoi.has(direzione)) return { altrove: '/maestro', persona };
  if (!redattore && !conRuolo && tesoreria.some((g) => suoi.has(g))) return { altrove: '/tesoriere', persona };
  if (!redattore && !conRuolo) return { errore: `L’account ${io.email} non fa parte del gruppo ${gruppo}.` };
  return {
    sessione: { email: io.email, nome: io.given_name ?? io.name ?? io.email, foto: io.picture ?? '', accesso: t.access_token, rinnovo: t.refresh_token, scade: Date.now() + (t.expires_in - 60) * 1000, redattore },
  };
}

// I gruppi di cui l'utente fa parte (anche indirettamente): ognuno può sempre vedere i propri
async function gruppiDi(accesso: string, email: string) {
  const query = `member_key_id == '${email}' && 'cloudidentity.googleapis.com/groups.discussion_forum' in labels`;
  const r = await fetch(`https://cloudidentity.googleapis.com/v1/groups/-/memberships:searchTransitiveGroups?${new URLSearchParams({ query })}`, {
    headers: { Authorization: `Bearer ${accesso}` },
  });
  if (!r.ok) throw new Error(`Non riesco a leggere i gruppi di ${email} (${r.status}): ${await r.text()}`);
  const { memberships = [] } = (await r.json()) as { memberships?: { groupKey?: { id?: string } }[] };
  return new Set(memberships.map((m) => m.groupKey?.id?.toLowerCase()).filter((g): g is string => Boolean(g)));
}

// La foto dell'account Google ('' se non c'è); se Google non risponde, si riprova la volta dopo
async function fotoDi(accesso: string) {
  try {
    const io = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accesso}` } })).json();
    return (io.picture as string | undefined) ?? '';
  } catch {
    return undefined;
  }
}
export const conFoto = async (s: Sessione): Promise<Sessione> => ({ ...s, foto: await fotoDi(s.accesso) });

// Token ancora valido, o rinnovato; undefined se bisogna rientrare
export async function tokenValido(s: Sessione): Promise<Sessione | undefined> {
  if (Date.now() < s.scade) return s;
  if (!s.rinnovo) return undefined;
  try {
    const t = await token({ refresh_token: s.rinnovo, grant_type: 'refresh_token' });
    return { ...s, accesso: t.access_token, scade: Date.now() + (t.expires_in - 60) * 1000 };
  } catch {
    return undefined;
  }
}

// Chiamata alle API di Google con il token di chi è entrato; errore leggibile se va male
export async function api<T = any>(s: Sessione, url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${s.accesso}`, ...(init.headers ?? {}) } });
  if (!r.ok) {
    const testo = await r.text();
    const messaggio = (() => { try { return JSON.parse(testo).error?.message; } catch { return undefined; } })();
    throw new Error(`Google (${r.status}): ${messaggio ?? testo.slice(0, 200)}`);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
