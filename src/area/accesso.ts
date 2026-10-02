// Accesso all'area coristi: si entra con un account Google qualunque (anche personale), purché
// l'indirizzo faccia parte del gruppo dei coristi (coro.coristi.gruppo) o di quello della direzione
// (coro.coristi.direzione: il Maestro e gli amministratori, che hanno la loro area, /maestro). A Google si chiedono solo
// nome ed email, con il client OAuth "Sito - area coristi" del progetto Google Cloud
// harmonia-vocalis-coristi (consenso Esterno: quello dell'area Amministrazione è Interno e
// lascerebbe entrare solo gli account @romamusicanta.org).
// La sessione è un cookie cifrato come quello dell'area Amministrazione, valido per /area e per
// l'area del Maestro (/maestro); ogni giorno si ricontrolla che l'indirizzo sia ancora nei gruppi.
import type { AstroCookies } from 'astro';
import { CORISTI_CLIENT_ID, CORISTI_CLIENT_SECRET } from 'astro:env/server';
import { coro } from '../motore/coro';
import { cifra, decifra } from '../admin/sessione';
import { nelGruppo } from './servizio';

export interface Corista {
  email: string;
  nome: string;
  verificato: number; // quando si è controllato l'ultima volta che è nel gruppo (ms)
  coro?: boolean;      // nel gruppo dei coristi (le sessioni di prima del 3/10/2026 non lo hanno: sì)
  direzione?: boolean; // nel gruppo della direzione
}

export const eCorista = (c: Corista) => c.coro !== false;

// In quali gruppi è l'indirizzo
async function gruppiDi(email: string) {
  const { gruppo, direzione } = coro.coristi!;
  const [inCoro, inDirezione] = await Promise.all([nelGruppo(email, gruppo), direzione ? nelGruppo(email, direzione) : false]);
  return { coro: inCoro, direzione: inDirezione };
}

const NOME = 'hv-coro';
// Il cookie di prima del 3/10/2026, solo sul percorso /area: si legge ancora e si sostituisce
const VECCHIO = 'hv-corista';
const DURATA = 60 * 60 * 24 * 30; // si resta dentro un mese
const RICONTROLLO = 24 * 60 * 60 * 1000;

export const configurato = () => Boolean(CORISTI_CLIENT_ID && CORISTI_CLIENT_SECRET && coro.coristi);

export function urlAccesso(ritorno: string, stato: string) {
  const p = new URLSearchParams({
    client_id: CORISTI_CLIENT_ID!,
    redirect_uri: ritorno,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state: stato,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

// Dopo il ritorno da Google: chi è, e se è nel gruppo dei coristi
export async function completaAccesso(codice: string, ritorno: string): Promise<{ corista?: Corista; errore?: string }> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CORISTI_CLIENT_ID!, client_secret: CORISTI_CLIENT_SECRET!, code: codice, redirect_uri: ritorno, grant_type: 'authorization_code' }),
  });
  if (!r.ok) throw new Error(`Google ha rifiutato il token (${r.status})`);
  const { access_token } = await r.json();
  const io = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${access_token}` } })).json();
  if (!io.email_verified) return { errore: 'L’indirizzo di questo account Google non è verificato.' };
  const gruppi = await gruppiDi(io.email);
  if (!gruppi.coro && !gruppi.direzione) {
    return { errore: `L’indirizzo ${io.email} non è nell’elenco dei coristi. Entra con il tuo account dell’associazione (nome.cognome@${coro.amministrazione?.dominio ?? 'romamusicanta.org'}); se non lo hai, chiedi al direttivo.` };
  }
  return { corista: { email: io.email, nome: io.given_name ?? io.name ?? io.email, verificato: Date.now(), ...gruppi } };
}

const opzioni = (secure: boolean) => ({ httpOnly: true, secure, sameSite: 'lax' as const, path: '/' });

export const leggiCorista = (cookies: AstroCookies) => decifra<Corista>(cookies.get(NOME)?.value ?? cookies.get(VECCHIO)?.value);

export function salvaCorista(cookies: AstroCookies, c: Corista, secure: boolean) {
  cookies.set(NOME, cifra(c), { ...opzioni(secure), maxAge: DURATA });
  if (cookies.has(VECCHIO)) cookies.delete(VECCHIO, { path: '/area' });
}

export function chiudiCorista(cookies: AstroCookies) {
  cookies.delete(NOME, { path: '/' });
  cookies.delete(VECCHIO, { path: '/area' });
}

// Il corista della sessione, ricontrollato nel gruppo se è passato un giorno; undefined se non
// è più nel gruppo. Se Google non risponde, per non chiudere fuori nessuno vale l'ultimo controllo.
export async function coristaValido(c: Corista): Promise<Corista | undefined> {
  // Le sessioni di prima del gruppo della direzione (senza il campo) si ricontrollano subito
  if (Date.now() - c.verificato < RICONTROLLO && c.direzione !== undefined) return c;
  try {
    const gruppi = await gruppiDi(c.email);
    return gruppi.coro || gruppi.direzione ? { ...c, verificato: Date.now(), ...gruppi } : undefined;
  } catch {
    return c;
  }
}
