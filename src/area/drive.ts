// File sul Drive condiviso del coro, scritti dall'account di servizio (Gestore contenuti delle
// cartelle Spartiti e Registrazioni prove): cartelle, elenco, cestino e caricamento "resumable" a
// pezzi da 3,5 MB attraverso il sito (le funzioni di Vercel accettano al più 4,5 MB per richiesta).
// Lo usano il repertorio (repertorio.ts) e le registrazioni delle prove (registrazioni.ts).
import { cifra, decifra } from '../admin/sessione';
import { google, tokenServizio } from './servizio';
import { spiegaTesto } from './errori';

const DRIVE = 'https://www.googleapis.com/drive/v3';
export const CARTELLA = 'application/vnd.google-apps.folder';
export const PEZZO_FILE = 14 * 256 * 1024; // 3,5 MB, multiplo di 256 KB come vuole Drive
const MASSIMO = 500 * 1024 * 1024;

const virgolette = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
export const linkFile = (id: string) => `https://drive.google.com/file/d/${id}/view`;

export interface FileDrive {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  description?: string;
  appProperties?: Record<string, string>;
}

// I file (o le cartelle) dentro una cartella
export async function fileIn(cartella: string, soloCartelle = false): Promise<FileDrive[]> {
  const q = `'${cartella}' in parents and trashed = false${soloCartelle ? ` and mimeType = '${CARTELLA}'` : ''}`;
  const p = new URLSearchParams({ q, fields: 'files(id,name,mimeType,size,createdTime,description,appProperties)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', pageSize: '1000', orderBy: 'createdTime' });
  return (await google<{ files: FileDrive[] }>(`${DRIVE}/files?${p}`)).files;
}

// I file dentro più cartelle insieme, per cartella: una richiesta ogni 40 cartelle invece di una per
// cartella (le registrazioni e le foto dei concerti hanno una sottocartella per prova o concerto, e la
// Bacheca le legge a ogni apertura)
export async function fileInCartelle(cartelle: string[]): Promise<Map<string, FileDrive[]>> {
  const perCartella = new Map(cartelle.map((c) => [c, [] as FileDrive[]]));
  const gruppi = Array.from({ length: Math.ceil(cartelle.length / 40) }, (_, i) => cartelle.slice(i * 40, i * 40 + 40));
  await Promise.all(gruppi.map(async (gruppo) => {
    const q = `(${gruppo.map((c) => `'${c}' in parents`).join(' or ')}) and trashed = false`;
    let pagina: string | undefined;
    do {
      const p = new URLSearchParams({ q, fields: 'nextPageToken,files(id,name,mimeType,size,createdTime,description,appProperties,parents)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', pageSize: '1000', orderBy: 'createdTime', ...(pagina ? { pageToken: pagina } : {}) });
      const r = await google<{ files: (FileDrive & { parents?: string[] })[]; nextPageToken?: string }>(`${DRIVE}/files?${p}`);
      for (const f of r.files) for (const c of f.parents ?? []) perCartella.get(c)?.push(f);
      pagina = r.nextPageToken;
    } while (pagina);
  }));
  return perCartella;
}

// La sottocartella con quel nome (creata se manca)
export async function cartellaIn(genitore: string, nome: string) {
  const pulito = nome.replace(/[/\\]/g, '-');
  const q = `'${genitore}' in parents and name = '${virgolette(pulito)}' and mimeType = '${CARTELLA}' and trashed = false`;
  const { files } = await google<{ files: { id: string }[] }>(`${DRIVE}/files?${new URLSearchParams({ q, fields: 'files(id)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })}`);
  return files[0]?.id ?? (await google<{ id: string }>(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
    method: 'POST', body: JSON.stringify({ name: pulito, mimeType: CARTELLA, parents: [genitore] }),
  })).id;
}

export async function leggiFile(id: string) {
  return google<FileDrive & { parents?: string[] }>(`${DRIVE}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,mimeType,parents,appProperties`);
}

// Nel cestino del Drive condiviso (si recupera per 30 giorni)
export async function cestina(id: string) {
  await google(`${DRIVE}/files/${encodeURIComponent(id)}?supportsAllDrives=true`, { method: 'PATCH', body: JSON.stringify({ trashed: true }) });
}

