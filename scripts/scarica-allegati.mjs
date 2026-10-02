// Prima della build: scarica da Google Drive le immagini allegate agli eventi del calendario
// "Concerti" (locandine e foto, allegate con la graffetta) in coro/immagini/drive/<id>.<ext>,
// così Astro le ottimizza come le altre foto. src/motore/concerti.ts le collega ai concerti.
//
// Nessuna chiave: su Vercel la build si presenta a Google con il suo token OIDC
// (VERCEL_OIDC_TOKEN), che la federazione delle identità del progetto Google Cloud
// harmonia-vocalis-510406 scambia con un accesso temporaneo dell'account di servizio
// sito-harmonia-vocalis, lettore della cartella Concerti del Drive condiviso.
// In locale il token si scarica con `vercel env pull .env.local` (dura qualche ora).
//
// Non blocca mai la build: se qualcosa manca o non risponde lo scrive con [drive] e il sito
// usa la locandina generata.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import ical from 'node-ical';

const cartella = new URL('../coro/immagini/drive/', import.meta.url);
const estensioni = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const avviso = (m) => console.warn(`[drive] ${m}`);

// Gli allegati di un evento: uno solo è un oggetto, più di uno un array
function allegati(evento) {
  const elenco = [evento.attach ?? []].flat();
  return elenco.flatMap((a) => {
    const url = typeof a === 'string' ? a : a?.val;
    const id = url?.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/)?.[1];
    const tipo = a?.params?.FMTTYPE;
    if (!id) return [];
    if (!estensioni[tipo]) {
      avviso(`${a?.params?.FILENAME ?? id}: solo immagini JPEG, PNG, WebP o AVIF (è ${tipo ?? 'di tipo sconosciuto'})`);
      return [];
    }
    return [{ id, nome: a.params.FILENAME ?? id, file: `${id}.${estensioni[tipo]}` }];
  });
}

async function accessoDrive() {
  const { VERCEL_OIDC_TOKEN, GCP_PROJECT_NUMBER, GCP_SERVICE_ACCOUNT_EMAIL, GCP_WORKLOAD_IDENTITY_POOL_ID, GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID } = process.env;
  if (!VERCEL_OIDC_TOKEN || !GCP_PROJECT_NUMBER || !GCP_SERVICE_ACCOUNT_EMAIL) {
    avviso('credenziali assenti (VERCEL_OIDC_TOKEN e variabili GCP_*): allegati non scaricati');
    return undefined;
  }
  const sts = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      audience: `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectToken: VERCEL_OIDC_TOKEN,
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
    }),
  });
  if (!sts.ok) throw new Error(`scambio del token OIDC rifiutato (${sts.status}): ${await sts.text()}`);
  const { access_token: federato } = await sts.json();
  const sa = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${federato}` },
    body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/drive.readonly'], lifetime: '600s' }),
  });
  if (!sa.ok) throw new Error(`accesso all'account di servizio rifiutato (${sa.status}): ${await sa.text()}`);
  return (await sa.json()).accessToken;
}

async function main() {
  const ics = process.env.CALENDARIO_CONCERTI_ICS;
  if (!ics) return;
  const eventi = Object.values(await ical.async.fromURL(ics)).filter((c) => c?.type === 'VEVENT' && c.status !== 'CANCELLED');
  const daScaricare = eventi.flatMap(allegati).filter((a) => !existsSync(new URL(a.file, cartella)));
  if (!daScaricare.length) return;
  const token = await accessoDrive();
  if (!token) return;
  mkdirSync(cartella, { recursive: true });
  for (const a of daScaricare) {
    const risposta = await fetch(`https://www.googleapis.com/drive/v3/files/${a.id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
    if (!risposta.ok) {
      avviso(`${a.nome}: non scaricato (${risposta.status}); è nella cartella Concerti del Drive condiviso?`);
      continue;
    }
    writeFileSync(new URL(a.file, cartella), Buffer.from(await risposta.arrayBuffer()));
    console.log(`[drive] ${a.nome} → coro/immagini/drive/${a.file}`);
  }
}

await main().catch((err) => avviso(`${err.message ?? err}`));
