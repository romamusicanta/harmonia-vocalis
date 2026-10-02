// Legge una locandina e ne ricava i campi del modulo "Nuovo concerto", con un modello che vede le
// immagini (Claude, attraverso l'AI Gateway di Vercel: su Vercel si autentica da solo con OIDC,
// in locale con VERCEL_OIDC_TOKEN di .env.local). I dati tornano al modulo da controllare: non
// si scrive niente finché chi è entrato non preme "Crea il concerto".
import type { APIRoute } from 'astro';
import { generateText, Output } from 'ai';
import { z } from 'astro/zod';
import { coro } from '../../../motore/coro';

export const prerender = false;

// Un ID del catalogo https://ai-gateway.vercel.sh/v1/models: vede le immagini e dà output strutturato
const MODELLO = 'anthropic/claude-sonnet-5.5';

const testo = z.string().nullable();
const schema = z.object({
  locandina: z.boolean().describe("true se l'immagine è la locandina di un concerto"),
  coroCitato: z.boolean().describe(`true se la locandina nomina il ${coro.nome}`),
  data: testo.describe('data del concerto, AAAA-MM-GG'),
  ora: testo.describe("ora d'inizio, HH:MM (24 ore)"),
  citta: testo.describe('città, con la sigla della provincia tra parentesi se non è Roma: "Rignano Flaminio (RM)"'),
  sala: testo.describe('chiesa, basilica, teatro o luogo: "Basilica di San Barnaba"'),
  indirizzo: testo.describe('via e numero, se scritti: "Via Nomentana 349"'),
  rassegna: testo.describe('nome della rassegna, del festival o della stagione, con l’anno se c’è: "Festival di Pasqua 2025"'),
  opere: z.array(z.object({
    autore: testo.describe('iniziali puntate e cognome: "W. A. Mozart", "G. Puccini", "C. Orff"'),
    opera: z.string().describe('titolo dell’opera come in un programma di sala: "Requiem in re minore K 626", "Messa di Gloria"'),
  })).describe('le opere in programma, nell’ordine della locandina'),
  organico: testo.describe('organico dell’ultima opera, se scritto: "per soli, coro e orchestra"'),
  brani: testo.describe('brani o movimenti dell’ultima opera, separati da virgole, solo se elencati'),
  organizza: testo.describe('chi organizza, solo se è scritto in modo esplicito ("organizzato da", "presenta", "a cura di")'),
  ingresso: testo.describe('"libero", "a offerta libera", oppure i prezzi'),
  evidenza: testo.describe('una frase di dedica o occasione: "Nel centenario della morte di Giacomo Puccini"'),
  interpreti: z.array(z.object({
    ruolo: z.string().describe('"Soprano", "Contralto", "Tenore", "Baritono", "Basso", "Orchestra", "Canta insieme a noi", "Direttore", "Maestro del coro", "Pianoforti", "Percussioni"…'),
    nome: z.string(),
  })),
  dubbi: z.array(z.string()).describe('cose incerte o dedotte, in italiano, brevi: "l’anno non è scritto: ricavato dal giorno della settimana"'),
});

const istruzioni = `Sei l'archivista del ${coro.nome}, un coro di Roma diretto dal M° ${coro.maestro.nome}. Ti mostrano la locandina di un concerto: estrai i dati per l'archivio del sito, in italiano.

Regole:
- Scrivi solo quello che c'è sulla locandina. Se un dato manca, null. Non inventare.
- Data: se manca l'anno, deducilo dal giorno della settimana quando c'è (cerca l'anno, tra il 2019 e oggi, in cui quel giorno cade in quel giorno della settimana) e scrivilo nei dubbi; se non si può dedurre, metti l'anno più probabile e scrivilo nei dubbi.
- Interpreti: solisti con il loro registro; l'orchestra con ruolo "Orchestra"; gli altri cori (non il ${coro.nome}) in un'unica voce "Canta insieme a noi", separati da virgole e preceduti da "Coro".
- Il ${coro.nome} e il M° ${coro.maestro.nome} non vanno negli interpreti quando dirige lui: il sito li mostra da soli. Se invece dirige qualcun altro, metti "Direttore" con quel nome (e non il M° ${coro.maestro.nome}).
- Nomi delle persone come sulla locandina, ma con le maiuscole normali ("Antonio Sapio", non "ANTONIO SAPIO").
- Loghi di enti e sponsor non sono organizzatori, a meno che la locandina dica chi organizza.`;

const json = (corpo: object, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  try {
    const f = await request.formData();
    const file = f.get('locandina');
    if (!(file instanceof File) || !/^image\/(jpeg|png|webp)$/.test(file.type)) return json({ ok: false, errore: 'serve un’immagine JPEG, PNG o WebP' }, 400);
    const { output } = await generateText({
      model: MODELLO,
      output: Output.object({ schema }),
      system: istruzioni,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Oggi è il ${new Date().toISOString().slice(0, 10)}. Estrai i dati di questa locandina.` },
          { type: 'file', mediaType: file.type, data: new Uint8Array(await file.arrayBuffer()) },
        ],
      }],
    });
    return json({ ok: true, dati: output });
  } catch (e) {
    const messaggio = (e as Error).message;
    // Senza credito l'AI Gateway serve solo modelli che non leggono le immagini
    if (/free tier|credit|insufficient|budget/i.test(messaggio)) return json({ ok: false, errore: 'la lettura delle locandine richiede credito sull’AI Gateway di Vercel, che è finito o non c’è ancora: avvisa Mario. Intanto i campi si possono riempire a mano.' }, 402);
    return json({ ok: false, errore: `lettura non riuscita: ${messaggio}` }, 500);
  }
};
