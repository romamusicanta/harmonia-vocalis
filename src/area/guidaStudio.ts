// Guida allo studio (dal 13/11/2026, testo del presidente): l'elenco commentato dei siti
// e dei canali YouTube con le tracce per lo studio delle parti, scritto dal presidente. I coristi lo
// leggono in /area/studio, a cui portano il riquadro in cima al Repertorio e, nella scheda di ogni
// pezzo, il nome del sito accanto a ogni gruppo di tracce che ne viene (Choralia, CyberBass…).
// I redattori lo cambiano da Area redattori → Repertorio → Guida allo studio: il testo va nel file
// «Guida allo studio.md» della cartella Spartiti del Drive condiviso (account di servizio) e vale
// subito; senza il file, o se Drive non risponde, quello del codice, coro/guida-studio.md.
//
// Formato del testo: prima del primo «## » l'introduzione, a paragrafi; «## Titolo» apre un gruppo,
// «### Nome» un sito, con sotto l'indirizzo sulla prima riga, poi la descrizione e, facoltativa, una
// riga «Immagine: /percorso». Grassetto con **frase**, come negli altri testi dei redattori.
import { DRIVE_CARTELLA_SPARTITI } from 'astro:env/server';
import iniziale from '../../coro/guida-studio.md?raw';
import { google, tokenServizio } from './servizio';

export const TESTO_INIZIALE = iniziale.trim();
const NOME_FILE = 'Guida allo studio.md';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const DURATA = 60 * 1000;

export interface Sito { id: string; nome: string; link: string; descrizione: string; immagine?: string }
export interface Guida { introduzione: string; gruppi: { titolo: string; siti: Sito[] }[] }

const semplice = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const ancora = (nome: string) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function leggiGuida(testo: string): Guida {
  const guida: Guida = { introduzione: '', gruppi: [] };
  const intro: string[] = [];
  let sito: (Sito & { righe: string[] }) | undefined;
  const chiudi = () => {
    if (!sito) return;
    const righe = sito.righe;
    while (righe.length && !righe[0].trim()) righe.shift();
    if (/^(https?:\/\/|www\.)\S+$/.test(righe[0]?.trim() ?? '')) sito.link = righe.shift()!.trim().replace(/^www\./, 'https://www.');
    const img = righe.findIndex((r) => /^immagine:/i.test(r.trim()));
    if (img >= 0) sito.immagine = righe.splice(img, 1)[0].trim().replace(/^immagine:\s*/i, '');
    sito.descrizione = righe.join('\n').trim();
    const { righe: _, ...pulito } = sito;
    guida.gruppi.at(-1)!.siti.push(pulito);
    sito = undefined;
  };
  for (const riga of testo.replace(/\r\n/g, '\n').split('\n')) {
    const h3 = riga.match(/^###\s+(.+)/);
    const h2 = !h3 && riga.match(/^##\s+(.+)/);
    if (h2) { chiudi(); guida.gruppi.push({ titolo: h2[1].trim(), siti: [] }); continue; }
    if (h3) {
      chiudi();
      if (!guida.gruppi.length) guida.gruppi.push({ titolo: '', siti: [] });
      sito = { id: ancora(h3[1]), nome: h3[1].trim(), link: '', descrizione: '', righe: [] };
      continue;
    }
    if (sito) sito.righe.push(riga);
    else if (!guida.gruppi.length) intro.push(riga);
  }
  chiudi();
  guida.introduzione = intro.join('\n').trim();
  return guida;
}

// Il sito della guida da cui viene un gruppo di tracce: il nome del sito nel titolo del gruppo
// («Kyrie – Choralia», «CyberBass – tutte le voci») oppure, fuori da YouTube, lo stesso dominio
// del link della traccia
export function sitoDi(guida: Guida, titolo: string, link = ''): Sito | undefined {
  const siti = guida.gruppi.flatMap((g) => g.siti);
  const t = semplice(titolo);
  const dominio = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const d = dominio(link);
  return siti.find((s) => semplice(s.nome).length > 3 && t.includes(semplice(s.nome)))
    ?? (d && !d.includes('youtube') && !d.includes('youtu.be') ? siti.find((s) => dominio(s.link) === d) : undefined);
}

// ——— Lettura e scrittura su Drive ———

let inMemoria: { testo: string; letto: number } | undefined;

async function fileSuDrive(): Promise<string | undefined> {
  const q = `'${DRIVE_CARTELLA_SPARTITI}' in parents and name = '${NOME_FILE}' and trashed = false`;
  const p = new URLSearchParams({ q, fields: 'files(id)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
  return (await google<{ files: { id: string }[] }>(`${DRIVE}/files?${p}`)).files[0]?.id;
}

// Il testo della guida: quello salvato su Drive (tenuto un minuto), altrimenti quello del codice
export async function testoGuida(): Promise<{ testo: string; salvato: boolean }> {
  if (!DRIVE_CARTELLA_SPARTITI) return { testo: TESTO_INIZIALE, salvato: false };
  if (inMemoria && Date.now() - inMemoria.letto < DURATA) return { testo: inMemoria.testo, salvato: true };
  try {
    const id = await fileSuDrive();
    if (!id) return { testo: TESTO_INIZIALE, salvato: false };
    const r = await fetch(`${DRIVE}/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${await tokenServizio()}` } });
    if (!r.ok) throw new Error(`Drive (${r.status})`);
    const testo = (await r.text()).trim();
    inMemoria = { testo, letto: Date.now() };
    return { testo, salvato: true };
  } catch (e) {
    console.warn('[guida]', (e as Error).message);
    return { testo: inMemoria?.testo ?? TESTO_INIZIALE, salvato: Boolean(inMemoria) };
  }
}

export const guida = async () => leggiGuida((await testoGuida()).testo);

// Salva il testo nel file su Drive (lo stesso, così resta la sua storia), oppure lo crea
export async function salvaGuida(testo: string) {
  if (!DRIVE_CARTELLA_SPARTITI) throw new Error('manca la variabile DRIVE_CARTELLA_SPARTITI sul server');
  const pulito = testo.replace(/\r\n/g, '\n').trim();
  if (!pulito) throw new Error('La guida non può restare vuota.');
  if (!leggiGuida(pulito).gruppi.some((g) => g.siti.length)) throw new Error('Nella guida non c\'è nessun sito: ogni sito comincia con una riga «### Nome».');
  const id = (await fileSuDrive()) ?? (await google<{ id: string }>(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
    method: 'POST', body: JSON.stringify({ name: NOME_FILE, mimeType: 'text/markdown', parents: [DRIVE_CARTELLA_SPARTITI] }),
  })).id;
  const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${await tokenServizio()}`, 'Content-Type': 'text/markdown; charset=UTF-8' },
    body: pulito,
  });
  if (!r.ok) throw new Error(`Drive non ha salvato la guida (${r.status}): ${(await r.text()).slice(0, 200)}`);
  inMemoria = { testo: pulito, letto: Date.now() };
}
