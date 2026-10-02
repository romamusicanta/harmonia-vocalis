// Operazioni dell'area Amministrazione sul calendario "Concerti", sul Drive condiviso e su Vercel,
// sempre a nome di chi è entrato (tranne la ripubblicazione, che usa il deploy hook).
import { CALENDARIO_CONCERTI_ID, DRIVE_CARTELLA_CONCERTI, DRIVE_CARTELLA_FOTO, VERCEL_DEPLOY_HOOK } from 'astro:env/server';
import type ical from 'node-ical';
import { api } from './google';
import type { Sessione } from './sessione';

const CAL = 'https://www.googleapis.com/calendar/v3';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const CARTELLA = 'application/vnd.google-apps.folder';

export const configurazioneMancante = () =>
  Object.entries({ CALENDARIO_CONCERTI_ID, DRIVE_CARTELLA_CONCERTI, DRIVE_CARTELLA_FOTO, VERCEL_DEPLOY_HOOK }).filter(([, v]) => !v).map(([k]) => k);

// ——— Calendario ———

export interface EventoApi {
  id: string;
  status: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink: string;
  updated: string;
  start: { date?: string; dateTime?: string };
  attachments?: { fileUrl: string; title: string; mimeType: string; fileId?: string }[];
}

export async function eventiConcerti(s: Sessione): Promise<EventoApi[]> {
  const p = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '500' });
  const { items = [] } = await api<{ items?: EventoApi[] }>(s, `${CAL}/calendars/${encodeURIComponent(CALENDARIO_CONCERTI_ID!)}/events?${p}`);
  return items.filter((e) => e.status !== 'cancelled');
}

// Lo stesso evento nella forma di node-ical, per leggerlo con src/motore/calendario.ts
export function comeIcal(e: EventoApi): ical.VEvent {
  const soloGiorno = Boolean(e.start.date);
  const start = Object.assign(new Date(soloGiorno ? `${e.start.date}T12:00:00Z` : e.start.dateTime!), soloGiorno ? { dateOnly: true } : {});
  return {
    type: 'VEVENT',
    summary: e.summary ?? '',
    description: e.description ?? '',
    location: e.location ?? '',
    start,
    attach: (e.attachments ?? []).map((a) => ({ params: { FILENAME: a.title, FMTTYPE: a.mimeType }, val: a.fileUrl })),
  } as unknown as ical.VEvent;
}

export async function creaEvento(s: Sessione, corpo: object): Promise<EventoApi> {
  const p = new URLSearchParams({ supportsAttachments: 'true' });
  return api(s, `${CAL}/calendars/${encodeURIComponent(CALENDARIO_CONCERTI_ID!)}/events?${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
}

// ——— Drive ———

const virgolette = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function elenca(s: Sessione, q: string) {
  const p = new URLSearchParams({ q: `${q} and trashed = false`, fields: 'files(id,name,mimeType,webViewLink)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', pageSize: '200' });
  return (await api<{ files: { id: string; name: string; mimeType: string; webViewLink: string }[] }>(s, `${DRIVE}/files?${p}`)).files;
}

async function cartella(s: Sessione, genitore: string, nome: string): Promise<string> {
  const [trovata] = await elenca(s, `'${genitore}' in parents and name = '${virgolette(nome)}' and mimeType = '${CARTELLA}'`);
  if (trovata) return trovata.id;
  const nuova = await api<{ id: string }>(s, `${DRIVE}/files?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: CARTELLA, parents: [genitore] }),
  });
  return nuova.id;
}

// Concerti/<stagione>/<nome>/ con le sottocartelle Foto e Registrazioni (vedi il LEGGIMI su Drive)
export async function cartellaConcerto(s: Sessione, stagione: string, nome: string) {
  const id = await cartella(s, await cartella(s, DRIVE_CARTELLA_CONCERTI!, stagione), nome);
  await cartella(s, id, 'Foto');
  await cartella(s, id, 'Registrazioni');
  return id;
}

interface FileDrive { id: string; name: string; webViewLink: string }

// Caricamento in un colpo solo (multipart): i file arrivano già ridotti dal browser
export async function caricaFile(s: Sessione, file: File, nome: string, genitore: string): Promise<FileDrive> {
  const confine = `hv${crypto.randomUUID()}`;
  const corpo = new Blob([
    `--${confine}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [genitore] })}\r\n`,
    `--${confine}\r\nContent-Type: ${file.type}\r\n\r\n`,
    await file.arrayBuffer(),
    `\r\n--${confine}--`,
  ]);
  return api(s, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${confine}` },
    body: corpo,
  });
}

// Foto del sito: sostituisce il contenuto del file con quel nome in Sito/Foto (lo stesso file, così
// resta la sua storia su Drive), oppure lo crea
export const NOMI_FOTO_SITO = ['apertura', 'coro', 'prove', 'maestro', 'accesso'] as const;

export async function sostituisciFotoSito(s: Sessione, nome: (typeof NOMI_FOTO_SITO)[number], file: File) {
  const esistenti = (await elenca(s, `'${DRIVE_CARTELLA_FOTO}' in parents`)).filter((f) => f.name.replace(/\.[^.]+$/, '').trim().toLowerCase() === nome);
  const [primo, ...altri] = esistenti;
  // Due file con lo stesso nome (apertura.jpg e apertura.png) confonderebbero la build: ne resta uno
  for (const f of altri) await api(s, `${DRIVE}/files/${f.id}?supportsAllDrives=true`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  if (!primo) return caricaFile(s, file, `${nome}.jpg`, DRIVE_CARTELLA_FOTO!);
  return api<FileDrive>(s, `https://www.googleapis.com/upload/drive/v3/files/${primo.id}?uploadType=media&supportsAllDrives=true&fields=id,name,webViewLink`, {
    method: 'PATCH',
    headers: { 'Content-Type': file.type },
    body: await file.arrayBuffer(),
  });
}

// ——— Pubblicazione ———

export async function pubblica() {
  const r = await fetch(VERCEL_DEPLOY_HOOK!, { method: 'POST' });
  if (!r.ok) throw new Error(`Vercel non ha accettato la richiesta (${r.status})`);
}
