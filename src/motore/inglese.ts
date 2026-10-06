// I concerti e i video in inglese. Nei concerti si traducono i testi descrittivi (titoli delle opere, organico, frase in
// evidenza, ingresso, ruoli e note degli interpreti); restano come sono i nomi propri (persone,
// orchestre, cori, luoghi, rassegne, organizzatori) e i brani, che sono in latino.
//
// In ordine di precedenza:
//   1. le righe dell'evento: "Opera EN:", "Organico EN:" (dopo ogni opera), "Evidenza EN:",
//      "Ingresso EN:", scritte dal modulo del concerto dell'Amministrazione (src/admin/concerto.ts),
//      che le fa tradurre a Claude al salvataggio e le lascia correggere a mano; "Titolo EN:" nelle
//      righe di prima del 6/10/2026
//   2. il dizionario di src/motore/traduzioni.ts, per le voci ricorrenti
//   3. Claude (attraverso l'AI Gateway di Vercel, OIDC) per tutto il resto, una frase alla volta una
//      sola volta: le traduzioni stanno in coro/traduzioni.en.json (nel repository, aggiornato dalle
//      build in locale) e nella cache di build di Vercel. Senza AI Gateway la frase resta in italiano.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generateText, Output } from 'ai';
import { z } from 'astro/zod';
import { archivio, prossimiConcerti } from './concerti';
import { daDizionario, ISTRUZIONI } from './traduzioni';
import { elencoVideo } from './video';
import type { Concerto, Video } from './tipi';
import type { Lingua } from './lingua';

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
const mancanti = [...new Set([...tutti.flatMap(testiDi), ...video.flatMap((v) => [v.titolo, v.sottotitolo]).filter((t): t is string => Boolean(t))])].filter((t) => !daDizionario(t) && !(t in memoria));

if (mancanti.length) {
  try {
    const { output } = await generateText({
      model: 'anthropic/claude-haiku-4.5',
      output: Output.object({ schema: z.object({ traduzioni: z.array(z.object({ it: z.string(), en: z.string() })) }) }) as any,
      system: ISTRUZIONI,
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
    opera: b.en?.opera || (i === 0 && a.titolo) || traduci(b.opera)!,
    organico: b.en?.organico || (i === tutte.length - 1 && a.organico) || traduci(b.organico),
  }));
  return {
    ...c,
    luogo: c.luogo && (CITTA[c.luogo] ?? c.luogo),
    titolo: c.programma?.[0]?.en?.opera || a.titolo || traduci(c.titolo)!,
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
