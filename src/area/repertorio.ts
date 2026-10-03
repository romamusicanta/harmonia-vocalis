// Repertorio dell'area coristi: scheda "Repertorio" del foglio "Coristi e assenze" (la crea il
// sito), una riga per pezzo, e i file su Drive in Spartiti/<Autore – Titolo>/ (cartella
// DRIVE_CARTELLA_SPARTITI del Drive condiviso). Lo gestiscono i redattori (/admin/repertorio) e il
// Maestro (/maestro/repertorio); scrive tutto l'account di servizio, che sulla cartella Spartiti è
// Gestore contenuti. I coristi aprono i file su Drive: coro@ e maestro@ leggono la cartella.
//
// Per ogni pezzo: spartito, brani cantati separatamente (un file ciascuno), link alle tracce di
// studio per sezione e per tutte le voci, link all'esecuzione di riferimento, note del Maestro.
// I file si caricano a pezzi da 3,5 MB attraverso il sito (le funzioni di Vercel accettano al più
// 4,5 MB per richiesta), con il caricamento "resumable" di Drive (src/area/drive.ts).
import { randomBytes } from 'node:crypto';
import { DRIVE_CARTELLA_SPARTITI } from 'astro:env/server';
import { adesso, cancellaRiga, idScheda, leggiScheda, scriviRiga, SEZIONI } from './dati';
import { cartellaIn, linkFile, rispondiCaricamento } from './drive';

const SCHEDA = 'Repertorio';
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

// Endpoint dei file (/admin/repertorio/file, /maestro/repertorio/file): il file va nella cartella
// del pezzo in Spartiti ("Autore – Titolo", creata se manca) e poi diventa lo spartito del pezzo
// (al posto del precedente, che resta su Drive) o un brano in più, con il nome del file.
export const rispondiFile = (request: Request, email: string) => rispondiCaricamento(request, async (d) => {
  if (!configurato()) throw new Error('manca la variabile DRIVE_CARTELLA_SPARTITI sul server');
  const pezzo = (await repertorio()).find((p) => p.id === String(d.pezzo));
  if (!pezzo) throw new Error('pezzo non trovato');
  const cartella = pezzo.cartella ?? (await cartellaIn(DRIVE_CARTELLA_SPARTITI!, nomeCompleto(pezzo)));
  if (cartella !== pezzo.cartella) await scrivi({ ...pezzo, cartella }, pezzo.riga, email);
  return { cartella, nome: d.nome, dopo: { pezzo: pezzo.id, uso: d.uso === 'spartito' ? 'spartito' : 'brano' } };
}, async (idFile, nome, dopo) => {
  const pezzo = (await repertorio()).find((p) => p.id === dopo.pezzo);
  if (!pezzo) throw new Error('pezzo non trovato');
  if (dopo.uso === 'spartito') await scrivi({ ...pezzo, spartito: linkFile(idFile) }, pezzo.riga, email);
  else await scrivi({ ...pezzo, brani: [...pezzo.brani, { nome: nome.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/ \| /g, ' - '), link: linkFile(idFile) }] }, pezzo.riga, email);
});
