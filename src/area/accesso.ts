// Accesso all'area coristi: si entra con un account Google qualunque (anche personale), purché
// l'indirizzo faccia parte del gruppo dei coristi (coro.coristi.gruppo) o di quello della direzione
// (coro.coristi.direzione: il Maestro, che ha la sua area, /maestro), di quelli
// del tesoriere (coro.coristi.tesoreria.gruppi, area /tesoriere), degli amministratori del sito
// (coro.coristi.amministratori: aprono tutte le aree) o dei redattori (coro.amministrazione.gruppo:
// con questa sessione aprono l'area redattori, /admin, senza passare da Google). Dall'8/10/2026 ogni area
// si apre solo al suo gruppo; amministratori e gruppo Demo (coro.amministrazione.demo) le aprono tutte, il
// gruppo Demo sempre in sola lettura e con i dati personali nascosti (src/area/demo.ts). A Google si chiedono solo
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
  foto?: string; // foto dell'account Google (le sessioni di prima del 3/10/2026 non la hanno)
  verificato: number; // quando si è controllato l'ultima volta che è nel gruppo (ms)
  coro?: boolean;      // nel gruppo dei coristi (le sessioni di prima del 3/10/2026 non lo hanno: sì)
  direzione?: boolean; // nel gruppo della direzione
  tesoreria?: boolean; // in uno dei gruppi dell'area del tesoriere (coro.coristi.tesoreria.gruppi; le sessioni di prima del 5/10/2026 non lo hanno)
  amministratore?: boolean; // nel gruppo degli amministratori del sito (coro.coristi.amministratori): vede tutte le aree
  demo?: boolean; // nel gruppo Demo: tutte le aree in sola lettura, con i dati personali nascosti
  redattore?: boolean; // nel gruppo dei redattori (coro.amministrazione.gruppo): vede l'area del tesoriere in sola lettura (dal 7/10/2026)
}

export const eCorista = (c: Corista) => c.coro !== false;
// Chi apre quale area (dall'8/10/2026): ognuna solo il suo gruppo, più gli amministratori del sito e il
// gruppo Demo, che le aprono tutte (il gruppo Demo in sola lettura: lo blocca il middleware)
export const apreArea = (c: Corista) => Boolean(eCorista(c) || c.amministratore || c.demo);
export const apreMaestro = (c: Corista) => Boolean(c.direzione || c.amministratore || c.demo);
export const apreTesoriere = (c: Corista) => Boolean(c.tesoreria || c.amministratore || c.demo);
export const apreRedattori = (c: Corista) => Boolean(c.redattore || c.amministratore || c.demo);
// Nell'area del tesoriere scrive (quote, cassa, maestri, avvisi, sollecito) solo chi è nei gruppi della
// tesoreria: gli amministratori la vedono in sola lettura
export const scriveTesoriere = (c: Corista) => Boolean(c.tesoreria);
// La prima area di chi entra: coristi, Maestro, tesoriere, redattori, in quest'ordine
export const areaDi = (c: Corista) => (eCorista(c) || c.demo ? '/area' : c.direzione ? '/maestro' : c.tesoreria ? '/tesoriere' : c.redattore ? '/admin' : '/area');
export const almenoUno = (g: { coro: boolean; direzione: boolean; tesoreria: boolean; amministratore: boolean; redattore: boolean; demo: boolean }) =>
  g.coro || g.direzione || g.tesoreria || g.amministratore || g.redattore || g.demo;

// In quali gruppi è l'indirizzo
export async function gruppiDi(email: string) {
  const { gruppo, direzione, tesoreria, amministratori } = coro.coristi!;
  const redattori = coro.amministrazione?.gruppo;
  const demo = coro.amministrazione?.demo;
  const [inCoro, inDirezione, inTesoreria, inAmministratori, inRedattori, inDemo] = await Promise.all([
    nelGruppo(email, gruppo),
    direzione ? nelGruppo(email, direzione) : false,
    Promise.all((tesoreria?.gruppi ?? []).map((g) => nelGruppo(email, g).catch(() => false))).then((x) => x.some(Boolean)),
    amministratori ? nelGruppo(email, amministratori).catch(() => false) : false,
    redattori ? nelGruppo(email, redattori).catch(() => false) : false,
    demo ? nelGruppo(email, demo).catch(() => false) : false,
  ]);
  // Chi ha un ruolo vero non è mai in demo
  const soloDemo = inDemo && !inCoro && !inDirezione && !inTesoreria && !inAmministratori && !inRedattori;
  return { coro: inCoro, direzione: inDirezione, tesoreria: inTesoreria, amministratore: inAmministratori, redattore: inRedattori, demo: soloDemo };
}

