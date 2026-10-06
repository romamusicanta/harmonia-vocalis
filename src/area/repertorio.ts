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
import { spiegaTesto } from './errori';

const SCHEDA = 'Repertorio';
export const STATI = ['In studio', 'In repertorio'] as const;
const TRACCE = [...SEZIONI, 'Tutte le voci'];
const COLONNE = ['ID', 'Autore', 'Titolo', 'Stato', 'Spartito', 'Brani separati', ...TRACCE.map((t) => `Tracce ${t}`), 'Esecuzione di riferimento', 'Note del Maestro', 'Cartella', 'Aggiornato il', 'Aggiornato da'];

export const configurato = () => Boolean(DRIVE_CARTELLA_SPARTITI);

// altri: i nomi che il brano aveva prima di essere rinominato, perché le prove e le convocazioni
// che lo nominano così lo ritrovino
export interface FileBrano { nome: string; link: string; altri?: string[] }
export interface Pezzo {
  riga: number;
  id: string;
  autore: string;
  titolo: string;
  stato: string;
  spartito?: string;                 // link a Drive
  brani: FileBrano[];                // nel foglio: una riga per brano, "Nome | link" (poi " | " e i nomi di prima)
  tracce: { sezione: string; link: string }[];
  esecuzione?: string;
  note: string;
  cartella?: string;                 // id della cartella su Drive
  aggiornato: string;
}

export const sezioniTracce = TRACCE;
export const nomeCompleto = (p: Pick<Pezzo, 'autore' | 'titolo'>) => [p.autore, p.titolo].filter(Boolean).join(' – ');

// Prove e convocazioni nominano i pezzi con "Autore – Titolo" (il solo titolo non basta: due
// Magnificat di autori diversi); i nomi scritti prima del 3/10/2026, con il solo titolo, valgono
// ancora. Si confrontano senza spazi, punteggiatura e accenti ("C.P.E. Bach" = "C. P. E. Bach").
const confrontabile = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export function trovaPezzo<T extends Pick<Pezzo, 'autore' | 'titolo'>>(pezzi: T[], nome: string): T | undefined {
  const n = confrontabile(nome);
  return pezzi.find((p) => confrontabile(nomeCompleto(p)) === n) ?? pezzi.find((p) => confrontabile(p.titolo) === n);
}

// Un brano di un'opera (uno dei "brani separati" del pezzo, con il suo spartito) si nomina
// "Autore – Titolo › Brano": in una prova si può chiedere di preparare solo quello (dal 6/10/2026)
export const SEPARATORE_BRANO = ' › ';
export const nomeBrano = (p: Pick<Pezzo, 'autore' | 'titolo'>, b: Pick<FileBrano, 'nome'>) => `${nomeCompleto(p)}${SEPARATORE_BRANO}${b.nome}`;
export function trovaVoce<T extends Pick<Pezzo, 'autore' | 'titolo' | 'brani'>>(pezzi: T[], nome: string): { pezzo: T; brano?: FileBrano } | undefined {
  const pezzo = trovaPezzo(pezzi, nome);
  if (pezzo) return { pezzo };
  const i = nome.lastIndexOf(SEPARATORE_BRANO.trim());
  if (i < 0) return undefined;
  const opera = trovaPezzo(pezzi, nome.slice(0, i));
  const b = confrontabile(nome.slice(i + 1));
  const brano = opera?.brani.find((x) => [x.nome, ...(x.altri ?? [])].some((n) => confrontabile(n) === b));
  return opera && brano ? { pezzo: opera, brano } : undefined;
}

const aBrani = (v = '') => v.split('\n').map((r) => r.split(' | ')).filter(([, l]) => l).map(([nome, link, ...altri]) => ({ nome: nome.trim(), link: link.trim(), altri: altri.map((a) => a.trim()).filter(Boolean) }));
const daBrani = (b: FileBrano[]) => b.map((x) => [x.nome, x.link, ...(x.altri ?? [])].join(' | ')).join('\n');

