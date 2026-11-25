// Il modulo di candidatura della pagina Canta con noi (src/area/candidature.ts). Con JavaScript la
// pagina manda il modulo con fetch e riceve JSON; senza, il browser lo invia e torna alla pagina
// sull'ancora della conferma o dell'errore, che il CSS mostra con :target.
// Contro lo spam: un campo nascosto che solo i programmi riempiono, un tempo minimo di compilazione
// (scritto dallo script della pagina) e al più 3 candidature all'ora per indirizzo IP.
// Si scrive solo in produzione: in locale, per provare con il foglio e le email veri, CANDIDATURE_LOCALI=1.
import type { APIRoute } from 'astro';
import { leggiCandidatura, registraCandidatura } from '../../area/candidature';

export const prerender = false;

const invii = new Map<string, number[]>();
const ORA = 60 * 60 * 1000;
const troppi = (ip: string) => {
  const adesso = Date.now();
  const recenti = (invii.get(ip) ?? []).filter((t) => adesso - t < ORA);
  if (recenti.length >= 3) return true;
  recenti.push(adesso);
  invii.set(ip, recenti);
  if (invii.size > 5000) for (const [k, v] of invii) if (v.every((t) => adesso - t >= ORA)) invii.delete(k);
  return false;
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const json = (request.headers.get('accept') ?? '').includes('application/json');
  let f: FormData;
  try { f = await request.formData(); } catch { return new Response('Richiesta non valida', { status: 400 }); }
  const en = f.get('lingua') === 'en';
  const pagina = en ? '/en/sing-with-us' : '/canta-con-noi';
  const risposta = (ok: boolean, errore?: string) => json
    ? new Response(JSON.stringify(ok ? { ok } : { errore }), { status: ok ? 200 : 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
    : new Response(null, { status: 303, headers: { Location: `${pagina}#${ok ? 'candidatura-inviata' : 'candidatura-errore'}` } });

  // Un programma che riempie tutto, o un invio troppo veloce: si finge che sia andato bene
  const iniziato = Number(f.get('iniziato'));
  if (f.get('sito') || (iniziato && Date.now() - iniziato < 4000)) return risposta(true);

  const c = leggiCandidatura(f);
  if ('errore' in c) return risposta(false, c.errore);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress || '';
  if (troppi(ip)) return risposta(false, en ? 'Too many applications from this connection: please try again later or write to us by email.' : 'Troppe candidature da questa connessione: riprova più tardi o scrivici per email.');

  if (process.env.APP_ENV !== 'production' && process.env.CANDIDATURE_LOCALI !== '1') {
    console.log(`[candidature] in locale non si salva niente: ${c.nome}, ${c.eta}, ${c.email}, ${c.registro}`);
    return risposta(true);
  }
  try {
    await registraCandidatura(c);
    return risposta(true);
  } catch {
    return risposta(false, en ? 'Something went wrong and your application was not sent. Please try again in a few minutes or write to us by email.' : 'Qualcosa non ha funzionato e la candidatura non è partita. Riprova tra qualche minuto o scrivici per email.');
  }
};