const NOME = 'hv-coro';
// Il cookie di prima del 3/10/2026, solo sul percorso /area: si legge ancora e si sostituisce
const VECCHIO = 'hv-corista';
// si resta dentro sei mesi (dal 7/10/2026, prima uno: con il codice via email rientrare è facile, ma
// non serve chiederlo spesso; ogni giorno si ricontrollano comunque i gruppi)
const DURATA = 60 * 60 * 24 * 182;
const RICONTROLLO = 24 * 60 * 60 * 1000;

export const configurato = () => Boolean(CORISTI_CLIENT_ID && CORISTI_CLIENT_SECRET && coro.coristi);

// Con silenzioso Google non mostra niente: se l'account (l'email, se c'è) è ancora collegato nel
// browser torna subito con il codice, altrimenti con un errore (serve a prendere la foto per le
// sessioni che non l'hanno e, dal 7/10/2026, a rientrare senza passare dalla pagina di accesso)
export function urlAccesso(ritorno: string, stato: string, silenzioso?: string | true) {
  const p = new URLSearchParams({
    client_id: CORISTI_CLIENT_ID!,
    redirect_uri: ritorno,
    response_type: 'code',
    scope: 'openid email profile',
    ...(silenzioso ? { prompt: 'none', ...(silenzioso !== true && { login_hint: silenzioso }) } : { prompt: 'select_account' }),
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
  if (!almenoUno(gruppi)) {
    return { errore: `L’indirizzo ${io.email} non è nell’elenco dei coristi. Entra con il tuo account dell’associazione (nome.cognome@${coro.amministrazione?.dominio ?? 'romamusicanta.org'}); se non lo hai, chiedi al direttivo.` };
  }
  return { corista: { email: io.email, nome: io.given_name ?? io.name ?? io.email, foto: io.picture ?? '', verificato: Date.now(), ...gruppi } };
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

// Accesso senza domande (dal 7/10/2026): l'account con cui si è entrati l'ultima volta (in una
// qualunque area, Amministrazione compresa) resta in un cookie per un anno. Quando una sessione manca
// o è scaduta, Amministrazione e aree lo usano per chiedere a Google in silenzio (prompt=none): se
// l'account è ancora collegato nel browser si rientra senza vedere niente, altrimenti si va alla
// pagina di accesso come prima. Dopo "Esci" (in qualunque area: si esce da tutte) non si rientra in
// silenzio finché non si accede di nuovo con il pulsante.
const ACCOUNT = 'hv-account';
const USCITO = 'hv-uscito';

export function ricordaAccount(cookies: AstroCookies, email: string, secure: boolean) {
  cookies.set(ACCOUNT, cifra({ email }), { ...opzioni(secure), maxAge: 60 * 60 * 24 * 365 });
  if (cookies.has(USCITO)) cookies.delete(USCITO, { path: '/' });
}

export const accountRicordato = (cookies: AstroCookies) => decifra<{ email: string }>(cookies.get(ACCOUNT)?.value)?.email;

export const segnaUscita = (cookies: AstroCookies, secure: boolean) => cookies.set(USCITO, '1', opzioni(secure));

// Si può provare a rientrare in silenzio: non dopo "Esci", e solo aprendo una pagina (non per i moduli
// o le richieste degli script, che Google non può far passare dalla sua pagina)
export const rientroSilenzioso = (cookies: AstroCookies, richiesta: Request) =>
  !cookies.has(USCITO) && richiesta.method === 'GET' && richiesta.headers.get('sec-fetch-mode') === 'navigate';

// Il corista della sessione, ricontrollato nel gruppo se è passato un giorno; undefined se non
// è più nel gruppo. Se Google non risponde, per non chiudere fuori nessuno vale l'ultimo controllo.
export async function coristaValido(c: Corista): Promise<Corista | undefined> {
  // Le sessioni di prima del gruppo della direzione, della tesoreria o dei redattori (senza il campo) si ricontrollano subito
  if (Date.now() - c.verificato < RICONTROLLO && c.direzione !== undefined && c.tesoreria !== undefined && c.amministratore !== undefined && c.redattore !== undefined && c.demo !== undefined) return c;
  try {
    const gruppi = await gruppiDi(c.email);
    return almenoUno(gruppi) ? { ...c, verificato: Date.now(), ...gruppi } : undefined;
  } catch {
    return c;
  }
}

// Un solo accesso (dal 5/10/2026): chi entra nell'Amministrazione con Google apre anche la sessione
// delle altre aree (coristi, Maestro, tesoriere) a cui ha diritto, senza un secondo passaggio da Google.
// Non vale il contrario: l'Amministrazione chiede a Google i permessi su calendario e Drive.
export async function apriSessioneAree(cookies: AstroCookies, p: { email: string; nome: string; foto?: string }, secure: boolean) {
  if (!configurato()) return;
  const gruppi = await gruppiDi(p.email).catch(() => undefined);
  if (!gruppi || !almenoUno(gruppi)) return;
  salvaCorista(cookies, { email: p.email, nome: p.nome, foto: p.foto ?? '', verificato: Date.now(), ...gruppi }, secure);
}
