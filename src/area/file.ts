// File del Drive del coro serviti dal sito (/area/file/<id>, /maestro/file/<id>): spartiti, brani e
// registrazioni si aprono e si ascoltano senza che il corista debba entrare su Drive con l'account
// giusto. Il sito li legge con l'account di servizio e li passa al browser così come arrivano
// (streaming: la prova del 3/10/2026 ha mostrato che le risposte delle funzioni di Vercel superano i
// 4,5 MB, il limite vale solo per le richieste), con le richieste parziali (Range) che servono ai
// lettori audio e video per andare avanti e indietro.
// Si servono solo PDF, audio e video che stanno nelle cartelle Spartiti o Registrazioni prove (o in
// una loro sottocartella): l'account di servizio vede anche altro, che qui non deve uscire.
import { DRIVE_CARTELLA_REGISTRAZIONI, DRIVE_CARTELLA_SPARTITI } from 'astro:env/server';
import { google, tokenServizio } from './servizio';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const TIPI = /^(application\/pdf|audio\/|video\/)/;

interface Dati { name: string; mimeType: string; size?: string; parents?: string[]; trashed?: boolean }
// Il controllo di ogni file vale 10 minuti: un lettore audio fa molte richieste parziali di seguito
const controllati = new Map<string, { dati: Dati; letti: number }>();
const DURATA = 10 * 60 * 1000;

const meta = (id: string) =>
  google<Dati>(`${DRIVE}/files/${encodeURIComponent(id)}?${new URLSearchParams({ fields: 'name,mimeType,size,parents,trashed', supportsAllDrives: 'true' })}`);

async function consentito(id: string): Promise<Dati | undefined> {
  const c = controllati.get(id);
  if (c && Date.now() - c.letti < DURATA) return c.dati;
  const radici = [DRIVE_CARTELLA_SPARTITI, DRIVE_CARTELLA_REGISTRAZIONI].filter(Boolean) as string[];
  const dati = await meta(id).catch(() => undefined);
  if (!dati || dati.trashed || !TIPI.test(dati.mimeType)) return;
  // Nella cartella o in una sua sottocartella (Spartiti/<pezzo>/, Registrazioni prove/<prova>/)
  const genitori = dati.parents ?? [];
  let dentro = genitori.some((g) => radici.includes(g));
  if (!dentro) {
    const nonni = await Promise.all(genitori.map((g) => meta(g).then((x) => x.parents ?? []).catch(() => [] as string[])));
    dentro = nonni.flat().some((g) => radici.includes(g));
  }
  if (!dentro) return;
  controllati.set(id, { dati, letti: Date.now() });
  return dati;
}

export async function serviFile(id: string | undefined, richiesta: Request): Promise<Response> {
  const dati = id && /^[\w-]{10,}$/.test(id) ? await consentito(id) : undefined;
  if (!dati) return new Response('File non trovato', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const intervallo = richiesta.headers.get('range');
  const r = await fetch(`${DRIVE}/files/${encodeURIComponent(id!)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${await tokenServizio()}`, ...(intervallo ? { Range: intervallo } : {}) },
  });
  if (!r.ok && r.status !== 206) {
    return new Response(r.status === 416 ? '' : 'Il file non si può leggere ora: riprova tra poco.', { status: r.status === 416 ? 416 : 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const intestazioni = new Headers({
    'Content-Type': dati.mimeType,
    'Accept-Ranges': 'bytes',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(dati.name)}`,
  });
  for (const h of ['content-length', 'content-range']) {
    const v = r.headers.get(h);
    if (v) intestazioni.set(h, v);
  }
  return new Response(r.body, { status: r.status, headers: intestazioni });
}

// Il link di un file del Drive del coro (https://drive.google.com/file/d/<id>/…) diventa quello del
// sito; gli altri link (YouTube, cartelle, altri siti) restano come sono
export function linkDelSito(link: string, base: '/area' | '/maestro' = '/area'): string;
export function linkDelSito(link: string | undefined, base?: '/area' | '/maestro'): string | undefined;
export function linkDelSito(link: string | undefined, base: '/area' | '/maestro' = '/area') {
  const id = link?.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]{10,})/)?.[1];
  return id ? `${base}/file/${id}` : link;
}
// Se il link porta ancora a Drive (per esempio una cartella): lì serve l'account dell'associazione
export const suDrive = (link?: string) => Boolean(link && /^https:\/\/(drive|docs)\.google\.com\//.test(link));
