// Accesso con un codice via email (dal 7/10/2026): su Android l'accesso con Google si blocca spesso,
// perché Chrome propone solo l'account con cui è attivato (di solito il Gmail personale) e "Usa un
// altro account" prova ad aggiungere al telefono un account che c'è già (il caso di Graziella del
// 7/10/2026). Con il codice non serve nessun account Google sul telefono.
// Chi scrive il suo indirizzo (personale, dell'associazione o solo nome.cognome) riceve un codice di
// 6 cifre, valido 10 minuti, al più 5 tentativi:
// - coristi (scheda Coristi del foglio "Coristi e assenze"): all'email personale della loro riga, se
//   l'indirizzo dell'associazione di quella riga è in uno dei gruppi delle aree (coro@…);
// - chi non ha una riga ma è direttamente in un gruppo delle aree (il Maestro con il suo Gmail in
//   maestro@): all'indirizzo con cui è nel gruppo.
// La sessione è sempre a nome dell'indirizzo dell'associazione (o di quello del gruppo), come con
// Google, e apre tutte le aree della persona, Amministrazione compresa (src/pages/area/codice.ts).
// Il codice sta, cifrato e come impronta, in un cookie: niente database. La risposta alla richiesta è
// sempre la stessa, perché nessuno scopra chi è nel coro provando indirizzi.
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { coro } from '../motore/coro';
import { cifra, decifra } from '../admin/sessione';
import { almenoUno, gruppiDi, type Corista } from './accesso';
import { coristiVeri } from './dati';
import { normalizza } from './servizio';
import { postaConfigurata, spedisci } from './posta';

const COOKIE = 'hv-codice';
const VALIDITA = 10 * 60 * 1000;
const TENTATIVI = 5;

interface Attesa { email: string; nome: string; destinatario: string; impronta: string; scade: number; tentativi: number }

export const codiceConfigurato = () => Boolean(coro.coristi && postaConfigurata());

const impronta = (codice: string, email: string) => createHash('sha256').update(`${codice}|${email}`).digest('hex');

// L'indirizzo scritto: senza @ è nome.cognome dell'associazione
export function indirizzo(testo: string) {
  const t = testo.trim().toLowerCase().replace(/\s+/g, '');
  return t.includes('@') ? t : `${t}@${coro.amministrazione?.dominio ?? 'romamusicanta.org'}`;
}

// Chi è, a chi va il codice; undefined se non può entrare
async function chiChiede(testo: string) {
  const scritto = normalizza(indirizzo(testo));
  const righe = (await coristiVeri()).filter((c) => c.email === scritto || (c.emailPersonale && normalizza(c.emailPersonale) === scritto));
  // Chi è uscito dal coro e ha ancora la riga (con la data di fine) viene dopo chi c'è
  const riga = righe.find((c) => !c.al) ?? righe[0];
  const email = riga?.email ?? indirizzo(testo);
  const gruppi = await gruppiDi(email);
  if (!almenoUno(gruppi)) return undefined;
  return {
    email,
    nome: riga ? `${riga.nome} ${riga.cognome}` : email.split('@')[0],
    destinatario: riga ? riga.emailPersonale?.trim() || riga.email : email,
  };
}

// Al più una richiesta ogni 30 secondi e 6 all'ora per persona (per istanza della funzione: basta a
// non riempire di email la casella di qualcuno)
const richieste = new Map<string, number[]>();
function troppe(email: string) {
  const ora = Date.now();
  const recenti = (richieste.get(email) ?? []).filter((t) => ora - t < 60 * 60 * 1000);
  if (recenti.length >= 6 || (recenti.length && ora - recenti[recenti.length - 1] < 30 * 1000)) return true;
  richieste.set(email, [...recenti, ora]);
  return false;
}

