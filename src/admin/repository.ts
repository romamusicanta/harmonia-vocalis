// Chorus Repository (dal 28/10/2026, richiesta di Mario): il Drive condiviso dove l'associazione tiene
// il suo archivio (foto, spartiti, audio, documenti), variabile DRIVE_REPOSITORY (l'ID del Drive
// condiviso). L'account di servizio ne è solo Lettore: il sito non lo modifica mai. Nell'Amministrazione,
// accanto ai pulsanti di caricamento, «Importa» apre la finestra src/admin/SceltaRepository.astro, dove i
// redattori scorrono le cartelle e scelgono i file; il sito li copia (files.copy, da Drive a Drive) nella
// cartella di destinazione di sempre, con le proprietà di un file caricato più `origine` = l'ID del file
// nel repository, per riconoscere un file già importato lì. Niente di automatico: si copia solo con «Importa».
import { DRIVE_REPOSITORY } from 'astro:env/server';
import { CARTELLA } from '../area/drive';
import { google, tokenServizio } from '../area/servizio';

const DRIVE = 'https://www.googleapis.com/drive/v3';
export const repositoryConfigurato = () => Boolean(DRIVE_REPOSITORY);

// I tipi di file che si possono importare in un punto del sito (i video, per ora, no)
export type Tipi = 'immagini' | 'spartiti' | 'audio';
const ACCETTA: Record<Tipi, (mime: string) => boolean> = {
  immagini: (m) => /^image\/(jpeg|png|webp|avif|heic|heif)$/.test(m),
  spartiti: (m) => m === 'application/pdf' || /^image\/(jpeg|png|webp)$/.test(m),
  audio: (m) => m.startsWith('audio/'),
};
export const accetta = (tipi: Tipi, mime: string) => ACCETTA[tipi]?.(mime) ?? false;

export interface FileRepository { id: string; name: string; mimeType: string; size?: string; driveId?: string; parents?: string[]; thumbnailLink?: string; modifiedTime?: string }

// Un file o una cartella del repository; errore se sta in un altro Drive
export async function leggiDalRepository(id: string): Promise<FileRepository> {
  if (!repositoryConfigurato()) throw new Error('manca la variabile DRIVE_REPOSITORY sul server');
  if (!/^[\w-]{10,}$/.test(id)) throw new Error('file non valido');
  const f = await google<FileRepository>(`${DRIVE}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,mimeType,size,driveId,parents,thumbnailLink,modifiedTime`);
  if (f.id !== DRIVE_REPOSITORY && f.driveId !== DRIVE_REPOSITORY) throw new Error('Il file non è nel Chorus Repository.');
  return f;
}

export interface Elenco {
  percorso: { id: string; nome: string }[];   // dalla radice alla cartella aperta
  cartelle: { id: string; nome: string }[];
  file: { id: string; nome: string; tipo: string; byte?: number; miniatura: boolean; modificato?: string }[];
}

