// Operazioni dell'area Amministrazione sui calendari, sul Drive condiviso e su Vercel. I calendari
// li scrive solo il sito, con l'account di servizio (src/admin/calendari.ts); Drive a nome di chi è
// entrato; la ripubblicazione con il deploy hook.
import { CALENDARIO_CONCERTI_ID, CALENDARIO_PROVE_ID, DRIVE_CARTELLA_CONCERTI, DRIVE_CARTELLA_FOTO, VERCEL_DEPLOY_HOOK } from 'astro:env/server';
import type ical from 'node-ical';
import { api } from './google';
import { CAL, calendario } from './calendari';
import type { Sessione } from './sessione';
import { FILE_TESTI, type TestiSalvati } from '../motore/testiSito';

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
  end?: { date?: string; dateTime?: string; timeZone?: string };
  attachments?: { fileUrl: string; title: string; mimeType: string; fileId?: string }[];
  // Nel calendario "Prove": tipo = 'concerto', stato, pubblico (id della copia nel calendario
  // "Concerti"); nella copia: origine (id dell'evento nel calendario "Prove")
  extendedProperties?: { private?: Record<string, string> };
}

// ——— I due calendari dei concerti (dal 4/10/2026) ———
// Un concerto nasce nel calendario privato "Prove", con lo stato nelle proprietà nascoste
// dell'evento: "Da confermare" e "Confermato" restano lì (li vedono coristi e Maestro, non il
// pubblico); "In cartellone" ne fa una copia nel calendario pubblico "Concerti", tenuta allineata a
// ogni modifica e tolta se lo stato torna indietro. I concerti scritti prima direttamente in
// "Concerti" (senza origine) valgono come "In cartellone".
export type Calendario = 'prove' | 'concerti';
const idCal = (c: Calendario) => encodeURIComponent((c === 'prove' ? CALENDARIO_PROVE_ID : CALENDARIO_CONCERTI_ID)!);

export async function eventiIn(c: Calendario, filtro: Record<string, string> = {}): Promise<EventoApi[]> {
  const p = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '500', ...filtro });
  const { items = [] } = await calendario<{ items?: EventoApi[] }>(`${CAL}/calendars/${idCal(c)}/events?${p}`);
  return items.filter((e) => e.status !== 'cancelled');
}
// I concerti del calendario "Prove"
export const concertiInProve = () => eventiIn('prove', { privateExtendedProperty: 'tipo=concerto' });

