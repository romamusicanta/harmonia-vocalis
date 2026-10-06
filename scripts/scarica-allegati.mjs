// Prima della build: scarica da Google Drive
// - le immagini allegate agli eventi del calendario "Concerti" (locandine e foto, allegate con la
//   graffetta) in coro/immagini/drive/<id>.<ext>: src/motore/concerti.ts le collega ai concerti;
// - le foto del sito dalla cartella Sito/Foto del Drive condiviso (DRIVE_CARTELLA_FOTO), con i nomi
//   fissi apertura, coro, prove, maestro, accesso (.jpg, .png…), in coro/immagini/drive/sito/:
//   src/motore/coro.ts le usa al posto di quelle di coro.config.ts;
// - le foto dei concerti caricate dai coristi che i redattori hanno messo nel sito pubblico
//   (cartella Foto dei concerti, DRIVE_CARTELLA_FOTO_CONCERTI, una sottocartella per concerto, proprietà
//   visibilita = pubblica o home, vedi src/area/fotoConcerti.ts) in coro/immagini/drive/concerti/<data>/<id>.jpg:
//   la pagina del concerto di quella data le mostra; l'elenco di quelle scelte per la home (le più belle)
//   va in coro/immagini/drive/concerti/home.json. Quelle non più pubbliche si cancellano.
// - i testi del sito cambiati dall'Amministrazione (file "Testi del sito.json" della cartella Sito,
//   quella che contiene Sito/Foto; vedi src/motore/testiSito.ts) in coro/immagini/drive/testi/testi.json,
//   più i corpi in Markdown in coro/immagini/drive/testi/<nome>.md e en/<nome>.md, con l'intestazione
//   del file di coro/testi.
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
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

// Il calendario "Concerti", unica fonte dei concerti del sito, si legge una volta sola per tutta la
// build e si salva in coro/immagini/drive/concerti.ics (lo legge src/motore/concerti.ts). Se non
// risponde (tre tentativi), su Vercel la pubblicazione si ferma e resta online il sito di prima:
// dal 6/10/2026 non ci sono più concerti di riserva nel codice.
const fileCalendario = new URL('concerti.ics', cartella);
async function copiaCalendario() {
  const ics = process.env.CALENDARIO_CONCERTI_ICS;
  rmSync(fileCalendario, { force: true });
  let errore = 'CALENDARIO_CONCERTI_ICS non impostata';
  for (let i = 0; ics && i < 3; i++) {
    try {
      const r = await fetch(ics);
      const testo = await r.text();
      if (!r.ok || !testo.includes('BEGIN:VCALENDAR')) throw new Error(`HTTP ${r.status}`);
      mkdirSync(cartella, { recursive: true });
      writeFileSync(fileCalendario, testo);
      console.log(`[calendario] ${testo.split('BEGIN:VEVENT').length - 1} eventi → coro/immagini/drive/concerti.ics`);
      return;
    } catch (err) {
      errore = err.message ?? String(err);
      await new Promise((ok) => setTimeout(ok, 3000));
    }
  }
  if (process.env.VERCEL) {
    console.error(`[calendario] non raggiungibile (${errore}): pubblicazione annullata, resta online il sito di prima`);
    process.exit(1);
  }
  console.warn(`[calendario] non raggiungibile (${errore}): il sito avrà zero concerti`);
}

// Allegati: un file allegato non cambia (cambia l'ID se lo si sostituisce), quindi si scarica una volta
async function allegatiCalendario(token) {
  if (!existsSync(fileCalendario)) return;
  const eventi = Object.values(ical.sync.parseFile(fileCalendario.pathname)).filter((c) => c?.type === 'VEVENT' && c.status !== 'CANCELLED');
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
  const home = [];
  for (const c of cartelle) {
    const foto = await elenco(`'${c.id}' in parents and trashed = false and (appProperties has { key='visibilita' and value='pubblica' } or appProperties has { key='visibilita' and value='home' })`, 'id,name,mimeType,appProperties,createdTime');
    for (const f of foto) {
      const data = f.appProperties?.data ?? c.name.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !estensioni[f.mimeType]) continue;
      const dove = new URL(`${data}/`, cartellaConcerti);
      const file = new URL(`${f.id}.${estensioni[f.mimeType]}`, dove);
      volute.add(file.pathname);
      if (f.appProperties?.visibilita === 'home') home.push({ file: `drive/concerti/${data}/${f.id}.${estensioni[f.mimeType]}`, data, caricata: f.createdTime });
      if (existsSync(file)) continue;
      mkdirSync(dove, { recursive: true });
      await scarica(token, f.id, `Foto dei concerti/${c.name}/${f.name}`, file);
    }
  }
  mkdirSync(cartellaConcerti, { recursive: true });
  const elencoHome = new URL('home.json', cartellaConcerti);
  writeFileSync(elencoHome, JSON.stringify(home, null, 2));
  volute.add(elencoHome.pathname);
  for (const giorno of readdirSync(cartellaConcerti)) {
    if (!statSync(new URL(giorno, cartellaConcerti)).isDirectory()) continue;
    const dove = new URL(`${giorno}/`, cartellaConcerti);
    for (const nome of readdirSync(dove)) if (!volute.has(new URL(nome, dove).pathname)) rmSync(new URL(nome, dove));
    if (!readdirSync(dove).length) rmSync(dove, { recursive: true });
  }
}

