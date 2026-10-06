// Il concerto dei moduli dell'area Amministrazione (Nuovo concerto e Modifica): dai campi del
// modulo all'evento del calendario scritto secondo la convenzione di src/motore/concerti.ts, e
// dall'evento ai valori con cui riempire il modulo. Il modulo è l'unico posto in cui si scrivono i
// dati di un concerto del sito pubblico, traduzioni inglesi comprese (dal 6/10/2026).
import { generateText, Output } from 'ai';
import { z } from 'astro/zod';
import { daEvento } from '../motore/calendario';
import type { Brano } from '../motore/tipi';
import { daDizionario, ISTRUZIONI } from '../motore/traduzioni';
import traduzioniFatte from '../../coro/traduzioni.en.json';
import { comeIcal, type EventoApi } from './operazioni';

// Ogni opera con il suo organico e i suoi brani, e le traduzioni inglesi di titolo e organico
export interface Opera { autore: string; opera: string; operaEn: string; organico: string; organicoEn: string; brani: string }
export interface Interprete { ruolo: string; nome: string }

export interface DatiConcerto {
  data: string;
  ora: string;
  dataIncerta: boolean; // si sa solo l'anno: il sito mostra solo quello
  citta: string;
  sala: string;
  indirizzo: string;
  rassegna: string;
  opere: Opera[];
  evidenza: string;
  evidenzaEn: string;
  organizza: string;
  ingresso: string;
  ingressoEn: string;
  video: string;
  interpreti: Interprete[];
  // Righe "Foto:" e "Locandina:" già nell'evento (file in coro/immagini): si conservano
  rigaFoto: string;
  rigaLocandina: string;
  // "Home: sì/no": si cambia dall'elenco dei concerti, il modulo la conserva
  rigaHome: string;
  // Italiano e inglese com'erano all'apertura del modulo, per capire cosa ritradurre
  prima: Record<string, { it: string; en: string }>;
}

// Etichette che il sito legge come dati, non come interpreti
const riservate = ['organizza', 'ingresso', 'organico', 'brani', 'foto', 'locandina', 'video', 'evidenza', 'home', 'data', 'opera'];
// e ogni ruolo che finisce con " EN" (traduzioni scritte a mano)
const pulisci = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const tutti = (f: FormData, nome: string) => f.getAll(nome).map(pulisci);

export const haCap = (s: string) => /\b\d{5}\b/.test(s);

// Dai campi del modulo; errore leggibile se manca qualcosa
export function datiDalModulo(f: FormData): DatiConcerto | { errore: string } {
  const data = pulisci(f.get('data'));
  const ora = pulisci(f.get('ora'));
  const citta = pulisci(f.get('citta'));
  const indirizzo = pulisci(f.get('indirizzo'));
  const dataIncerta = f.get('dataIncerta') === 'on';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { errore: 'manca la data' };
  if (ora && !/^\d{2}:\d{2}$/.test(ora)) return { errore: 'ora non valida' };
  if (!citta && !haCap(indirizzo)) return { errore: 'manca la città' };

  const [autori, operaEn, organico, organicoEn, brani] = ['autore', 'operaEn', 'organico', 'organicoEn', 'brani'].map((n) => tutti(f, n));
  const opere = tutti(f, 'opera')
    .map((opera, i) => ({ autore: autori[i] ?? '', opera, operaEn: operaEn[i] ?? '', organico: organico[i] ?? '', organicoEn: organicoEn[i] ?? '', brani: brani[i] ?? '' }))
    .filter((o) => o.opera);
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
    data, ora: dataIncerta ? '' : ora, dataIncerta, citta, sala: pulisci(f.get('sala')), indirizzo, rassegna: pulisci(f.get('rassegna')),
    opere,
    evidenza: pulisci(f.get('evidenza')), evidenzaEn: pulisci(f.get('evidenzaEn')), organizza: pulisci(f.get('organizza')),
    ingresso: pulisci(f.get('ingresso')), ingressoEn: pulisci(f.get('ingressoEn')),
    video, interpreti, rigaFoto: pulisci(f.get('rigaFoto')), rigaLocandina: pulisci(f.get('rigaLocandina')), rigaHome: pulisci(f.get('rigaHome')),
    prima: (() => { try { return JSON.parse(String(f.get('prima') ?? '{}')); } catch { return {}; } })(),
  };
}

// I testi da tradurre del concerto, con la chiave che li ritrova in "prima"
const campiInglesi = (d: DatiConcerto) => [
  ...d.opere.flatMap((o, i) => [
    { chiave: `opera-${i}`, it: o.opera, en: o.operaEn, metti: (v: string) => (o.operaEn = v) },
    { chiave: `organico-${i}`, it: o.organico, en: o.organicoEn, metti: (v: string) => (o.organicoEn = v) },
  ]),
  { chiave: 'evidenza', it: d.evidenza, en: d.evidenzaEn, metti: (v: string) => (d.evidenzaEn = v) },
  { chiave: 'ingresso', it: d.ingresso, en: d.ingressoEn, metti: (v: string) => (d.ingressoEn = v) },
];

// L'inglese scritto nell'evento, per aggiornare il modulo dopo il salvataggio
export const ingleseScritto = (d: DatiConcerto) => ({
  operaEn: d.opere.map((o) => o.operaEn), organicoEn: d.opere.map((o) => o.organicoEn), evidenzaEn: d.evidenzaEn, ingressoEn: d.ingressoEn,
  prima: Object.fromEntries(campiInglesi(d).map((x) => [x.chiave, { it: x.it, en: x.en }])),
});

