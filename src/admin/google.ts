// Chi entra nell'area redattori (/admin): con Google o, dal 7/10/2026, dalla sessione delle aree
// (sessioneDalleAree: per esempio dopo l'accesso con il codice via email, src/area/codice.ts).
// Il client OAuth "web" sta nel progetto Google Cloud harmonia-vocalis-510406 (consenso Interno:
// solo account del dominio). Entrano solo i redattori (gruppo coro.amministrazione.gruppo, che contiene
// gli amministratori): dall'8/10/2026 un ruolo nella bacheca non basta più (il presidente, che è anche
// amministratore, scrive gli avvisi da qui con la firma che sceglie). Chi è solo Maestro o tesoriere
// viene mandato nella sua area. Il gruppo Demo
// (coro.amministrazione.demo, dal 7/10/2026) entra con demo = true: vede tutto ma non salva niente.
// Dal 7/10/2026 a Google si chiedono solo nome ed email: Drive e calendari li scrive l'account di
// servizio (src/admin/operazioni.ts, src/admin/calendari.ts) e i gruppi li legge lui.
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from 'astro:env/server';
import { coro } from '../motore/coro';
import type { Sessione } from './sessione';
import type { Corista } from '../area/accesso';
import { nelGruppo } from '../area/servizio';

const AMBITI = ['openid', 'email', 'profile'];
// La sessione dura 12 ore (come il cookie); dopo, se c'è quella delle aree, si riapre da sola
const DURATA = 12 * 60 * 60 * 1000;

export const configurato = () => Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && coro.amministrazione);

// Con silenzioso (l'email dell'account da usare) Google non mostra niente: se l'account è collegato nel
// browser torna subito con il codice, altrimenti con un errore
export function urlAccesso(ritorno: string, stato: string, silenzioso?: string) {
  const p = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    redirect_uri: ritorno,
    response_type: 'code',
    scope: AMBITI.join(' '),
    ...(silenzioso ? { prompt: 'none', login_hint: silenzioso } : { prompt: 'select_account' }),
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

type Persona = { email: string; nome: string; foto?: string };
type Esito = { sessione?: Sessione; errore?: string; altrove?: string; persona?: Persona };

// Che cosa apre l'Amministrazione a questa persona, dai suoi gruppi
async function decidi(persona: Persona): Promise<Esito> {
  const { dominio, gruppo } = coro.amministrazione!;
  if (!persona.email.toLowerCase().endsWith(`@${dominio}`)) return { errore: `Si entra solo con un account @${dominio}.` };
  const suoi = await gruppiDalServizio(persona.email);
  const redattore = suoi.has(gruppo.toLowerCase());
  const demo = !redattore && Boolean(coro.amministrazione!.demo && suoi.has(coro.amministrazione!.demo.toLowerCase()));
  const direzione = coro.coristi?.direzione?.toLowerCase();
  const tesoreria = (coro.coristi?.tesoreria?.gruppi ?? []).map((g) => g.toLowerCase());
  const sessione = (extra: Partial<Sessione>): Sessione => ({ email: persona.email, nome: persona.nome, foto: persona.foto ?? '', scade: Date.now() + DURATA, ...extra });
  if (demo) return { sessione: sessione({ redattore: true, demo: true }) };
  if (!redattore && direzione && suoi.has(direzione)) return { altrove: '/maestro', persona };
  if (!redattore && tesoreria.some((g) => suoi.has(g))) return { altrove: '/tesoriere', persona };
  if (!redattore) return { errore: `L’account ${persona.email} non fa parte del gruppo ${gruppo}.` };
  return { sessione: sessione({ redattore }) };
}

// Dopo il ritorno da Google: chi è, e se è un amministratore
export async function completaAccesso(codice: string, ritorno: string): Promise<Esito> {
  const t = await token({ code: codice, redirect_uri: ritorno, grant_type: 'authorization_code' });
  const io = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${t.access_token}` } })).json();
  const { dominio } = coro.amministrazione!;
  if (!io.email_verified || io.hd !== dominio) return { errore: `Si entra solo con un account @${dominio}.` };
  return decidi({ email: io.email, nome: io.given_name ?? io.name ?? io.email, foto: io.picture ?? '' });
}

// La sessione dell'Amministrazione per chi ha già quella delle aree (stessa persona, già
// riconosciuta): undefined se l'Amministrazione non è sua
export async function sessioneDalleAree(c: Corista): Promise<Sessione | undefined> {
  if (!coro.amministrazione) return undefined;
  try {
    return (await decidi({ email: c.email, nome: c.nome.split(' ')[0] || c.nome, foto: c.foto })).sessione;
  } catch {
    return undefined;
  }
}

// I gruppi che contano per l'accesso, controllati con l'account di servizio (ruolo «Lettore gruppi»)
async function gruppiDalServizio(email: string) {
  const c = coro.coristi;
  const gruppi = [coro.amministrazione!.gruppo, coro.amministrazione!.demo, c?.direzione, ...(c?.tesoreria?.gruppi ?? [])]
    .filter((g): g is string => Boolean(g)).map((g) => g.toLowerCase());
  const unici = [...new Set(gruppi)];
  const esiti = await Promise.all(unici.map((g) => nelGruppo(email, g).catch(() => false)));
  return new Set(unici.filter((_, i) => esiti[i]));
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
export const conFoto = async (s: Sessione): Promise<Sessione> => ({ ...s, foto: s.accesso ? await fotoDi(s.accesso) : '' });

// Sessione ancora valida (per quelle di prima del 7/10/2026: token rinnovato); undefined se è scaduta
export async function tokenValido(s: Sessione): Promise<Sessione | undefined> {
  if (Date.now() < s.scade) return s;
  if (!s.rinnovo) return undefined;
  try {
    await token({ refresh_token: s.rinnovo, grant_type: 'refresh_token' });
    return { ...s, accesso: undefined, rinnovo: undefined, scade: Date.now() + DURATA };
  } catch {
    return undefined;
  }
}
