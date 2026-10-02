// I concerti e i video in inglese. Nei concerti si traducono i testi descrittivi (titoli delle opere, organico, frase in
// evidenza, ingresso, ruoli e note degli interpreti); restano come sono i nomi propri (persone,
// orchestre, cori, luoghi, rassegne, organizzatori) e i brani, che sono in latino.
//
// In ordine di precedenza:
//   1. le righe scritte a mano nell'evento: "Titolo EN:", "Evidenza EN:", "Organico EN:", "Ingresso EN:"
//   2. il dizionario qui sotto, per le voci ricorrenti
//   3. Claude (attraverso l'AI Gateway di Vercel, OIDC) per tutto il resto, una frase alla volta una
//      sola volta: le traduzioni stanno in coro/traduzioni.en.json (nel repository, aggiornato dalle
//      build in locale) e nella cache di build di Vercel. Senza AI Gateway la frase resta in italiano.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generateText, Output } from 'ai';
import { z } from 'astro/zod';
import { archivio, prossimiConcerti } from './concerti';
import { elencoVideo } from './video';
import type { Concerto, Video } from './tipi';
import type { Lingua } from './lingua';

const DIZIONARIO: Record<string, string> = {
  // Ruoli
  soprano: 'Soprano', soprani: 'Sopranos', mezzosoprano: 'Mezzo-soprano', contralto: 'Contralto', contralti: 'Contraltos',
  tenore: 'Tenor', tenori: 'Tenors', baritono: 'Baritone', baritoni: 'Baritones', basso: 'Bass', bassi: 'Basses',
  controtenore: 'Countertenor', solisti: 'Soloists', orchestra: 'Orchestra', direttore: 'Conductor',
  'maestro del coro': 'Chorus master', 'maestro dei cori': 'Chorus master', 'maestro di coro': 'Chorus master',
  'canta insieme a noi': 'Also singing', pianoforte: 'Piano', pianoforti: 'Pianos', organo: 'Organ',
  percussioni: 'Percussion', 'voce recitante': 'Narrator', ensemble: 'Ensemble', coro: 'Choir', cori: 'Choirs',
  // Ingresso
  libero: 'Free admission', 'ingresso libero': 'Free admission', 'a offerta libera': 'Free, donations welcome',
  'a offerta': 'Free, donations welcome', 'offerta libera': 'Free, donations welcome',
  // Organico
  'per soli, coro e orchestra': 'for soloists, choir and orchestra',
  'oratorio per soli, coro e orchestra': 'oratorio for soloists, choir and orchestra',
};

// Percorsi dalla cartella del progetto: durante la build il modulo gira da .vercel/output
// Città con un nome inglese diverso
const CITTA: Record<string, string> = { Roma: 'Rome', 'Città del Vaticano': 'Vatican City' };

const FILE = join(process.cwd(), 'coro/traduzioni.en.json');
const CACHE = join(process.cwd(), 'node_modules/.cache/hv/traduzioni.en.json');
const leggi = (f: string): Record<string, string> => {
  try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; } catch { return {}; }
};

// Ogni testo da tradurre, con i suoi campi
const testiDi = (c: Concerto) => [
  c.titolo, c.evidenza, c.ingresso,
  ...(c.programma ?? []).flatMap((b) => [b.opera, b.organico]),
  ...(c.interpreti ?? []).flatMap((i) => [i.ruolo, i.nota]),
].filter((t): t is string => Boolean(t?.trim()));

const tutti = [...(await prossimiConcerti()), ...archivio];
const video = await elencoVideo();
// Il file del repository vince sulla cache: lì si correggono a mano le traduzioni
const memoria: Record<string, string> = { ...leggi(CACHE), ...leggi(FILE) };
const daDizionario = (t: string) => DIZIONARIO[t.trim().toLowerCase()];
const mancanti = [...new Set([...tutti.flatMap(testiDi), ...video.flatMap((v) => [v.titolo, v.sottotitolo]).filter((t): t is string => Boolean(t))])].filter((t) => !daDizionario(t) && !(t in memoria));

if (mancanti.length) {
  try {
    const { output } = await generateText({
      model: 'anthropic/claude-haiku-4.5',
      output: Output.object({ schema: z.object({ traduzioni: z.array(z.object({ it: z.string(), en: z.string() })) }) }) as any,
      system: `You translate short texts from the concert archive of an Italian choir into British English, for its website.
Rules:
- Return exactly one item per input text, with the input copied unchanged in "it".
- Keep proper names unchanged: people, choirs, orchestras, places, festivals, institutions.
- Musical works: use the title usual in English concert programmes. Keep Latin and established original titles (Requiem, Stabat Mater, Carmina Burana, Messa di Gloria, Petite Messe Solennelle, Missa in Angustiis, Messiah). Translate key signatures ("in re minore" → "in D minor") and generic words ("Grande Messa" → "Great Mass", "Concerto per Santa Lucia" → "Concert for Saint Lucy"). Write catalogue numbers as "K. 626", "HWV 56".
- Performer roles: the usual English term (Soprano, Mezzo-soprano, Tenor, Conductor…).
- Video titles and captions: "Concerto · Roma, 11 maggio 2025" → "Concert · Rome, 11 May 2025"; "selezione dei brani del coro" → "selection of the choral movements".
- Short, plain, no added words or quotes.`,
      prompt: JSON.stringify(mancanti),
    });
    for (const { it, en } of (output as { traduzioni: { it: string; en: string }[] }).traduzioni) if (mancanti.includes(it) && en.trim()) memoria[it] = en.trim();
    mkdirSync(dirname(CACHE), { recursive: true });
    writeFileSync(CACHE, JSON.stringify(memoria, null, 1));
    // In locale si aggiorna anche il file del repository, da salvare con il commit
    if (!process.env.VERCEL) writeFileSync(FILE, JSON.stringify(Object.fromEntries(Object.entries(memoria).sort()), null, 1) + '\n');
    console.log(`[inglese] tradotti ${mancanti.length} testi di concerti e video`);
  } catch (err) {
    console.warn(`[inglese] traduzione automatica non riuscita, restano in italiano ${mancanti.length} testi: ${(err as Error).message}`);
  }
}

const traduci = (t: string | undefined) => (t ? (daDizionario(t) ?? memoria[t] ?? t) : t);

// Il concerto nella lingua della pagina
export function concertoIn<T extends Concerto>(c: T, lingua: Lingua): T {
  if (lingua === 'it') return c;
  const a = c.en ?? {};
  const programma = c.programma?.map((b, i, tutte) => ({
    ...b,
    opera: i === 0 && a.titolo ? a.titolo : traduci(b.opera)!,
    organico: i === tutte.length - 1 && a.organico ? a.organico : traduci(b.organico),
  }));
  return {
    ...c,
    luogo: c.luogo && (CITTA[c.luogo] ?? c.luogo),
    titolo: a.titolo ?? traduci(c.titolo)!,
    evidenza: a.evidenza ?? traduci(c.evidenza),
    ingresso: a.ingresso ?? traduci(c.ingresso),
    programma,
    interpreti: c.interpreti?.map((i) => ({ ...i, ruolo: traduci(i.ruolo)!, nota: traduci(i.nota) })),
  };
}

// Il video nella lingua della pagina (titolo e sottotitolo)
export function videoIn<T extends Video | undefined>(v: T, lingua: Lingua): T {
  if (lingua === 'it' || !v) return v;
  return { ...v, titolo: traduci(v.titolo)!, sottotitolo: traduci(v.sottotitolo) };
}
