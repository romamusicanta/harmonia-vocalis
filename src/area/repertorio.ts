// Repertorio dell'area coristi: scheda "Repertorio" del foglio "Coristi e assenze" (la crea il
// sito), una riga per pezzo, e i file su Drive in Spartiti/<Autore – Titolo>/ (cartella
// DRIVE_CARTELLA_SPARTITI del Drive condiviso). Lo gestiscono i redattori (/admin/repertorio) e il
// Maestro (/maestro/repertorio); scrive tutto l'account di servizio, che sulla cartella Spartiti è
// Gestore contenuti. I coristi aprono i file su Drive: coro@ e maestro@ leggono la cartella.
//
// Per ogni pezzo: spartito, brani cantati separatamente (un file ciascuno), link alle tracce di
// studio per sezione e per tutte le voci, link all'esecuzione di riferimento, note del Maestro.
// I file si caricano a pezzi da 3,5 MB attraverso il sito (le funzioni di Vercel accettano al più
// 4,5 MB per richiesta), con il caricamento "resumable" di Drive.
import { randomBytes } from 'node:crypto';
import { DRIVE_CARTELLA_SPARTITI } from 'astro:env/server';
import { adesso, cancellaRiga, idScheda, leggiScheda, scriviRiga, SEZIONI } from './dati';
import { google, tokenServizio } from './servizio';
import { cifra, decifra } from '../admin/sessione';

const SCHEDA = 'Repertorio';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const CARTELLA = 'application/vnd.google-apps.folder';
export const STATI = ['In studio', 'In repertorio'] as const;
const TRACCE = [...SEZIONI, 'Tutte le voci'];
const COLONNE = ['ID', 'Autore', 'Titolo', 'Stato', 'Spartito', 'Brani separati', ...TRACCE.map((t) => `Tracce ${t}`), 'Esecuzione di riferimento', 'Note del Maestro', 'Cartella', 'Aggiornato il', 'Aggiornato da'];

export const configurato = () => Boolean(DRIVE_CARTELLA_SPARTITI);

export interface FileBrano { nome: string; link: string }
export interface Pezzo {
  riga: number;
  id: string;
  autore: string;
  titolo: string;
  stato: string;
  spartito?: string;                 // link a Drive
  brani: FileBrano[];                // nel foglio: una riga per brano, "Nome | link"
  tracce: { sezione: string; link: string }[];
  esecuzione?: string;
  note: string;
  cartella?: string;                 // id della cartella su Drive
  aggiornato: string;
}

export const sezioniTracce = TRACCE;
export const nomeCompleto = (p: Pick<Pezzo, 'autore' | 'titolo'>) => [p.autore, p.titolo].filter(Boolean).join(' – ');

const aBrani = (v = '') => v.split('\n').map((r) => r.split(' | ')).filter(([, l]) => l).map(([nome, link]) => ({ nome: nome.trim(), link: link.trim() }));
const daBrani = (b: FileBrano[]) => b.map((x) => `${x.nome} | ${x.link}`).join('\n');

export async function repertorio(): Promise<Pezzo[]> {
  await idScheda(SCHEDA, COLONNE);
  return (await leggiScheda(SCHEDA))
    .filter((r) => r['ID'] && r['Titolo'])
    .map((r) => ({
      riga: r.riga,
      id: r['ID'],
      autore: r['Autore'],
      titolo: r['Titolo'],
      stato: r['Stato'] || STATI[0],
      spartito: r['Spartito'] || undefined,
      brani: aBrani(r['Brani separati']),
      tracce: TRACCE.map((sezione) => ({ sezione, link: r[`Tracce ${sezione}`] })).filter((t) => t.link),
      esecuzione: r['Esecuzione di riferimento'] || undefined,
      note: r['Note del Maestro'],
      cartella: r['Cartella'] || undefined,
      aggiornato: r['Aggiornato il'],
    }))
    .sort((a, b) => STATI.indexOf(a.stato as (typeof STATI)[number]) - STATI.indexOf(b.stato as (typeof STATI)[number]) || a.autore.localeCompare(b.autore, 'it') || a.titolo.localeCompare(b.titolo, 'it'));
}

// Il testo si scrive come testo (apostrofo iniziale): niente formule né date interpretate
const t = (v?: string) => (v ? `'${v}` : '');

async function scrivi(p: Omit<Pezzo, 'riga' | 'aggiornato'>, riga: number | undefined, da: string) {
  const tracce = TRACCE.map((s) => t(p.tracce.find((x) => x.sezione === s)?.link));
  await scriviRiga(SCHEDA, [p.id, t(p.autore), t(p.titolo), p.stato, t(p.spartito), t(daBrani(p.brani)), ...tracce, t(p.esecuzione), t(p.note), p.cartella ?? '', adesso(), da], riga);
}