// Il contenuto di una cartella (di base la radice del repository): le sottocartelle e i file del tipo chiesto
export async function elencoRepository(cartella: string | undefined, tipi: Tipi): Promise<Elenco> {
  if (!repositoryConfigurato()) throw new Error('manca la variabile DRIVE_REPOSITORY sul server');
  const dove = cartella || DRIVE_REPOSITORY!;
  const percorso: Elenco['percorso'] = [];
  if (dove !== DRIVE_REPOSITORY) {
    // Risale fino alla radice (al più 12 livelli)
    let f: FileRepository | undefined = await leggiDalRepository(dove);
    if (f.mimeType !== CARTELLA) throw new Error('non è una cartella');
    for (let i = 0; f && f.id !== DRIVE_REPOSITORY && i < 12; i++) {
      percorso.unshift({ id: f.id, nome: f.name });
      const su: string | undefined = f.parents?.[0];
      f = su && su !== DRIVE_REPOSITORY ? await leggiDalRepository(su) : undefined;
    }
  }
  percorso.unshift({ id: DRIVE_REPOSITORY!, nome: 'Chorus Repository' });
  const tutti: FileRepository[] = [];
  let pagina: string | undefined;
  do {
    const p = new URLSearchParams({
      q: `'${dove}' in parents and trashed = false`, corpora: 'drive', driveId: DRIVE_REPOSITORY!,
      fields: 'nextPageToken,files(id,name,mimeType,size,thumbnailLink,modifiedTime)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
      pageSize: '1000', orderBy: 'folder,name_natural', ...(pagina ? { pageToken: pagina } : {}),
    });
    const r = await google<{ files: FileRepository[]; nextPageToken?: string }>(`${DRIVE}/files?${p}`);
    tutti.push(...r.files);
    pagina = r.nextPageToken;
  } while (pagina);
  return {
    percorso,
    cartelle: tutti.filter((f) => f.mimeType === CARTELLA).map((f) => ({ id: f.id, nome: f.name })),
    file: tutti.filter((f) => f.mimeType !== CARTELLA && accetta(tipi, f.mimeType))
      .map((f) => ({ id: f.id, nome: f.name, tipo: f.mimeType, byte: f.size ? Number(f.size) : undefined, miniatura: Boolean(f.thumbnailLink), modificato: f.modifiedTime })),
  };
}

// La miniatura (320 px) che prepara Drive
export async function miniaturaRepository(id: string): Promise<Response> {
  const f = await leggiDalRepository(id).catch(() => undefined);
  if (!f?.thumbnailLink) return new Response('Miniatura non trovata', { status: 404 });
  const r = await fetch(f.thumbnailLink.replace(/=s\d+$/, '=s320'), { headers: { Authorization: `Bearer ${await tokenServizio()}` } });
  if (!r.ok) return new Response('Miniatura non trovata', { status: 404 });
  return new Response(r.body, { headers: { 'Content-Type': r.headers.get('content-type') ?? 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } });
}

// Un file del repository già importato in quella cartella (proprietà origine), se c'è
export async function giaImportato(cartella: string, origine: string) {
  const q = `'${cartella}' in parents and trashed = false and appProperties has { key='origine' and value='${origine}' }`;
  const { files } = await google<{ files: { id: string; name: string }[] }>(`${DRIVE}/files?${new URLSearchParams({ q, fields: 'files(id,name)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })}`);
  return files[0];
}

// La copia, da Drive a Drive, nella cartella di destinazione (niente passa dal sito: nessun limite di dimensione)
export async function copiaDalRepository(id: string, dest: { cartella: string; nome: string; description?: string; appProperties?: Record<string, string> }) {
  return google<{ id: string; name: string }>(`${DRIVE}/files/${encodeURIComponent(id)}/copy?supportsAllDrives=true&fields=id,name`, {
    method: 'POST',
    body: JSON.stringify({ name: dest.nome, parents: [dest.cartella], ...(dest.description ? { description: dest.description } : {}), appProperties: { ...dest.appProperties, origine: id } }),
  });
}

// Il contenuto di un'immagine del repository, come se l'avesse scelta il browser (per i punti che
// sostituiscono il contenuto di un file, come Foto del sito): al più 30 MB
export async function immagineDalRepository(id: string): Promise<File> {
  const f = await leggiDalRepository(id);
  if (!/^image\/(jpeg|png|webp)$/.test(f.mimeType)) throw new Error(`«${f.name}» non è un'immagine JPEG, PNG o WebP`);
  if (Number(f.size ?? 0) > 30 * 1024 * 1024) throw new Error(`«${f.name}» è troppo grande (più di 30 MB)`);
  const r = await fetch(`${DRIVE}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${await tokenServizio()}` } });
  if (!r.ok) throw new Error(`Drive non ha dato il file (${r.status})`);
  return new File([await r.arrayBuffer()], f.name, { type: f.mimeType });
}
