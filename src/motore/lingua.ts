// Lingue del sito: italiano alla radice, inglese sotto /en/ con gli indirizzi tradotti
// (/en/concerts, /en/the-choir…). La lingua di una pagina si ricava dal suo indirizzo, così i
// componenti non devono riceverla. L'area coristi e l'area Amministrazione sono solo in italiano.
//
// Nei componenti: const { en, l, coro } = contesto(Astro.url, veste)
//   en     → true nella versione inglese, per i testi brevi: {en ? 'Season' : 'Stagione'}
//   l(p)   → collegamento a una pagina nella stessa lingua (e veste): l('/concerti')
//   coro   → i dati del coro nella lingua della pagina (coro.config.ts + coro/coro.en.ts)
import type { Veste } from './aspetto';

export type Lingua = 'it' | 'en';

export const linguaDi = (url: URL): Lingua => (url.pathname === '/en' || url.pathname.startsWith('/en/') ? 'en' : 'it');

export const localeDi = (lingua: Lingua) => (lingua === 'en' ? 'en-GB' : 'it-IT');

// Primo tratto dell'indirizzo: italiano → inglese. Le pagine che non sono qui (area coristi)
// esistono solo in italiano.
const PAGINE_EN: Record<string, string> = {
  concerti: 'concerts',
  ascolta: 'listen',
  'il-coro': 'the-choir',
  'il-maestro': 'conductor',
  'canta-con-noi': 'sing-with-us',
  contatti: 'contact',
  organizzatori: 'for-organisers',
  privacy: 'privacy',
};
const PAGINE_IT = Object.fromEntries(Object.entries(PAGINE_EN).map(([it, en]) => [en, it]));

// "/concerti/2026-10-04-requiem#calendario" → "/en/concerts/2026-10-04-requiem#calendario";
// undefined se la pagina non ha la versione inglese
export function inInglese(percorso: string): string | undefined {
  const [, primo = '', resto = ''] = percorso.match(/^\/([^/#?]*)(.*)$/) ?? [];
  if (!primo) return `/en${resto && resto !== '/' ? resto : ''}` || '/en';
  const tradotto = PAGINE_EN[primo];
  return tradotto ? `/en/${tradotto}${resto}` : undefined;
}

// "/en/concerts/…" → "/concerti/…"
export function inItaliano(percorso: string): string {
  const senza = percorso.replace(/^\/en(?=\/|$)/, '') || '/';
  const [, primo = '', resto = ''] = senza.match(/^\/([^/#?]*)(.*)$/) ?? [];
  if (!primo) return senza;
  return `/${PAGINE_IT[primo] ?? primo}${resto}`;
}

// Collegamento a una pagina interna nella lingua data. In inglese c'è solo la veste del coro,
// quindi nessun prefisso di veste; una pagina senza versione inglese resta in italiano.
export function percorsoInLingua(lingua: Lingua, percorso: string, conVeste: (p: string) => string) {
  if (lingua === 'it') return conVeste(percorso);
  return inInglese(percorso) ?? percorso;
}

// L'altra lingua della pagina corrente, per il selettore IT | EN e per hreflang
export function alternativa(url: URL): { lingua: Lingua; href: string } | undefined {
  const p = url.pathname.replace(/\/$/, '') || '/';
  if (linguaDi(url) === 'en') return { lingua: 'it', href: inItaliano(p) };
  const en = inInglese(p);
  return en ? { lingua: 'en', href: en } : undefined;
}

export type { Veste };
