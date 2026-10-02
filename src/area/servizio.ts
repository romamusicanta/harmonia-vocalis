// Chi fa parte del coro: lo chiede a Google l'account di servizio del sito (sito-harmonia-vocalis),
// che ha il ruolo di amministratore "Lettore gruppi" in Workspace. Niente chiavi: la funzione si
// presenta con il suo token OIDC di Vercel, che la federazione delle identità del progetto Google
// Cloud scambia con un accesso temporaneo dell'account di servizio (come la build per Drive, vedi
// scripts/scarica-allegati.mjs). In locale il token OIDC viene da `vercel env pull .env.local`.
import { getVercelOidcToken } from '@vercel/oidc';
import { GCP_PROJECT_NUMBER, GCP_SERVICE_ACCOUNT_EMAIL, GCP_WORKLOAD_IDENTITY_POOL_ID, GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID } from 'astro:env/server';

const AMBITO = 'https://www.googleapis.com/auth/cloud-identity.groups.readonly';
const CI = 'https://cloudidentity.googleapis.com/v1';

// Il token dell'account di servizio dura un'ora: si tiene finché vale
let inCache: { token: string; scade: number } | undefined;

async function tokenServizio() {
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
    body: JSON.stringify({ scope: [AMBITO], lifetime: '3600s' }),
  });
  if (!sa.ok) throw new Error(`accesso all'account di servizio rifiutato (${sa.status})`);
  const { accessToken } = await sa.json();
  inCache = { token: accessToken, scade: Date.now() + 55 * 60 * 1000 };
  return accessToken as string;
}

async function ci<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${await tokenServizio()}` } });
  if (!r.ok) throw new Error(`Google (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Il nome del gruppo per le API (groups/…), cercato una volta dall'indirizzo
const nomiGruppi = new Map<string, string>();

// true se l'indirizzo fa parte del gruppo, anche attraverso un gruppo contenuto
export async function nelGruppo(email: string, gruppo: string): Promise<boolean> {
  let nome = nomiGruppi.get(gruppo);
  if (!nome) {
    ({ name: nome } = await ci<{ name: string }>(`${CI}/groups:lookup?${new URLSearchParams({ 'groupKey.id': gruppo })}`));
    nomiGruppi.set(gruppo, nome);
  }
  const query = `member_key_id == '${email.toLowerCase().replace(/'/g, '')}'`;
  const { hasMembership } = await ci<{ hasMembership?: boolean }>(`${CI}/${nome}/memberships:checkTransitiveMembership?${new URLSearchParams({ query })}`);
  return Boolean(hasMembership);
}