// Manda il codice (se l'indirizzo può entrare); errore solo per i guasti
export async function chiediCodice(testo: string, cookies: AstroCookies, secure: boolean) {
  const chi = await chiChiede(testo);
  if (!chi || troppe(chi.email)) return;
  const codice = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const attesa: Attesa = { ...chi, impronta: impronta(codice, chi.email), scade: Date.now() + VALIDITA, tentativi: 0 };
  // Se la spedizione non riesce, la richiesta non conta per il limite
  const annulla = () => richieste.set(chi.email, (richieste.get(chi.email) ?? []).slice(0, -1));
  await spedisci(
    chi.destinatario,
    `${codice} è il tuo codice per l'area riservata`,
    `Ciao ${chi.nome.split(' ')[0]},\n\n` +
      `ecco il codice per entrare nell'area riservata del ${coro.nome}:\n\n` +
      `    ${codice}\n\n` +
      `Scrivilo nella pagina di accesso: vale 10 minuti.\n\n` +
      `Se non l'hai chiesto tu, ignora questa email: senza il codice nessuno può entrare.\n\n` +
      `Il sito del ${coro.nome}\nhttps://romamusicanta.org\n`,
  ).catch((e) => { annulla(); throw e; });
  cookies.set(COOKIE, cifra(attesa), { httpOnly: true, secure, sameSite: 'lax', path: '/area', maxAge: VALIDITA / 1000 });
}

// Controlla il codice: la persona se è giusto (con i suoi gruppi di adesso), altrimenti l'errore
export async function verificaCodice(codice: string, cookies: AstroCookies, secure: boolean): Promise<{ corista?: Corista; destinatario?: string; errore?: string }> {
  const attesa = decifra<Attesa>(cookies.get(COOKIE)?.value);
  if (!attesa || Date.now() > attesa.scade) return { errore: 'Il codice è scaduto: chiedine uno nuovo.' };
  if (attesa.tentativi >= TENTATIVI) {
    cookies.delete(COOKIE, { path: '/area' });
    return { errore: 'Troppi tentativi: chiedi un codice nuovo.' };
  }
  const giusto = Buffer.from(attesa.impronta, 'hex');
  const scritto = Buffer.from(impronta(codice.replace(/\D/g, ''), attesa.email), 'hex');
  if (!timingSafeEqual(giusto, scritto)) {
    cookies.set(COOKIE, cifra({ ...attesa, tentativi: attesa.tentativi + 1 }), { httpOnly: true, secure, sameSite: 'lax', path: '/area', maxAge: Math.max(1, Math.round((attesa.scade - Date.now()) / 1000)) });
    const restano = TENTATIVI - attesa.tentativi - 1;
    return { errore: restano > 0 ? `Il codice non è giusto: controllalo e riprova (${restano === 1 ? 'ancora un tentativo' : `ancora ${restano} tentativi`}).` : 'Il codice non è giusto: chiedine uno nuovo.' };
  }
  cookies.delete(COOKIE, { path: '/area' });
  const gruppi = await gruppiDi(attesa.email);
  if (!almenoUno(gruppi)) return { errore: 'Il tuo indirizzo non è più nell’elenco: chiedi al direttivo.' };
  return { corista: { email: attesa.email, nome: attesa.nome.split(' ')[0], foto: '', verificato: Date.now(), ...gruppi }, destinatario: attesa.destinatario };
}

// Avviso all'indirizzo dell'associazione quando qualcuno entra nell'Amministrazione con il codice
// mandato altrove (all'email personale): se quella casella fosse violata, il redattore se ne accorge
export async function avvisaAccessoAmministrazione(c: Corista, destinatario: string, dispositivo: string) {
  if (normalizza(destinatario) === normalizza(c.email)) return;
  const quando = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'long', timeStyle: 'short' });
  const nascosto = destinatario.replace(/^(.)[^@]*(@.*)$/, '$1•••$2');
  await spedisci(
    c.email,
    'Nuovo accesso all’Amministrazione del sito',
    `Ciao ${c.nome},\n\n` +
      `il ${quando} qualcuno è entrato nell'Amministrazione del sito del ${coro.nome} con il tuo account, ` +
      `usando il codice mandato a ${nascosto}, da ${dispositivo}.\n\n` +
      `Se l'accesso è tuo, non devi fare niente.\n` +
      `Se l'accesso non è tuo, scrivi subito a ${coro.coristi?.amministratori ?? coro.email}.\n\n` +
      `Il sito del ${coro.nome}\nhttps://romamusicanta.org/admin\n`,
  );
}

// Il dispositivo, in due parole, dall'intestazione del browser
export function dispositivoDa(ua: string) {
  if (/iPhone/.test(ua)) return 'un iPhone';
  if (/iPad|Macintosh.*Mobile/.test(ua)) return 'un iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'un telefono Android' : 'un tablet Android';
  if (/Macintosh/.test(ua)) return 'un Mac';
  if (/Windows/.test(ua)) return 'un computer Windows';
  return 'un computer';
}
