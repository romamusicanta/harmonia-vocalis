// Candidature degli aspiranti coristi (dal 25/11/2026, richiesta di Mario): il modulo della pagina
// Canta con noi (src/pagine/CantaConNoi.astro) le manda a /api/candidatura. Ognuna diventa una riga
// della scheda "Candidature" del foglio "Coristi e assenze" (la crea il sito), un'email a info@ con il
// «Rispondi» verso chi si candida, e un'email di conferma a chi si candida (senza il testo che ha
// scritto, perché il modulo è pubblico e nessuno possa usarlo per spedire messaggi a terzi).
// Le righe più vecchie di 12 mesi le cancella il riepilogo notturno (/api/statistiche), come dice
// l'informativa privacy.
import { FOGLIO_CORISTI_ID } from 'astro:env/server';
import { coro } from '../motore/coro';
import { google } from './servizio';
import { idScheda, leggiScheda } from './dati';
import { postaConfigurata, spedisci } from './posta';
import { ETA_MINIMA, MAGGIORE_ETA, REGISTRI } from '../motore/candidatura';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCHEDA = 'Candidature';
const INTESTAZIONI = ['Ricevuta il', 'Nome e cognome', 'Età', 'Email', 'Registro', 'Esperienze corali', 'Perché vuole entrare', 'Lingua', 'Stato', 'Note'];
const MESI_CONSERVATE = 12;

export interface Candidatura {
  nome: string;
  eta: number;
  email: string;
  registro: string;
  esperienze: string;
  motivazione: string;
  lingua: 'it' | 'en';
}

const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
const pulito = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);

// Legge e controlla i campi del modulo: la candidatura, oppure il messaggio d'errore
export function leggiCandidatura(f: FormData): Candidatura | { errore: string } {
  const lingua = f.get('lingua') === 'en' ? 'en' : 'it';
  const en = lingua === 'en';
  const nome = pulito(f.get('nome'), 100).replace(/\s+/g, ' ');
  const eta = Number(pulito(f.get('eta'), 3));
  const email = pulito(f.get('email'), 200).toLowerCase();
  const registro = REGISTRI.find((r) => r.it === f.get('registro'))?.it;
  const esperienze = pulito(f.get('esperienze'), 3000);
  const motivazione = pulito(f.get('motivazione'), 3000);
  if (!nome) return { errore: en ? 'Please write your name and surname.' : 'Scrivi nome e cognome.' };
  if (!Number.isInteger(eta) || eta < ETA_MINIMA || eta > 99) return { errore: en ? 'Please write your age.' : 'Scrivi la tua età.' };
  if (!EMAIL.test(email)) return { errore: en ? 'The email address does not look right.' : 'L’indirizzo email non sembra giusto.' };
  if (!registro) return { errore: en ? 'Please choose your voice type.' : 'Scegli il tuo registro vocale.' };
  if (!esperienze) return { errore: en ? 'Please tell us about your previous choral experience.' : 'Raccontaci le tue esperienze corali precedenti.' };
  if (!motivazione) return { errore: en ? 'Please tell us why you would like to join.' : 'Raccontaci perché vorresti entrare nel coro.' };
  if (!f.get('impegno')) return { errore: en ? 'Please confirm the commitment statement.' : 'Conferma la dichiarazione di impegno.' };
  if (!f.get('privacy')) return { errore: en ? 'Please accept the privacy notice.' : 'Accetta l’informativa privacy.' };
  return { nome, eta, email, registro, esperienze, motivazione, lingua };
}

const adesso = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
};