// Testi del sito: si riscaricano sempre; senza il file, restano quelli del codice
async function testiSito(token) {
  const foto = process.env.DRIVE_CARTELLA_FOTO;
  if (!foto) return;
  const cartellaTesti = new URL('testi/', cartella);
  const intestazione = { Authorization: `Bearer ${token}` };
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${foto}?fields=parents&supportsAllDrives=true`, { headers: intestazione });
  if (!r.ok) throw new Error(`cartella Sito non trovata (${r.status})`);
  const [sito] = (await r.json()).parents ?? [];
  if (!sito) return;
  const p = new URLSearchParams({ q: `'${sito}' in parents and name = 'Testi del sito.json' and trashed = false`, fields: 'files(id)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
  const [file] = (await (await fetch(`https://www.googleapis.com/drive/v3/files?${p}`, { headers: intestazione })).json()).files ?? [];
  rmSync(cartellaTesti, { recursive: true, force: true });
  if (!file) return;
  const d = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`, { headers: intestazione });
  if (!d.ok) throw new Error(`Testi del sito.json non scaricato (${d.status})`);
  const testi = await d.json();
  mkdirSync(new URL('en/', cartellaTesti), { recursive: true });
  writeFileSync(new URL('testi.json', cartellaTesti), JSON.stringify(testi, null, 1));
  // I corpi in Markdown: l'intestazione del file di coro/testi (in inglese quella di coro/testi/en, se c'è) e il corpo salvato
  const testiCoro = new URL('../coro/testi/', import.meta.url);
  const testa = (f) => (existsSync(f) ? readFileSync(f, 'utf8').match(/^---\n[\s\S]*?\n---\n/)?.[0] : undefined) ?? '---\n---\n';
  for (const [id, t] of Object.entries(testi)) {
    const nome = id.match(/^testo:([\w-]+)\.corpo$/)?.[1];
    if (!nome || !existsSync(new URL(`${nome}.md`, testiCoro))) continue;
    writeFileSync(new URL(`${nome}.md`, cartellaTesti), `${testa(new URL(`${nome}.md`, testiCoro))}\n${t.it.trim()}\n`);
    const en = existsSync(new URL(`en/${nome}.md`, testiCoro)) ? new URL(`en/${nome}.md`, testiCoro) : new URL(`${nome}.md`, testiCoro);
    writeFileSync(new URL(`en/${nome}.md`, cartellaTesti), `${testa(en)}\n${(t.en || t.it).trim()}\n`);
  }
  console.log(`[drive] Testi del sito.json: ${Object.keys(testi).length} testi`);
}

async function main() {
  await copiaCalendario();
  if (!process.env.CALENDARIO_CONCERTI_ICS && !process.env.DRIVE_CARTELLA_FOTO && !process.env.DRIVE_CARTELLA_FOTO_CONCERTI) return;
  const token = await accessoDrive();
  if (!token) return;
  await allegatiCalendario(token).catch((err) => avviso(`allegati: ${err.message ?? err}`));
  await fotoSito(token).catch((err) => avviso(`foto del sito: ${err.message ?? err}`));
  await fotoConcerti(token).catch((err) => avviso(`foto dei concerti: ${err.message ?? err}`));
  await testiSito(token).catch((err) => avviso(`testi del sito: ${err.message ?? err}`));
}

await main().catch((err) => avviso(`${err.message ?? err}`));