const link = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (!/^https?:\/\/\S+$/.test(s)) throw new Error(`«${s.slice(0, 60)}» non è un indirizzo web (deve iniziare con https://)`);
  return s;
};

// Modulo del pezzo (POST): azione=salva (id per modificare), cancella, togli-brano (indice)
export async function gestisci(f: FormData, email: string): Promise<{ ok: boolean; messaggio: string; id?: string }> {
  const azione = String(f.get('azione') ?? '');
  const id = String(f.get('id') ?? '');
  const elenco = await repertorio();
  const esistente = id ? elenco.find((p) => p.id === id) : undefined;
  if (id && !esistente) return { ok: false, messaggio: 'Pezzo non trovato: forse è stato cancellato.' };

  if (azione === 'cancella' && esistente) {
    await cancellaRiga(SCHEDA, esistente.riga);
    return { ok: true, messaggio: `«${nomeCompleto(esistente)}» tolto dal repertorio. I file restano su Drive, nella sua cartella.` };
  }
  if (azione === 'togli-brano' && esistente) {
    const i = Number(f.get('indice'));
    const brani = esistente.brani.filter((_, j) => j !== i);
    await scrivi({ ...esistente, brani }, esistente.riga, email);
    return { ok: true, messaggio: 'Brano tolto dal pezzo (il file resta su Drive).', id: esistente.id };
  }
  if (azione === 'togli-spartito' && esistente) {
    await scrivi({ ...esistente, spartito: undefined }, esistente.riga, email);
    return { ok: true, messaggio: 'Spartito tolto dal pezzo (il file resta su Drive).', id: esistente.id };
  }
  if (azione !== 'salva') return { ok: false, messaggio: 'Azione sconosciuta.' };

  const titolo = String(f.get('titolo') ?? '').trim().slice(0, 140);
  if (!titolo) return { ok: false, messaggio: 'Manca il titolo.' };
  const stato = STATI.includes(f.get('stato') as (typeof STATI)[number]) ? String(f.get('stato')) : STATI[0];
  const pezzo = {
    id: esistente?.id ?? randomBytes(4).toString('hex'),
    autore: String(f.get('autore') ?? '').trim().slice(0, 100),
    titolo,
    stato,
    spartito: esistente?.spartito,
    brani: esistente?.brani ?? [],
    tracce: TRACCE.map((sezione) => ({ sezione, link: link(f.get(`tracce-${sezione}`)) })).filter((x) => x.link),
    esecuzione: link(f.get('esecuzione')) || undefined,
    note: String(f.get('note') ?? '').replace(/\r\n/g, '\n').trim().slice(0, 4000),
    cartella: esistente?.cartella,
  };
  await scrivi(pezzo, esistente?.riga, email);
  return { ok: true, messaggio: esistente ? 'Pezzo aggiornato.' : 'Pezzo aggiunto al repertorio: ora puoi caricare lo spartito e i brani.', id: pezzo.id };
}

// Per le pagine: esegue l'azione e restituisce dove tornare
export async function dopoIlModulo(request: Request, email: string, percorso: string) {
  const f = await request.formData();
  const r = await gestisci(f, email).catch((e) => ({ ok: false, messaggio: `Non è stato possibile salvare: ${(e as Error).message}`, id: undefined }));
  const p = new URLSearchParams({ esito: r.messaggio, ok: r.ok ? '1' : '0' });
  const id = r.id ?? (f.get('azione') !== 'cancella' ? String(f.get('id') ?? '') : '');
  if (id) p.set('modifica', id);
  return `${percorso}?${p}`;
}

// ——— File su Drive ———

const virgolette = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

// La cartella del pezzo in Spartiti (creata se manca; il nome è "Autore – Titolo")
async function cartellaDi(p: Pezzo) {
  if (p.cartella) return p.cartella;
  const nome = nomeCompleto(p).replace(/[/\\]/g, '-');
  const q = `'${DRIVE_CARTELLA_SPARTITI}' in parents and name = '${virgolette(nome)}' and mimeType = '${CARTELLA}' and trashed = false`;
  const { files } = await google<{ files: { id: string }[] }>(`${DRIVE}/files?${new URLSearchParams({ q, fields: 'files(id)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })}`);
  const id = files[0]?.id ?? (await google<{ id: string }>(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
    method: 'POST', body: JSON.stringify({ name: nome, mimeType: CARTELLA, parents: [DRIVE_CARTELLA_SPARTITI] }),
  })).id;
  return id;
}

export const PEZZO_FILE = 14 * 256 * 1024; // 3,5 MB, multiplo di 256 KB come vuole Drive