export async function creaEventoIn(c: Calendario, corpo: object): Promise<EventoApi> {
  return calendario(`${CAL}/calendars/${idCal(c)}/events?supportsAttachments=true`, { method: 'POST', body: JSON.stringify(corpo) });
}
export async function leggiEventoIn(c: Calendario, id: string): Promise<EventoApi> {
  return calendario(`${CAL}/calendars/${idCal(c)}/events/${encodeURIComponent(id)}`);
}
export async function aggiornaEventoIn(c: Calendario, id: string, corpo: object): Promise<EventoApi> {
  return calendario(`${CAL}/calendars/${idCal(c)}/events/${encodeURIComponent(id)}?supportsAttachments=true`, { method: 'PATCH', body: JSON.stringify(corpo) });
}
export async function cancellaEventoIn(c: Calendario, id: string) {
  await calendario(`${CAL}/calendars/${idCal(c)}/events/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((e) => {
    if (!/\((404|410)\)/.test(String(e))) throw e; // già cancellato
  });
}
// Sposta un evento in un altro calendario (resta lo stesso id: convocazione e assenze restano legate)
export async function spostaEvento(da: Calendario, a: Calendario, id: string): Promise<EventoApi> {
  return calendario(`${CAL}/calendars/${idCal(da)}/events/${encodeURIComponent(id)}/move?${new URLSearchParams({ destination: decodeURIComponent(idCal(a)) })}`, { method: 'POST' });
}

export const eventiConcerti = () => eventiIn('concerti');

// I concerti di un giorno (ora di Roma) nei due calendari, per non creare due volte lo stesso concerto
export async function eventiDelGiorno(data: string): Promise<EventoApi[]> {
  const giorno = (d: string) => new Date(`${d}T00:00:00+01:00`);
  const fine = giorno(data);
  fine.setUTCDate(fine.getUTCDate() + 1);
  const p = { timeMin: giorno(data).toISOString(), timeMax: fine.toISOString(), timeZone: 'Europe/Rome' };
  const [inProve, pubblici] = await Promise.all([eventiIn('prove', { ...p, privateExtendedProperty: 'tipo=concerto' }), eventiIn('concerti', p)]);
  return [...inProve, ...pubblici.filter((e) => !e.extendedProperties?.private?.origine)];
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

// La cartella che contiene un file (per la Modifica: quella del concerto); undefined se non si legge
export async function cartellaDelFile(s: Sessione, id: string): Promise<string | undefined> {
  try {
    return (await api<{ parents?: string[] }>(s, `${DRIVE}/files/${id}?fields=parents&supportsAllDrives=true`)).parents?.[0];
  } catch {
    return undefined;
  }
}

// Locandina e copertina dal modulo (già ridotte dal browser), caricate nella cartella del concerto,
// pronte da allegare all'evento
export async function caricaImmagini(s: Sessione, f: FormData, cartella: string) {
  const nuovi: { fileUrl: string; title: string; mimeType: string }[] = [];
  for (const campo of ['locandina', 'copertina']) {
    const file = f.get(campo);
    if (!(file instanceof File) || !file.size) continue;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { errore: `${campo}: solo immagini JPEG, PNG o WebP` };
    const caricato = await caricaFile(s, file, `${campo}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`, cartella);
    nuovi.push({ fileUrl: caricato.webViewLink, title: caricato.name, mimeType: file.type });
  }
  return { nuovi };
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

// Le foto del sito come sono adesso su Drive, per nome (apertura, coro…), con l'ora dell'ultima
// modifica: più recente della build vuol dire che sul sito non c'è ancora
export async function fotoSitoSuDrive(s: Sessione): Promise<Record<string, { id: string; modificata: string }>> {
  const p = new URLSearchParams({ q: `'${DRIVE_CARTELLA_FOTO}' in parents and trashed = false and mimeType contains 'image/'`, fields: 'files(id,name,modifiedTime)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', pageSize: '50' });
  const { files } = await api<{ files: { id: string; name: string; modifiedTime: string }[] }>(s, `${DRIVE}/files?${p}`);
  return Object.fromEntries(files.map((f) => [f.name.replace(/\.[^.]+$/, '').trim().toLowerCase(), { id: f.id, modificata: f.modifiedTime }]));
}

// Un'immagine del Drive da mostrare nell'area (anteprime): il file stesso se sta nel limite di
// 4,5 MB delle risposte delle funzioni, altrimenti la miniatura grande che prepara Drive
export async function immagineDrive(s: Sessione, id: string): Promise<Response> {
  const f = await api<{ mimeType: string; size?: string; thumbnailLink?: string }>(s, `${DRIVE}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=mimeType,size,thumbnailLink`);
  if (!f.mimeType.startsWith('image/')) throw new Error('non è un’immagine');
  const url = Number(f.size ?? 0) <= 4_000_000 || !f.thumbnailLink
    ? `${DRIVE}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`
    : f.thumbnailLink.replace(/=s\d+$/, '=s1600');
  const r = await fetch(url, { headers: { Authorization: `Bearer ${s.accesso}` } });
  if (!r.ok) throw new Error(`Google (${r.status})`);
  return new Response(r.body, { headers: { 'Content-Type': r.headers.get('Content-Type') ?? f.mimeType } });
}

// ——— Testi del sito ———

// Il file "Testi del sito.json" nella cartella Sito (quella che contiene Sito/Foto): i testi
// principali del sito pubblico cambiati dai redattori (src/motore/testiSito.ts)
async function fileTesti(s: Sessione) {
  const { parents = [] } = await api<{ parents?: string[] }>(s, `${DRIVE}/files/${DRIVE_CARTELLA_FOTO}?fields=parents&supportsAllDrives=true`);
  if (!parents[0]) throw new Error('cartella Sito non trovata su Drive');
  const p = new URLSearchParams({ q: `'${parents[0]}' in parents and name = '${virgolette(FILE_TESTI)}' and trashed = false`, fields: 'files(id,modifiedTime)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
  const [f] = (await api<{ files: { id: string; modifiedTime: string }[] }>(s, `${DRIVE}/files?${p}`)).files;
  return { sito: parents[0], id: f?.id };
}

export async function testiSuDrive(s: Sessione): Promise<TestiSalvati> {
  const { id } = await fileTesti(s);
  if (!id) return {};
  return api<TestiSalvati>(s, `${DRIVE}/files/${id}?alt=media&supportsAllDrives=true`);
}

// Riscrive il file (lo stesso, così resta la sua storia su Drive), oppure lo crea
export async function salvaTestiSuDrive(s: Sessione, testi: TestiSalvati) {
  const { sito, id } = await fileTesti(s);
  const corpo = JSON.stringify(testi, null, 1);
  if (!id) return caricaFile(s, new File([corpo], FILE_TESTI, { type: 'application/json' }), FILE_TESTI, sito);
  return api<FileDrive>(s, `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&supportsAllDrives=true&fields=id,name,webViewLink`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: corpo,
  });
}

// ——— Pubblicazione ———

export async function pubblica() {
  const r = await fetch(VERCEL_DEPLOY_HOOK!, { method: 'POST' });
  if (!r.ok) throw new Error(`Vercel non ha accettato la richiesta (${r.status})`);
}