async function salvaNelFoglio(c: Candidatura, quando: string) {
  await idScheda(SCHEDA, INTESTAZIONI);
  // RAW: niente viene interpretato come formula o numero (un testo che comincia con «=» resta testo)
  await google(`${SHEETS}/${FOGLIO_CORISTI_ID}/values/${encodeURIComponent(`${SCHEDA}!A:J`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: [[quando, c.nome, c.eta, c.email, c.registro, c.esperienze, c.motivazione, c.lingua, 'Da contattare', '']] }),
  });
}

function testoPerIlCoro(c: Candidatura, quando: string) {
  return [
    `Nuova candidatura dal sito (pagina Canta con noi), ricevuta il ${quando.slice(8, 10)}/${quando.slice(5, 7)}/${quando.slice(0, 4)} alle ${quando.slice(11)}.`,
    '',
    `Nome e cognome: ${c.nome}`,
    `Età: ${c.eta}${c.eta < MAGGIORE_ETA ? ' (minorenne: serve la delega di chi ne fa le veci)' : ''}`,
    `Email: ${c.email}`,
    `Registro vocale: ${c.registro}`,
    `Lingua del modulo: ${c.lingua === 'en' ? 'inglese' : 'italiano'}`,
    '',
    'Esperienze corali:',
    c.esperienze,
    '',
    'Perché vorrebbe entrare in Harmonia Vocalis:',
    c.motivazione,
    '',
    '—',
    `Rispondendo a questa email si scrive direttamente a ${c.email}. La candidatura è anche nella scheda «${SCHEDA}» del foglio «Coristi e assenze».`,
  ].join('\n');
}

function conferma(c: Candidatura) {
  return c.lingua === 'en'
    ? {
        oggetto: `Your application to ${coro.nome.replace(/^Coro\s+/i, '')}`,
        testo: [
          'Hello,',
          '',
          `thank you for applying to ${coro.nome.replace(/^Coro\s+/i, '')}: we have received your application.`,
          'We will write to you within a few days to arrange a short, informal audition with the Conductor.',
          '',
          `If you have any questions, write to ${coro.email}.`,
          '',
          coro.nome.replace(/^Coro\s+/i, ''),
          'https://romamusicanta.org/en/sing-with-us',
          '',
          'If you did not send this application, you can ignore this email.',
        ].join('\n'),
      }
    : {
        oggetto: `La tua candidatura al ${coro.nome}`,
        testo: [
          'Ciao,',
          '',
          `grazie per la tua candidatura al ${coro.nome}: l’abbiamo ricevuta.`,
          'Ti scriveremo entro pochi giorni per fissare una breve audizione, informale, con il Maestro.',
          '',
          `Per qualunque domanda scrivi a ${coro.email}.`,
          '',
          `${coro.nome}`,
          'https://romamusicanta.org/canta-con-noi',
          '',
          'Se non hai inviato tu questa candidatura, puoi ignorare questa email.',
        ].join('\n'),
      };
}

// Salva e spedisce: basta che vada a buon fine il foglio o l'email al coro, perché la candidatura
// non vada persa; altrimenti errore
export async function registraCandidatura(c: Candidatura) {
  const quando = adesso();
  const [foglio, posta] = await Promise.allSettled([
    FOGLIO_CORISTI_ID ? salvaNelFoglio(c, quando) : Promise.reject(new Error('manca FOGLIO_CORISTI_ID')),
    postaConfigurata() ? spedisci(coro.email, `Candidatura: ${c.nome} (${c.registro.toLowerCase()})`, testoPerIlCoro(c, quando), c.email) : Promise.reject(new Error('posta non configurata')),
  ]);
  if (foglio.status === 'rejected') console.error(`[candidature] foglio non scritto: ${(foglio.reason as Error).message}`);
  if (posta.status === 'rejected') console.error(`[candidature] email al coro non spedita: ${(posta.reason as Error).message}`);
  if (foglio.status === 'rejected' && posta.status === 'rejected') throw new Error('candidatura non registrata');
  if (postaConfigurata()) {
    const { oggetto, testo } = conferma(c);
    await spedisci(c.email, oggetto, testo, coro.email).catch((e) => console.error(`[candidature] conferma non spedita: ${(e as Error).message}`));
  }
}

// Riepilogo notturno: via le candidature più vecchie di 12 mesi (le righe sono in ordine di arrivo)
export async function pulisciCandidature() {
  if (!FOGLIO_CORISTI_ID) return 0;
  let id: number;
  try { id = await idScheda(SCHEDA); } catch { return 0; }
  const limite = new Date();
  limite.setMonth(limite.getMonth() - MESI_CONSERVATE);
  const soglia = limite.toISOString().slice(0, 10);
  const righe = await leggiScheda(SCHEDA);
  const vecchie = righe.filter((r) => r['Ricevuta il'] && r['Ricevuta il'].slice(0, 10) < soglia);
  // Dal fondo, perché cancellare una riga sposta quelle sotto
  const richieste = vecchie.map((r) => r.riga).sort((a, b) => b - a).map((riga) => ({ deleteDimension: { range: { sheetId: id, dimension: 'ROWS', startIndex: riga - 1, endIndex: riga } } }));
  if (richieste.length) await google(`${SHEETS}/${FOGLIO_CORISTI_ID}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: richieste }) });
  return richieste.length;
}
