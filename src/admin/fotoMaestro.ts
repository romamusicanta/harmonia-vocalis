// Foto del Maestro (dal 13/10/2026): le foto per il carosello della pagina «Il Maestro», nella
// sottocartella «Maestro» di Sito/Foto del Drive condiviso (DRIVE_CARTELLA_FOTO; la crea il sito), scritte
// con l'account di servizio. Su ogni file, nelle proprietà (appProperties): caricatoDa, carosello = sì
// per quelle che scorrono nella pagina e ordine (1, 2…) per la loro posizione. I redattori le gestiscono
// in Amministrazione → Foto del sito (sezione «Il Maestro: carosello»). Valgono dopo la pubblicazione:
// scripts/scarica-allegati.mjs scarica quelle del carosello in coro/immagini/drive/sito/maestro/ con
// l'elenco in ordine (elenco.json); src/motore/coro.ts (fotoCaroselloMaestro) le dà alla pagina.
import { DRIVE_CARTELLA_FOTO } from 'astro:env/server';
import { CARTELLA, cartellaIn, cestina, fileIn, leggiFile } from '../area/drive';
import { google, tokenServizio } from '../area/servizio';
import { caricaFile } from './operazioni';
import type { Sessione } from './sessione';

export const NOME_CARTELLA = 'Maestro';
export const configurato = () => Boolean(DRIVE_CARTELLA_FOTO);

export interface FotoMaestro { id: string; nome: string; caricata: string; caricatoDa?: string; carosello: boolean; ordine?: number }

// La cartella si crea al primo caricamento; per leggere basta cercarla (undefined se non c'è ancora)
const cartella = () => cartellaIn(DRIVE_CARTELLA_FOTO!, NOME_CARTELLA);
const cercaCartella = async () => (await fileIn(DRIVE_CARTELLA_FOTO!, true)).find((f) => f.mimeType === CARTELLA && f.name === NOME_CARTELLA)?.id;
const proprieta = (id: string, appProperties: Record<string, string | null>) =>
  google(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id`, { method: 'PATCH', body: JSON.stringify({ appProperties }) });

// Tutte le foto: prima quelle del carosello nel loro ordine, poi le altre, dalla più recente
export async function fotoDelMaestro(): Promise<FotoMaestro[]> {
  const dove = await cercaCartella();
  if (!dove) return [];
  return (await fileIn(dove))
    .filter((f) => f.mimeType.startsWith('image/'))
    .map((f) => ({ id: f.id, nome: f.name, caricata: f.createdTime, caricatoDa: f.appProperties?.caricatoDa, carosello: f.appProperties?.carosello === 'sì', ordine: f.appProperties?.ordine ? Number(f.appProperties.ordine) : undefined }))
    .sort((a, b) => Number(b.carosello) - Number(a.carosello) || (a.ordine ?? Infinity) - (b.ordine ?? Infinity) || b.caricata.localeCompare(a.caricata));
}

// Il file deve stare nella cartella del Maestro
async function controlla(id: string) {
  const f = await leggiFile(id);
  const dove = await cercaCartella();
  if (!dove || !f.parents?.includes(dove)) throw new Error('Non è una foto del Maestro.');
  return f;
}

// Una foto nuova (già ridotta dal browser): entra subito nel carosello, in fondo
export async function caricaFotoMaestro(s: Sessione, file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('serve un’immagine JPEG, PNG o WebP');
  const dove = await cartella();
  const ultime = (await fotoDelMaestro()).filter((f) => f.carosello).length;
  const nome = `maestro-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`;
  const f = await caricaFile(s, file, nome, dove);
  await proprieta(f.id, { carosello: 'sì', ordine: String(ultime + 1) });
  return f.id;
}

// Nel carosello o no: chi esce perde la posizione, chi entra va in fondo
export async function nelCarosello(id: string, si: boolean) {
  await controlla(id);
  const ultime = (await fotoDelMaestro()).filter((f) => f.carosello && f.id !== id).length;
  await proprieta(id, si ? { carosello: 'sì', ordine: String(ultime + 1) } : { carosello: null, ordine: null });
}

// Il nuovo ordine del carosello: ids = tutte le foto del carosello, nell'ordine
export async function ordinaFotoMaestro(ids: string[]) {
  const attuali = new Map((await fotoDelMaestro()).filter((f) => f.carosello).map((f) => [f.id, f]));
  if (ids.some((id) => !attuali.has(id))) throw new Error('Una delle foto non è più nel carosello: ricarica la pagina.');
  const cambiate = ids.map((id, i) => ({ id, ordine: i + 1 })).filter(({ id, ordine }) => attuali.get(id)!.ordine !== ordine);
  for (let i = 0; i < cambiate.length; i += 5) await Promise.all(cambiate.slice(i, i + 5).map(({ id, ordine }) => proprieta(id, { ordine: String(ordine) })));
}

// Nel cestino del Drive condiviso (si recupera per 30 giorni)
export async function togliFotoMaestro(id: string) {
  await controlla(id);
  await cestina(id);
}

// La miniatura (640 px) che prepara Drive; appena caricata, se non c'è ancora, la foto intera
export async function miniaturaMaestro(id: string): Promise<Response> {
  if (!/^[\w-]{10,}$/.test(id)) return new Response('Foto non trovata', { status: 404 });
  const f = await controlla(id).catch(() => undefined);
  if (!f) return new Response('Foto non trovata', { status: 404 });
  const { thumbnailLink } = await google<{ thumbnailLink?: string }>(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=thumbnailLink`);
  const token = await tokenServizio();
  let r = thumbnailLink ? await fetch(thumbnailLink.replace(/=s\d+$/, '=s640'), { headers: { Authorization: `Bearer ${token}` } }) : undefined;
  if (!r?.ok) r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return new Response('Foto non trovata', { status: 404 });
  return new Response(r.body, { headers: { 'Content-Type': r.headers.get('content-type') ?? 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } });
}
