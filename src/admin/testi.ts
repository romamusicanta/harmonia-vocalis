// Testi del sito (/admin/testi): i valori di adesso, il salvataggio di un gruppo (una pagina) e la
// traduzione inglese automatica dei testi cambiati, con Claude attraverso l'AI Gateway di Vercel
// (OIDC; in locale con VERCEL_OIDC_TOKEN di .env.local). Vedi src/motore/testiSito.ts.
import { generateText, Output } from 'ai';
import { z } from 'astro/zod';
import { coro, coroIn } from '../motore/coro';
import { testo } from '../motore/testi';
import { CAMPI_TESTO, fonteDi, type CampoTesto, type TestiSalvati } from '../motore/testiSito';
import { salvaTestiSuDrive, testiSuDrive } from './operazioni';
import type { Sessione } from './sessione';

const MODELLO = 'anthropic/claude-sonnet-5.5';

// Il testo pubblicato adesso (codice più testi salvati alla build), in una lingua
export function pubblicato(c: CampoTesto, lingua: 'it' | 'en'): string {
  const { fonte, percorso } = fonteDi(c.id);
  if (fonte === 'coro') return String(percorso.split('.').reduce((o: any, k) => o?.[k], lingua === 'en' ? coroIn('en') : coro) ?? '');
  const [nome, campo] = percorso.split('.');
  const t = testo(nome, lingua);
  return campo === 'corpo' ? t.markdown.trim() : String(t.dati[campo] ?? '');
}

// Traduce in inglese i testi dati, tutti in una richiesta
export async function traduci(testi: { id: string; it: string; tipo: CampoTesto['tipo'] }[]): Promise<Record<string, string>> {
  if (!testi.length) return {};
  const { output } = await generateText({
    model: MODELLO,
    output: Output.object({ schema: z.object({ traduzioni: z.array(z.object({ id: z.string(), en: z.string() })) }) }),
    system: `You translate texts of the public website of an Italian amateur choir, the ${coro.nome} of Rome, into natural British English.
Rules:
- Return exactly one item per input text, with the same "id".
- Keep the meaning and the tone; do not add or remove content.
- Keep proper names unchanged: people, choirs, orchestras, places, festivals, institutions, the association "${coro.associazione ?? ''}".
- Musical works: the title usual in English concert programmes; keep Latin and established original titles (Requiem, Stabat Mater, Carmina Burana, Messa di Gloria).
- "Maestro" before the conductor's name stays "Maestro". "M°" becomes "Maestro".
- Markdown texts: keep the Markdown exactly (headings "## ", lists, links, bold, italics, line breaks between paragraphs); translate only the words.
- Keep a single-line text on a single line.`,
    prompt: JSON.stringify(testi.map(({ id, it, tipo }) => ({ id, tipo, it }))),
  });
  return Object.fromEntries(output.traduzioni.filter((t) => testi.some((x) => x.id === t.id) && t.en.trim()).map((t) => [t.id, t.en.trim()]));
}

// Salva i campi di un gruppo dal modulo: per ogni campo il testo italiano e inglese e quelli com'erano
// all'apertura della pagina. Italiano cambiato e inglese no: si traduce. Inglese cambiato a mano: si tiene.
export async function salvaGruppo(s: Sessione, f: FormData, gruppo: string) {
  const campi = CAMPI_TESTO.filter((c) => c.gruppo === gruppo);
  if (!campi.length) throw new Error('Gruppo di testi sconosciuto.');
  const v = (k: string) => String(f.get(k) ?? '').replace(/\r\n/g, '\n').trim();
  const cambiati = campi
    .map((c) => ({ c, it: v(`it:${c.id}`), en: v(`en:${c.id}`), primaIt: v(`prima-it:${c.id}`), primaEn: v(`prima-en:${c.id}`) }))
    .filter((x) => x.it !== x.primaIt || x.en !== x.primaEn);
  if (!cambiati.length) return { salvati: 0, avviso: '' };
  if (cambiati.some((x) => !x.it)) throw new Error('Un testo italiano non può restare vuoto.');
  const daTradurre = cambiati.filter((x) => x.c.traduci !== false && x.it !== x.primaIt && x.en === x.primaEn);
  let tradotti: Record<string, string> = {};
  let avviso = '';
  try {
    tradotti = await traduci(daTradurre.map((x) => ({ id: x.c.id, it: x.it, tipo: x.c.tipo })));
  } catch (e) {
    avviso = `Traduzione automatica non riuscita (${(e as Error).message}): l'inglese dei testi cambiati è rimasto quello di prima, correggilo a mano.`;
  }
  const testi: TestiSalvati = await testiSuDrive(s);
  const ora = new Date().toISOString();
  for (const x of cambiati) {
    const en = x.c.traduci === false ? x.it : tradotti[x.c.id] ?? x.en;
    testi[x.c.id] = { it: x.it, en, modificato: ora, da: s.email };
  }
  await salvaTestiSuDrive(s, testi);
  return { salvati: cambiati.length, tradotti: Object.keys(tradotti).length, avviso };
}
