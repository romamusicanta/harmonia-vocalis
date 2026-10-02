// Il concerto dei moduli dell'area Amministrazione (Nuovo concerto e Modifica): dai campi del
// modulo all'evento del calendario scritto secondo la convenzione di src/motore/concerti.ts, e
// dall'evento ai valori con cui riempire il modulo.
import { daEvento } from '../motore/calendario';
import { comeIcal, type EventoApi } from './operazioni';

export interface Opera { autore: string; opera: string }
export interface Interprete { ruolo: string; nome: string }

export interface DatiConcerto {
  data: string;
  ora: string;
  citta: string;
  sala: string;
  indirizzo: string;
  rassegna: string;
  opere: Opera[];
  organico: string;
  brani: string;
  evidenza: string;
  organizza: string;
  ingresso: string;
  video: string;
  interpreti: Interprete[];
  // Righe "Foto:" e "Locandina:" già nell'evento (file in coro/immagini): si conservano
  rigaFoto: string;
  rigaLocandina: string;
  // "Home: sì/no": si cambia dall'elenco dei concerti, il modulo la conserva
  rigaHome: string;
}

// Etichette che il sito legge come dati, non come interpreti
const riservate = ['organizza', 'ingresso', 'organico', 'brani', 'foto', 'locandina', 'video', 'evidenza', 'home'];
const pulisci = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const tutti = (f: FormData, nome: string) => f.getAll(nome).map(pulisci);

export const haCap = (s: string) => /\b\d{5}\b/.test(s);