// L'autore si scrive "W. A. Mozart" (iniziali puntate, poi il cognome), oppure "Anonimo" o
// "Tradizionale": si ordina per cognome, poi per iniziali, poi per titolo
const INIZIALI = /^((?:\p{Lu}\.\s*)+)/u;
function cognomeEIniziali(autore: string) {
  const a = autore.trim();
  const iniziali = a.match(INIZIALI)?.[1] ?? '';
  return { cognome: a.slice(iniziali.length).trim() || a, iniziali: iniziali.replace(/\s+/g, '') };
}
const confronta = (x: string, y: string) => x.localeCompare(y, 'it', { sensitivity: 'base' });
const perAutore = (a: Pick<Pezzo, 'autore' | 'titolo'>, b: Pick<Pezzo, 'autore' | 'titolo'>) => {
  const ka = cognomeEIniziali(a.autore), kb = cognomeEIniziali(b.autore);
  return confronta(ka.cognome, kb.cognome) || confronta(ka.iniziali, kb.iniziali) || confronta(a.titolo, b.titolo);
};
// "W.A.  Mozart" → "W. A. Mozart"
const scriviAutore = (v: string) => v.trim().replace(/\s+/g, ' ').replace(/(\p{Lu})\.(?=\S)/gu, '$1. ');

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
    .sort(perAutore);
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

// Modulo del pezzo (POST): azione=salva (id per modificare), cancella, togli-brano (indice),
// rinomina-brano (indice, nome)
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
  if (azione === 'rinomina-brano' && esistente) {
    const i = Number(f.get('indice'));
    const brano = esistente.brani[i];
    if (!brano) return { ok: false, messaggio: 'Brano non trovato: ricarica la pagina.', id: esistente.id };
    // " | " separa i campi nel foglio, "›" separa opera e brano nelle prove
    const nome = String(f.get('nome') ?? '').replace(/\s*\|\s*/g, ' - ').replace(/›/g, '-').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!nome) return { ok: false, messaggio: 'Manca il nome del brano.', id: esistente.id };
    if (esistente.brani.some((b, j) => j !== i && confrontabile(b.nome) === confrontabile(nome))) return { ok: false, messaggio: `C'è già un brano «${nome}» in questo pezzo.`, id: esistente.id };
    // Il nome di prima resta tra quelli che il brano ha avuto: le prove che lo nominano lo ritrovano
    const altri = [...(brano.altri ?? []), brano.nome].filter((n, k, t) => confrontabile(n) !== confrontabile(nome) && t.findIndex((m) => confrontabile(m) === confrontabile(n)) === k);
    const brani = esistente.brani.map((b, j) => (j === i ? { ...b, nome, altri } : b));
    await scrivi({ ...esistente, brani }, esistente.riga, email);
    return { ok: true, messaggio: `Brano rinominato: «${nome}».`, id: esistente.id };
  }
  if (azione === 'togli-traccia' && esistente) {
    const sezione = String(f.get('sezione') ?? '');
    await scrivi({ ...esistente, tracce: esistente.tracce.filter((t) => t.sezione !== sezione) }, esistente.riga, email);
    return { ok: true, messaggio: `Traccia «${sezione}» tolta dal pezzo (il file resta su Drive).`, id: esistente.id };
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
    autore: scriviAutore(String(f.get('autore') ?? '')).slice(0, 100),
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
  return { ok: true, messaggio: esistente ? `«${nomeCompleto(pezzo)}» aggiornato.` : `«${nomeCompleto(pezzo)}» aggiunto al repertorio.`, id: pezzo.id };
}