// Apre la sessione di caricamento di un file nella cartella; restituisce il suo indirizzo
async function apriCaricamento(cartella: string, nome: string, tipo: string, dimensione: number, extra: { description?: string; appProperties?: Record<string, string> } = {}) {
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await tokenServizio()}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': tipo || 'application/octet-stream',
      'X-Upload-Content-Length': String(dimensione),
    },
    body: JSON.stringify({ name: nome, parents: [cartella], ...extra }),
  });
  const sessione = r.headers.get('Location');
  if (!r.ok || !sessione) throw new Error(`Drive non ha aperto il caricamento (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return sessione;
}

// Un pezzo del file (da inizio, sul totale): restituisce l'id del file quando è arrivato tutto
async function caricaPezzo(sessione: string, dati: ArrayBuffer, inizio: number, totale: number): Promise<string | undefined> {
  if (!sessione.startsWith('https://www.googleapis.com/upload/drive/')) throw new Error('caricamento non valido');
  const fine = inizio + dati.byteLength - 1;
  const r = await fetch(sessione, { method: 'PUT', headers: { 'Content-Range': `bytes ${inizio}-${fine}/${totale}` }, body: dati });
  if (r.status === 308) return undefined;
  if (!r.ok) throw new Error(`Drive ha rifiutato il file (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()) as { id: string }).id;
}

const json = (corpo: object, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

export interface Richiesta { nome: string; tipo: string; dimensione: number; [altro: string]: unknown }
export interface Destinazione { cartella: string; nome: string; description?: string; appProperties?: Record<string, string>; dopo?: Record<string, string> }
type Gettone = { sessione: string; totale: number; scade: number; nome: string; dopo?: Record<string, string> };

// Endpoint del caricamento a pezzi, usato dagli script dei moduli: "inizia" (intestazione
// x-azione, corpo JSON con nome, tipo, dimensione e i dati della pagina) chiede a prepara dove
// mettere il file e restituisce un gettone cifrato con la sessione di Drive; ogni pezzo (corpo =
// byte, intestazioni x-gettone e x-inizio) la porta avanti, e all'ultimo si chiama completa.
export async function rispondiCaricamento(
  request: Request,
  prepara: (d: Richiesta) => Promise<Destinazione>,
  completa?: (idFile: string, nome: string, dopo: Record<string, string>) => Promise<void>,
) {
  try {
    if (request.headers.get('x-azione') === 'inizia') {
      const d = (await request.json()) as Richiesta;
      d.nome = String(d.nome ?? '').trim().slice(0, 150) || 'file';
      if (!(d.dimensione > 0) || d.dimensione > MASSIMO) return json({ ok: false, errore: 'Il file deve essere tra 1 byte e 500 MB.' }, 400);
      const dest = await prepara(d);
      const sessione = await apriCaricamento(dest.cartella, dest.nome, String(d.tipo ?? ''), d.dimensione, { description: dest.description, appProperties: dest.appProperties });
      const g: Gettone = { sessione, totale: d.dimensione, scade: Date.now() + 6 * 3600 * 1000, nome: dest.nome, dopo: dest.dopo };
      return json({ ok: true, gettone: cifra(g), pezzo: PEZZO_FILE });
    }
    const g = decifra<Gettone>(request.headers.get('x-gettone') ?? undefined);
    if (!g || g.scade < Date.now()) return json({ ok: false, errore: 'Caricamento scaduto: riprova.' }, 400);
    const inizio = Number(request.headers.get('x-inizio'));
    const dati = await request.arrayBuffer();
    if (!Number.isInteger(inizio) || inizio < 0 || dati.byteLength > PEZZO_FILE || inizio + dati.byteLength > g.totale) return json({ ok: false, errore: 'Pezzo del file non valido.' }, 400);
    const idFile = await caricaPezzo(g.sessione, dati, inizio, g.totale);
    if (!idFile) return json({ ok: true, fatto: false });
    await completa?.(idFile, g.nome, g.dopo ?? {});
    return json({ ok: true, fatto: true, id: idFile });
  } catch (e) {
    return json({ ok: false, errore: spiegaTesto(e) }, 500);
  }
}