// Traduzione già nota: il dizionario delle voci ricorrenti, poi quelle fatte finora dalla build
const giaTradotto = (it: string) => daDizionario(it) ?? (traduzioniFatte as Record<string, string>)[it];

// Prima di salvare: l'inglese vuoto si scrive, e così quello di un testo italiano cambiato se
// l'inglese è rimasto com'era; l'inglese corretto a mano resta. Con Claude attraverso l'AI Gateway
// (OIDC, come "Leggi la locandina"); se non risponde l'inglese resta vuoto e lo traduce la build.
export async function completaInglese(d: DatiConcerto): Promise<string | undefined> {
  const campi = campiInglesi(d);
  for (const c of campi) if (!c.it) c.metti('');
  const daFare = campi.filter((c) => c.it && (!c.en || (d.prima[c.chiave] && d.prima[c.chiave].it !== c.it && d.prima[c.chiave].en === c.en)));
  const resto = daFare.filter((c) => { const t = giaTradotto(c.it); if (t) c.metti(t); return !t; });
  if (!resto.length) return undefined;
  try {
    const testi = [...new Set(resto.map((c) => c.it))];
    const { output } = await generateText({
      model: 'anthropic/claude-sonnet-5.5',
      output: Output.object({ schema: z.object({ traduzioni: z.array(z.object({ it: z.string(), en: z.string() })) }) }),
      system: ISTRUZIONI,
      prompt: JSON.stringify(testi),
    });
    const fatte = new Map(output.traduzioni.map((t) => [t.it, t.en.trim()]));
    for (const c of resto) c.metti(fatte.get(c.it) ?? '');
    return undefined;
  } catch (e) {
    for (const c of resto) c.metti('');
    return `traduzione inglese non riuscita (${(e as Error).message}): la farà il sito alla pubblicazione`;
  }
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
  // Descrizione secondo la convenzione: ogni opera con le sue righe, poi le etichette
  const etichette = (coppie: string[][]) => coppie.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  const righe = [
    ...d.opere.flatMap((o) => [
      o.autore ? `${o.autore} · ${o.opera}` : o.opera,
      ...etichette([['Opera EN', o.operaEn], ['Organico', o.organico], ['Organico EN', o.organicoEn], ['Brani', o.brani]]),
    ]),
    ...etichette([['Data', d.dataIncerta ? "solo l'anno" : ''], ['Evidenza', d.evidenza], ['Evidenza EN', d.evidenzaEn], ['Organizza', d.organizza], ['Ingresso', d.ingresso], ['Ingresso EN', d.ingressoEn], ['Video', d.video], ['Foto', d.rigaFoto], ['Locandina', d.rigaLocandina], ['Home', d.rigaHome]]),
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
  const programma: Brano[] = c.programma ?? [{ autore: c.autore, opera: c.titolo }];
  // L'inglese: quello dell'evento, altrimenti quello che il sito mostra già (dizionario o build)
  const inglese = (it: string | undefined, en: string | undefined) => (it ? en || giaTradotto(it) || '' : '');

  // Luogo: "Città, sala, indirizzo" scritto a mano, oppure "Sala, via, CAP città, Italia" da Maps
  const pezzi = (e.location ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  const conCap = pezzi.findIndex((p) => /^\d{5}\s/.test(p));
  const luogo = conCap < 0
    ? { citta: pezzi[0] ?? '', sala: pezzi[1] ?? '', indirizzo: pezzi.slice(2).join(', ') }
    : { citta: c.luogo ?? '', sala: c.sala ?? '', indirizzo: pezzi.slice(c.sala ? 1 : 0, conCap + 1).join(', ') };

  const opere = programma.map((b, i) => ({
    autore: b.autore ?? '',
    opera: b.opera,
    // "Titolo EN" e "Organico EN" delle righe di prima valgono per la prima e l'ultima opera
    operaEn: inglese(b.opera, b.en?.opera || (i === 0 ? c.en?.titolo : undefined)),
    organico: b.organico ?? '',
    organicoEn: inglese(b.organico, b.en?.organico || (i === programma.length - 1 ? c.en?.organico : undefined)),
    brani: b.parti?.join(', ') ?? '',
  }));
  const dati = {
    data: c.data.slice(0, 10),
    ora: c.data.length > 10 ? c.data.slice(11, 16) : '',
    dataIncerta: c.dataIncerta === true,
    ...luogo,
    rassegna: c.rassegna ?? '',
    opere,
    evidenza: c.evidenza ?? '',
    evidenzaEn: inglese(c.evidenza, c.en?.evidenza),
    organizza: c.organizza ?? '',
    ingresso: c.ingresso ?? '',
    ingressoEn: inglese(c.ingresso, c.en?.ingresso),
    video: c.video ?? '',
    interpreti: (c.interpreti ?? []).map((i) => ({ ruolo: i.ruolo, nome: [i.nome, i.nota && `(${i.nota})`].filter(Boolean).join(' ') })),
    rigaFoto: riga('foto'),
    rigaLocandina: riga('locandina'),
    rigaHome: riga('home'),
    prima: {},
  };
  dati.prima = Object.fromEntries(campiInglesi(dati).map((x) => [x.chiave, { it: x.it, en: x.en }]));
  return dati;
}

// Gli allegati: la locandina ha "locandina" nel nome, la foto principale è ogni altra immagine
// (prima quella con "copertina" nel nome), come li legge src/motore/calendario.ts
export const eLocandina = (titolo: string) => /locandina/i.test(titolo);