// Inizio del caricamento di un file: crea la sessione su Drive e restituisce il suo indirizzo
export async function iniziaCaricamento(idPezzo: string, nome: string, tipo: string, dimensione: number, email: string) {
  if (!configurato()) throw new Error('manca la variabile DRIVE_CARTELLA_SPARTITI sul server');
  const pezzo = (await repertorio()).find((p) => p.id === idPezzo);
  if (!pezzo) throw new Error('pezzo non trovato');
  const cartella = await cartellaDi(pezzo);
  if (cartella !== pezzo.cartella) await scrivi({ ...pezzo, cartella }, pezzo.riga, email);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await tokenServizio()}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': tipo || 'application/octet-stream',
      'X-Upload-Content-Length': String(dimensione),
    },
    body: JSON.stringify({ name: nome, parents: [cartella] }),
  });
  const sessione = r.headers.get('Location');
  if (!r.ok || !sessione) throw new Error(`Drive non ha aperto il caricamento (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return sessione;
}

// Un pezzo del file (da inizio, sul totale): restituisce l'id del file quando è arrivato tutto
export async function caricaPezzo(sessione: string, dati: ArrayBuffer, inizio: number, totale: number): Promise<string | undefined> {
  if (!sessione.startsWith('https://www.googleapis.com/upload/drive/')) throw new Error('caricamento non valido');
  const fine = inizio + dati.byteLength - 1;
  const r = await fetch(sessione, { method: 'PUT', headers: { 'Content-Range': `bytes ${inizio}-${fine}/${totale}` }, body: dati });
  if (r.status === 308) return undefined;
  if (!r.ok) throw new Error(`Drive ha rifiutato il file (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()) as { id: string }).id;
}

// File arrivato: diventa lo spartito del pezzo (al posto del precedente, che resta su Drive) o un
// brano in più
export async function registraFile(idPezzo: string, uso: 'spartito' | 'brano', idFile: string, nome: string, email: string) {
  const pezzo = (await repertorio()).find((p) => p.id === idPezzo);
  if (!pezzo) throw new Error('pezzo non trovato');
  const linkFile = `https://drive.google.com/file/d/${idFile}/view`;
  if (uso === 'spartito') await scrivi({ ...pezzo, spartito: linkFile }, pezzo.riga, email);
  else await scrivi({ ...pezzo, brani: [...pezzo.brani, { nome: nome.replace(/ \| /g, ' - '), link: linkFile }] }, pezzo.riga, email);
}

// Endpoint dei file (/admin/repertorio/file, /maestro/repertorio/file), usato dallo script del
// modulo: "inizia" (JSON: pezzo, uso, nome, tipo, dimensione) restituisce un gettone cifrato con
// la sessione di Drive; ogni "pezzo" (corpo = byte, intestazioni x-gettone e x-inizio) la porta
// avanti, e all'ultimo il file si registra nel foglio.
type Gettone = { sessione: string; pezzo: string; uso: 'spartito' | 'brano'; nome: string; totale: number; scade: number };
const json = (corpo: object, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

export async function rispondiFile(request: Request, email: string) {
  try {
    if (request.headers.get('x-azione') === 'inizia') {
      const d = (await request.json()) as { pezzo: string; uso: string; nome: string; tipo: string; dimensione: number };
      const uso = d.uso === 'spartito' ? 'spartito' : 'brano';
      const nome = String(d.nome ?? '').trim().slice(0, 150) || 'file';
      if (!(d.dimensione > 0) || d.dimensione > 200 * 1024 * 1024) return json({ ok: false, errore: 'Il file deve essere tra 1 byte e 200 MB.' }, 400);
      const sessione = await iniziaCaricamento(String(d.pezzo), nome, String(d.tipo ?? ''), d.dimensione, email);
      const g: Gettone = { sessione, pezzo: String(d.pezzo), uso, nome, totale: d.dimensione, scade: Date.now() + 6 * 3600 * 1000 };
      return json({ ok: true, gettone: cifra(g), pezzo: PEZZO_FILE });
    }
    const g = decifra<Gettone>(request.headers.get('x-gettone') ?? undefined);
    if (!g || g.scade < Date.now()) return json({ ok: false, errore: 'Caricamento scaduto: riprova.' }, 400);
    const inizio = Number(request.headers.get('x-inizio'));
    const dati = await request.arrayBuffer();
    if (!Number.isInteger(inizio) || inizio < 0 || dati.byteLength > PEZZO_FILE || inizio + dati.byteLength > g.totale) return json({ ok: false, errore: 'Pezzo del file non valido.' }, 400);
    const idFile = await caricaPezzo(g.sessione, dati, inizio, g.totale);
    if (!idFile) return json({ ok: true, fatto: false });
    // Il nome del brano è quello del file senza estensione
    await registraFile(g.pezzo, g.uso, idFile, g.nome.replace(/\.[a-z0-9]{2,4}$/i, ''), email);
    return json({ ok: true, fatto: true });
  } catch (e) {
    return json({ ok: false, errore: (e as Error).message }, 500);
  }
}