// Dai campi del modulo; errore leggibile se manca qualcosa
export function datiDalModulo(f: FormData): DatiConcerto | { errore: string } {
  const data = pulisci(f.get('data'));
  const ora = pulisci(f.get('ora'));
  const citta = pulisci(f.get('citta'));
  const indirizzo = pulisci(f.get('indirizzo'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { errore: 'manca la data' };
  if (ora && !/^\d{2}:\d{2}$/.test(ora)) return { errore: 'ora non valida' };
  if (!citta && !haCap(indirizzo)) return { errore: 'manca la città' };

  const autori = tutti(f, 'autore');
  const opere = tutti(f, 'opera').map((opera, i) => ({ autore: autori[i] ?? '', opera })).filter((o) => o.opera);
  if (!opere.length) return { errore: "manca l'opera" };
  if (opere.some((o, i) => i > 0 && /:/.test(o.opera) && !o.autore)) return { errore: 'un’opera senza autore non può contenere i due punti' };

  const nomi = tutti(f, 'nome');
  const interpreti = tutti(f, 'ruolo').map((ruolo, i) => ({ ruolo, nome: nomi[i] ?? '' })).filter((x) => x.ruolo || x.nome);
  for (const x of interpreti) {
    if (!x.ruolo) return { errore: `manca il ruolo di ${x.nome}` };
    if (riservate.includes(x.ruolo.toLowerCase()) || !/^[\p{L}' ]{2,30}$/u.test(x.ruolo)) return { errore: `"${x.ruolo}" non va bene come ruolo` };
  }

  // Video: l'indirizzo di YouTube o il solo ID
  const indirizzoVideo = pulisci(f.get('video'));
  const video = indirizzoVideo.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/)?.[1] ?? (/^[\w-]{11}$/.test(indirizzoVideo) ? indirizzoVideo : '');
  if (indirizzoVideo && !video) return { errore: 'indirizzo del video non riconosciuto' };

  return {
    data, ora, citta, sala: pulisci(f.get('sala')), indirizzo, rassegna: pulisci(f.get('rassegna')),
    opere, organico: pulisci(f.get('organico')), brani: pulisci(f.get('brani')),
    evidenza: pulisci(f.get('evidenza')), organizza: pulisci(f.get('organizza')), ingresso: pulisci(f.get('ingresso')),
    video, interpreti, rigaFoto: pulisci(f.get('rigaFoto')), rigaLocandina: pulisci(f.get('rigaLocandina')), rigaHome: pulisci(f.get('rigaHome')),
  };
}

// Data e ora locali di Roma più due ore, sempre come ora locale (il fuso lo dice timeZone)
function piuDueOre(data: string, ora: string) {
  const d = new Date(`${data}T${ora}:00Z`);
  d.setUTCHours(d.getUTCHours() + 2);
  return d.toISOString().slice(0, 19);
}

const giornoDopo = (data: string) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// Titolo, luogo, descrizione e date dell'evento
export function corpoEvento(d: DatiConcerto) {
  // Descrizione secondo la convenzione: opere, poi organico e brani (dell'ultima), poi le etichette
  const righe = [
    ...d.opere.map((o) => (o.autore ? `${o.autore} · ${o.opera}` : o.opera)),
    ...[['Organico', d.organico], ['Brani', d.brani], ['Evidenza', d.evidenza], ['Organizza', d.organizza], ['Ingresso', d.ingresso], ['Video', d.video], ['Foto', d.rigaFoto], ['Locandina', d.rigaLocandina], ['Home', d.rigaHome]]
      .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    ...d.interpreti.map((x) => `${x.ruolo}: ${x.nome}`.trim()),
  ];
  // Con il CAP nell'indirizzo il luogo è "Sala, indirizzo" (come quelli scelti da Google Maps) e la
  // città si ricava da lì; altrimenti "Città, sala, indirizzo"
  const luogo = haCap(d.indirizzo) ? [d.sala, d.indirizzo] : [d.citta, d.sala, d.indirizzo];
  return {
    summary: d.rassegna || d.opere[0].opera,
    location: luogo.filter(Boolean).join(', '),
    description: righe.join('\n'),
    start: d.ora ? { dateTime: `${d.data}T${d.ora}:00`, timeZone: 'Europe/Rome' } : { date: d.data },
    end: d.ora ? { dateTime: piuDueOre(d.data, d.ora), timeZone: 'Europe/Rome' } : { date: giornoDopo(d.data) },
  };
}

// "2026-10-04" → "2026-27" (la stagione va da settembre ad agosto, come sul sito)
export function stagione(data: string) {
  const anno = Number(data.slice(0, 4));
  const inizio = Number(data.slice(5, 7)) >= 9 ? anno : anno - 1;
  return `${inizio}-${String(inizio + 1).slice(2)}`;
}

export const nomeCartella = (d: DatiConcerto) =>
  `${d.data} ${(d.citta || d.sala).replace(/\s*\([A-Z]{2}\)$/, '')} – ${d.opere[0].opera}`.replace(/[\/\\]/g, '-');

// Dall'evento ai valori del modulo (Modifica)
export function datiDaEvento(e: EventoApi): DatiConcerto {
  const c = daEvento(comeIcal(e), () => {});
  const righe = (e.description ?? '').split(/\n|<br\s*\/?>/i).map((r) => r.replace(/<[^>]+>/g, '').trim());
  const riga = (etichetta: string) => righe.find((r) => r.toLowerCase().startsWith(`${etichetta}:`))?.slice(etichetta.length + 1).trim() ?? '';
  const programma = c.programma ?? [{ autore: c.autore, opera: c.titolo }];
  const ultima = [...programma].reverse().find((b) => b.organico || b.parti);

  // Luogo: "Città, sala, indirizzo" scritto a mano, oppure "Sala, via, CAP città, Italia" da Maps
  const pezzi = (e.location ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  const conCap = pezzi.findIndex((p) => /^\d{5}\s/.test(p));
  const luogo = conCap < 0
    ? { citta: pezzi[0] ?? '', sala: pezzi[1] ?? '', indirizzo: pezzi.slice(2).join(', ') }
    : { citta: c.luogo ?? '', sala: c.sala ?? '', indirizzo: pezzi.slice(c.sala ? 1 : 0, conCap + 1).join(', ') };

  return {
    data: c.data.slice(0, 10),
    ora: c.data.length > 10 ? c.data.slice(11, 16) : '',
    ...luogo,
    rassegna: c.rassegna ?? '',
    opere: programma.map((b) => ({ autore: b.autore ?? '', opera: b.opera })),
    organico: ultima?.organico ?? '',
    brani: ultima?.parti?.join(', ') ?? '',
    evidenza: c.evidenza ?? '',
    organizza: c.organizza ?? '',
    ingresso: c.ingresso ?? '',
    video: c.video ?? '',
    interpreti: (c.interpreti ?? []).map((i) => ({ ruolo: i.ruolo, nome: [i.nome, i.nota && `(${i.nota})`].filter(Boolean).join(' ') })),
    rigaFoto: riga('foto'),
    rigaLocandina: riga('locandina'),
    rigaHome: riga('home'),
  };
}

// Gli allegati: la locandina ha "locandina" nel nome, la foto principale è ogni altra immagine
// (prima quella con "copertina" nel nome), come li legge src/motore/calendario.ts
export const eLocandina = (titolo: string) => /locandina/i.test(titolo);
