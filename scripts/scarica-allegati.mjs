// Prima della build: scarica da Google Drive
// - le immagini allegate agli eventi del calendario "Concerti" (locandine e foto, allegate con la
//   graffetta) in coro/immagini/drive/<id>.<ext>: src/motore/concerti.ts le collega ai concerti;
// - le foto del sito dalla cartella Sito/Foto del Drive condiviso (DRIVE_CARTELLA_FOTO), con i nomi
//   fissi apertura, coro, prove, maestro, accesso (.jpg, .png…), in coro/immagini/drive/sito/:
//   src/motore/coro.ts le usa al posto di quelle di coro.config.ts;
// - le foto dei concerti caricate dai coristi che i redattori hanno messo nel sito pubblico
//   (cartella Foto dei concerti, DRIVE_CARTELLA_FOTO_CONCERTI, una sottocartella per concerto, proprietà
//   visibilita = pubblica, vedi src/area/fotoConcerti.ts) in coro/immagini/drive/concerti/<data>/<id>.jpg:
//   la pagina del concerto di quella data le mostra. Quelle non più pubbliche si cancellano.
// Astro poi le ottimizza come le altre foto.
//
// Nessuna chiave: su Vercel la build si presenta a Google con il suo token OIDC
// (VERCEL_OIDC_TOKEN), che la federazione delle identità del progetto Google Cloud
// harmonia-vocalis-510406 scambia con un accesso temporaneo dell'account di servizio
// sito-harmonia-vocalis, lettore delle cartelle Concerti e Sito del Drive condiviso.
// In locale il token si scarica con `vercel env pull .env.local` (dura qualche ora).
//
// Non blocca mai la build: se qualcosa manca o non risponde lo scrive con [drive] e il sito
// usa la locandina generata.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import ical from 'node-ical';

const cartella = new URL('../coro/immagini/drive/', import.meta.url);
const cartellaSito = new URL('sito/', cartella);
const cartellaConcerti = new URL('concerti/', cartella);
const nomiFotoSito = ['apertura', 'coro', 'prove', 'maestro', 'accesso'];
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

async function scarica(token, id, nome, destinazione) {
  const risposta = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!risposta.ok) {
    avviso(`${nome}: non scaricato (${risposta.status}); è nelle cartelle Concerti o Sito del Drive condiviso?`);
    return;
  }
  writeFileSync(destinazione, Buffer.from(await risposta.arrayBuffer()));
  console.log(`[drive] ${nome} → ${destinazione.pathname.replace(/.*\/coro\//, 'coro/')}`);
}

// Allegati: un file allegato non cambia (cambia l'ID se lo si sostituisce), quindi si scarica una volta
async function allegatiCalendario(token) {
  const ics = process.env.CALENDARIO_CONCERTI_ICS;
  if (!ics) return;
  const eventi = Object.values(await ical.async.fromURL(ics)).filter((c) => c?.type === 'VEVENT' && c.status !== 'CANCELLED');
  const daScaricare = eventi.flatMap(allegati).filter((a) => !existsSync(new URL(a.file, cartella)));
  if (daScaricare.length) mkdirSync(cartella, { recursive: true });
  for (const a of daScaricare) await scarica(token, a.id, a.nome, new URL(a.file, cartella));
}

// Foto del sito: si possono sostituire tenendo lo stesso nome, quindi si riscaricano sempre
async function fotoSito(token) {
  const id = process.env.DRIVE_CARTELLA_FOTO;
  if (!id) return;
  const parametri = new URLSearchParams({ q: `'${id}' in parents and trashed = false`, fields: 'files(id,name,mimeType)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', pageSize: '100' });
  const risposta = await fetch(`https://www.googleapis.com/drive/v3/files?${parametri}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!risposta.ok) throw new Error(`cartella Sito/Foto non leggibile (${risposta.status})`);
  rmSync(cartellaSito, { recursive: true, force: true });
  mkdirSync(cartellaSito, { recursive: true });
  for (const f of (await risposta.json()).files) {
    const nome = f.name.replace(/\.[^.]+$/, '').trim().toLowerCase();
    if (!nomiFotoSito.includes(nome)) continue;
    if (!estensioni[f.mimeType]) {
      avviso(`Sito/Foto/${f.name}: solo immagini JPEG, PNG, WebP o AVIF`);
      continue;
    }
    await scarica(token, f.id, `Sito/Foto/${f.name}`, new URL(`${nome}.${estensioni[f.mimeType]}`, cartellaSito));
  }
}

// Foto dei concerti pubbliche: una foto non cambia (si scarica una volta); si tolgono quelle che non
// sono più pubbliche
async function fotoConcerti(token) {
  const radice = process.env.DRIVE_CARTELLA_FOTO_CONCERTI;
  if (!radice) return;
  const elenco = async (q, campi) => {
    const p = new URLSearchParams({ q, fields: `files(${campi})`, supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', pageSize: '1000' });
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?${p}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`cartella Foto dei concerti non leggibile (${r.status})`);
    return (await r.json()).files;
  };
  const cartelle = await elenco(`'${radice}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`, 'id,name');
  const volute = new Set();
  for (const c of cartelle) {
    const foto = await elenco(`'${c.id}' in parents and trashed = false and appProperties has { key='visibilita' and value='pubblica' }`, 'id,name,mimeType,appProperties');
    for (const f of foto) {
      const data = f.appProperties?.data ?? c.name.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !estensioni[f.mimeType]) continue;
      const dove = new URL(`${data}/`, cartellaConcerti);
      const file = new URL(`${f.id}.${estensioni[f.mimeType]}`, dove);
      volute.add(file.pathname);
      if (existsSync(file)) continue;
      mkdirSync(dove, { recursive: true });
      await scarica(token, f.id, `Foto dei concerti/${c.name}/${f.name}`, file);
    }
  }
  if (!existsSync(cartellaConcerti)) return;
  for (const giorno of readdirSync(cartellaConcerti)) {
    const dove = new URL(`${giorno}/`, cartellaConcerti);
    for (const nome of readdirSync(dove)) if (!volute.has(new URL(nome, dove).pathname)) rmSync(new URL(nome, dove));
    if (!readdirSync(dove).length) rmSync(dove, { recursive: true });
  }
}

async function main() {
  if (!process.env.CALENDARIO_CONCERTI_ICS && !process.env.DRIVE_CARTELLA_FOTO && !process.env.DRIVE_CARTELLA_FOTO_CONCERTI) return;
  const token = await accessoDrive();
  if (!token) return;
  await allegatiCalendario(token).catch((err) => avviso(`allegati: ${err.message ?? err}`));
  await fotoSito(token).catch((err) => avviso(`foto del sito: ${err.message ?? err}`));
  await fotoConcerti(token).catch((err) => avviso(`foto dei concerti: ${err.message ?? err}`));
}

await main().catch((err) => avviso(`${err.message ?? err}`));