// Il Maestro scrive solo le sue note sull'esecuzione di un pezzo (/maestro/repertorio)
export async function salvaNote(f: FormData, email: string): Promise<{ ok: boolean; messaggio: string }> {
  const pezzo = (await repertorio()).find((p) => p.id === String(f.get('id') ?? ''));
  if (!pezzo) return { ok: false, messaggio: 'Pezzo non trovato: ricarica la pagina.' };
  const note = String(f.get('note') ?? '').replace(/\r\n/g, '\n').trim().slice(0, 4000);
  await scrivi({ ...pezzo, note }, pezzo.riga, email);
  return { ok: true, messaggio: `Note su «${nomeCompleto(pezzo)}» salvate.` };
}

// Per le pagine: esegue l'azione e restituisce dove tornare
export async function dopoIlModulo(request: Request, email: string, percorso: string) {
  const f = await request.formData();
  const r = await gestisci(f, email).catch((e) => ({ ok: false, messaggio: `Non è stato possibile salvare. ${spiegaTesto(e)}`, id: undefined }));
  const p = new URLSearchParams({ esito: r.messaggio, ok: r.ok ? '1' : '0' });
  const id = r.id ?? (f.get('azione') !== 'cancella' ? String(f.get('id') ?? '') : '');
  // Dopo "Salva" si torna all'elenco (a un pezzo nuovo si propone di caricare i file); dopo "Togli"
  // di un file, o se il salvataggio non è riuscito, si resta nel modulo
  if (f.get('azione') === 'salva' && r.ok) {
    if (!f.get('id') && id) p.set('file', id);
    return `${percorso}?${p}${id ? `#p-${id}` : ''}`;
  }
  if (id) p.set('modifica', id);
  return `${percorso}?${p}`;
}

// ——— File su Drive ———

// Endpoint dei file (/admin/repertorio/file, /maestro/repertorio/file): il file va nella cartella
// del pezzo in Spartiti ("Autore – Titolo", creata se manca) e poi diventa lo spartito del pezzo
// (al posto del precedente, che resta su Drive), un brano in più, con il nome del file, o la traccia
// di studio di una sezione (al posto del link o del file di prima).
const nomeTraccia = (sezione: string, nome: string) => `Traccia ${sezione} – ${nome}`;
export const rispondiFile = (request: Request, email: string) => rispondiCaricamento(request, async (d) => {
  if (!configurato()) throw new Error('manca la variabile DRIVE_CARTELLA_SPARTITI sul server');
  const pezzo = (await repertorio()).find((p) => p.id === String(d.pezzo));
  if (!pezzo) throw new Error('pezzo non trovato');
  const cartella = pezzo.cartella ?? (await cartellaIn(DRIVE_CARTELLA_SPARTITI!, nomeCompleto(pezzo)));
  if (cartella !== pezzo.cartella) await scrivi({ ...pezzo, cartella }, pezzo.riga, email);
  if (d.uso === 'traccia') {
    const sezione = TRACCE.find((s) => s === d.sezione);
    if (!sezione) throw new Error('sezione della traccia non valida');
    return { cartella, nome: nomeTraccia(sezione, String(d.nome)), dopo: { pezzo: pezzo.id, uso: 'traccia', sezione } };
  }
  return { cartella, nome: d.nome, dopo: { pezzo: pezzo.id, uso: d.uso === 'spartito' ? 'spartito' : 'brano' } };
}, async (idFile, nome, dopo) => {
  const pezzo = (await repertorio()).find((p) => p.id === dopo.pezzo);
  if (!pezzo) throw new Error('pezzo non trovato');
  if (dopo.uso === 'traccia') {
    const tracce = TRACCE.map((sezione) => ({ sezione, link: sezione === dopo.sezione ? linkFile(idFile) : pezzo.tracce.find((t) => t.sezione === sezione)?.link ?? '' })).filter((t) => t.link);
    await scrivi({ ...pezzo, tracce }, pezzo.riga, email);
  } else if (dopo.uso === 'spartito') await scrivi({ ...pezzo, spartito: linkFile(idFile) }, pezzo.riga, email);
  else await scrivi({ ...pezzo, brani: [...pezzo.brani, { nome: nome.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/ \| /g, ' - '), link: linkFile(idFile) }] }, pezzo.riga, email);
});
