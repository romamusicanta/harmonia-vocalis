// Chi fa parte del coro, e i dati dell'area (foglio "Coristi e assenze", calendari Prove e Concerti,
// vedi dati.ts): li chiede a Google l'account di servizio del sito (sito-harmonia-vocalis),
// che ha il ruolo di amministratore "Lettore gruppi" in Workspace. Niente chiavi: la funzione si
// presenta con il suo token OIDC di Vercel, che la federazione delle identità del progetto Google
// Cloud scambia con un accesso temporaneo dell'account di servizio (come la build per Drive, vedi
// scripts/scarica-allegati.mjs). In locale il token OIDC viene da `vercel env pull .env.local`.
import { getVercelOidcToken } from '@vercel/oidc';
import { GCP_PROJECT_NUMBER, GCP_SERVICE_ACCOUNT_EMAIL, GCP_WORKLOAD_IDENTITY_POOL_ID, GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID } from 'astro:env/server';

// Gruppi (chi entra), foglio "Coristi e assenze" (lettura e scrittura), calendari Prove e Concerti,
// Drive (spartiti del repertorio, nella cartella Spartiti dove l'account è Gestore contenuti)
const AMBITI = [
  'https://www.googleapis.com/auth/cloud-identity.groups.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive',
];
const CI = 'https://cloudidentity.googleapis.com/v1';

// Il token dell'account di servizio dura un'ora: si tiene finché vale
let inCache: { token: string; scade: number } | undefined;

export async function tokenServizio() {
  if (inCache && Date.now() < inCache.scade) return inCache.token;
  if (!GCP_PROJECT_NUMBER || !GCP_SERVICE_ACCOUNT_EMAIL) throw new Error('mancano le variabili GCP_* sul server');
  const sts = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      audience: `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectToken: await getVercelOidcToken(),
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
    }),
  });
  if (!sts.ok) throw new Error(`scambio del token OIDC rifiutato (${sts.status})`);
  const { access_token: federato } = await sts.json();
  const sa = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${federato}` },
    body: JSON.stringify({ scope: AMBITI, lifetime: '3600s' }),
  });
  if (!sa.ok) throw new Error(`accesso all'account di servizio rifiutato (${sa.status})`);
  const { accessToken } = await sa.json();
  inCache = { token: accessToken, scade: Date.now() + 55 * 60 * 1000 };
  return accessToken as string;
}

// Una chiamata alle API di Google a nome dell'account di servizio
export async function google<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await tokenServizio()}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (!r.ok) throw new Error(`Google (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
const ci = google;

// Il nome del gruppo per le API (groups/…), cercato una volta dall'indirizzo
const nomiGruppi = new Map<string, string>();
// Gli indirizzi dei membri, anche attraverso gruppi contenuti, letti al più ogni 5 minuti
const membri = new Map<string, { indirizzi: Set<string>; letti: number }>();
const DURATA_ELENCO = 5 * 60 * 1000;

// Gli indirizzi Gmail valgono anche con i punti spostati e in maiuscolo: mario.rossi@gmail.com e
// MarioRossi@gmail.com sono lo stesso account
export function normalizza(email: string) {
  const [utente, dominio] = email.toLowerCase().split('@');
  return ['gmail.com', 'googlemail.com'].includes(dominio) ? `${utente.replace(/\./g, '')}@gmail.com` : `${utente}@${dominio}`;
}

interface Pagina { memberships?: { preferredMemberKey?: { id: string }[] }[]; nextPageToken?: string }

// true se l'indirizzo fa parte del gruppo. Si legge l'elenco intero: il controllo del singolo
// indirizzo (checkTransitiveMembership, memberships:lookup) per chi non è membro risponde con un
// errore di permesso invece che con un no, e non si distinguerebbe da un guasto
export async function nelGruppo(email: string, gruppo: string): Promise<boolean> {
  let elenco = membri.get(gruppo);
  if (!elenco || Date.now() - elenco.letti > DURATA_ELENCO) {
    let nome = nomiGruppi.get(gruppo);
    if (!nome) {
      ({ name: nome } = await ci<{ name: string }>(`${CI}/groups:lookup?${new URLSearchParams({ 'groupKey.id': gruppo })}`));
      nomiGruppi.set(gruppo, nome);
    }
    const indirizzi = new Set<string>();
    let pagina: string | undefined;
    do {
      const p = new URLSearchParams({ pageSize: '1000', ...(pagina ? { pageToken: pagina } : {}) });
      const r = await ci<Pagina>(`${CI}/${nome}/memberships:searchTransitiveMemberships?${p}`);
      for (const m of r.memberships ?? []) for (const k of m.preferredMemberKey ?? []) indirizzi.add(normalizza(k.id));
      pagina = r.nextPageToken;
    } while (pagina);
    elenco = { indirizzi, letti: Date.now() };
    membri.set(gruppo, elenco);
  }
  return elenco.indirizzi.has(normalizza(email));
}
