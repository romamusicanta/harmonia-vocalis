// Sessione dell'area Amministrazione: un cookie cifrato (AES-256-GCM, chiave da SESSIONE_SEGRETO)
// con chi è entrato e il suo token di Google, che serve per scrivere nel calendario e su Drive a
// suo nome. Niente database: il cookie è tutto quello che serve.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { SESSIONE_SEGRETO } from 'astro:env/server';

export interface Sessione {
  email: string;
  nome: string;
  foto?: string; // foto dell'account Google ('' se non c'è)
  accesso: string; // token di accesso di Google
  rinnovo?: string; // token per rinnovarlo, se Google l'ha dato
  scade: number; // scadenza del token di accesso (ms)
  redattore?: boolean; // false = entra solo per gli avvisi (presidente, tesoriere); mancante = redattore (sessioni di prima)
}

const NOME = 'hv-admin';
const DURATA = 60 * 60 * 12; // la sessione dura al massimo 12 ore

function chiave() {
  if (!SESSIONE_SEGRETO) throw new Error('SESSIONE_SEGRETO non impostata');
  return createHash('sha256').update(SESSIONE_SEGRETO).digest();
}

export function cifra(dati: unknown) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chiave(), iv);
  const corpo = Buffer.concat([c.update(JSON.stringify(dati), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), corpo]).toString('base64url');
}

export function decifra<T>(testo: string | undefined): T | undefined {
  if (!testo) return undefined;
  try {
    const b = Buffer.from(testo, 'base64url');
    const d = createDecipheriv('aes-256-gcm', chiave(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')) as T;
  } catch {
    return undefined;
  }
}

const opzioni = (secure: boolean) => ({ httpOnly: true, secure, sameSite: 'lax' as const, path: '/admin' });

export const leggiSessione = (cookies: AstroCookies) => decifra<Sessione>(cookies.get(NOME)?.value);

export function salvaSessione(cookies: AstroCookies, s: Sessione, secure: boolean) {
  cookies.set(NOME, cifra(s), { ...opzioni(secure), maxAge: DURATA });
}

export const chiudiSessione = (cookies: AstroCookies) => cookies.delete(NOME, { path: '/admin' });
