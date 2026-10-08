// Dati veri dell'area coristi, letti e scritti dall'account di servizio (servizio.ts):
// - foglio "Coristi e assenze" (cartella Coristi del Drive condiviso, FOGLIO_CORISTI_ID):
//   scheda "Coristi" = tutti i coristi, attuali e passati, con sezione e periodo Dal–Al;
//   scheda "Assenze" = una riga per assenza, dichiarata dal corista o aggiunta dai redattori.
//   Chi non ha una riga di assenza è presente. Le intestazioni non si cambiano: le colonne si
//   leggono per nome, ma il sito scrive le righe in quest'ordine.
// - calendario privato "Prove" (CALENDARIO_PROVE_ID) e calendario pubblico "Concerti"
//   (CALENDARIO_CONCERTI_ID): le occasioni per cui si dichiara un'assenza.
import { CALENDARIO_CONCERTI_ID, CALENDARIO_PROVE_ID, FOGLIO_CORISTI_ID } from 'astro:env/server';
import { coro } from '../motore/coro';
import { google, normalizza } from './servizio';
import { EMAIL_REDAZIONE, fintiPer, inDemo, type Finto } from './demo';
import { sommario } from '../motore/calendario';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const CAL = 'https://www.googleapis.com/calendar/v3';
const FUSO = 'Europe/Rome';

export const configurati = () => Boolean(FOGLIO_CORISTI_ID && CALENDARIO_PROVE_ID);

// Il link che aggiunge il calendario "Prove" all'account Google con cui si è entrati nell'area
// (authuser: senza, Google usa il primo account del browser, che spesso è un altro e non ha il
// permesso). Una volta aggiunto, il calendario compare in Google Calendar ovunque si usi
// quell'account: computer, app del telefono, Calendario di iPhone se l'account è configurato lì.
// Google però non lascia aggiungere calendari dal telefono in modo affidabile: va fatto da computer.
export const linkCalendarioProve = (email: string) =>
  CALENDARIO_PROVE_ID ? `https://calendar.google.com/calendar/r?${new URLSearchParams({ cid: CALENDARIO_PROVE_ID, authuser: email })}` : undefined;

// ——— Date (tutte come "AAAA-MM-GG", ora di Roma) ———

const formatoGiorno = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatoOra = new Intl.DateTimeFormat('it-IT', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
export const giornoDi = (d: Date) => formatoGiorno.format(d);
export const oggi = () => giornoDi(new Date());
const oraDi = (d: Date) => formatoOra.format(d);
export const piuGiorni = (giorno: string, n: number) => giornoDi(new Date(Date.parse(`${giorno}T12:00:00Z`) + n * 86_400_000));

// Le date del foglio arrivano come le mostra (gg/mm/aaaa); accettate anche AAAA-MM-GG
export function dataFoglio(v?: string) {
  if (!v) return undefined;
  const it = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (it) return `${it[3]}-${it[2].padStart(2, '0')}-${it[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(v.trim()) ? v.trim().slice(0, 10) : undefined;
}

// Inizio della stagione (1 settembre) che contiene il giorno
export const inizioStagione = (giorno: string) => {
  const anno = Number(giorno.slice(0, 4)) - (Number(giorno.slice(5, 7)) < 9 ? 1 : 0);
  return `${anno}-09-01`;
};

// ——— Foglio ———
// Tutte le funzioni lavorano sul foglio "Coristi e assenze"; con l'ultimo argomento su un altro
// foglio (la tesoreria, src/area/tesoreria.ts)

export async function leggiScheda(scheda: string, foglio = FOGLIO_CORISTI_ID!) {
  const p = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE' });
  const { values = [] } = await google<{ values?: string[][] }>(`${SHEETS}/${foglio}/values/${encodeURIComponent(`${scheda}!A1:Z`)}?${p}`);
  const [intestazioni = [], ...righe] = values;
  // Ogni riga come { intestazione: valore }, con il numero di riga del foglio (la prima è 2)
  return righe.map((r, i) => ({ riga: i + 2, ...Object.fromEntries(intestazioni.map((t, j) => [t.trim(), (r[j] ?? '').trim()])) })) as ({ riga: number } & Record<string, string>)[];
}

// ——— Coristi ———

// Un periodo nel coro: una riga della scheda Coristi (dal 8/10/2026 un corista che esce e poi rientra
// ha più righe, con la stessa email dell'associazione)
export interface Periodo {
  riga: number;
  dal?: string;
  al?: string;            // vuota: è ancora nel coro
  nota: string;
}

export interface SchedaCorista {
  nome: string;
  cognome: string;
  sezione: string;
  email: string;          // dell'associazione, nome.cognome@romamusicanta.org: è la chiave
  emailPersonale: string;
  numeroSocio: string;
  periodi: Periodo[];     // in ordine di data
  dal?: string;           // inizio del primo periodo
  al?: string;            // fine dell'ultimo (vuota se è ancora nel coro)
}

export const SEZIONI = ['Soprani', 'Contralti', 'Tenori', 'Bassi'];
export const nomeBreve = (c: Pick<SchedaCorista, 'nome' | 'cognome'>) => `${c.nome.split(' ')[0]} ${c.cognome.charAt(0)}.`;

let coristiInCache: { elenco: SchedaCorista[]; letti: number } | undefined;
// Dopo una modifica della scheda Coristi dall'Amministrazione
export const dimenticaCoristi = () => { coristiInCache = undefined; };

// I coristi veri, anche in modalità demo: per i calcoli tenuti in cache (src/area/demo.ts)
export async function coristiVeri(): Promise<SchedaCorista[]> {
  if (coristiInCache && Date.now() - coristiInCache.letti < 5 * 60 * 1000) return coristiInCache.elenco;
  const perEmail = new Map<string, ({ riga: number } & Record<string, string>)[]>();
  for (const r of (await leggiScheda('Coristi')).filter((r) => r['Email associazione'] && r['Nome'])) {
    const email = r['Email associazione'].toLowerCase();
    perEmail.set(email, [...(perEmail.get(email) ?? []), r]);
  }
  const elenco = [...perEmail.entries()]
    .map(([email, righe]) => {
      const periodi: Periodo[] = righe.map((r) => ({ riga: r.riga, dal: dataFoglio(r['Dal']), al: dataFoglio(r['Al']), nota: r['Note'] ?? '' }))
        .sort((a, b) => (a.dal ?? '').localeCompare(b.dal ?? ''));
      // I dati della persona: quelli della riga del periodo più recente
      const r = righe.find((x) => x.riga === periodi.at(-1)!.riga)!;
      return {
        nome: r['Nome'],
        cognome: r['Cognome'],
        sezione: r['Sezione'] || 'Sezione da assegnare',
        email,
        emailPersonale: r['Email personale'] ?? '',
        numeroSocio: r['N. socio'] ?? '',
        periodi,
        dal: periodi[0].dal,
        al: periodi.some((p) => !p.al) ? undefined : periodi.map((p) => p.al!).sort().at(-1),
      };
    })
    // In ordine alfabetico come si mostrano, "Nome Cognome" (dal 5/10/2026; prima per cognome): sulla
    // scritta intera, così "Maria Cristina Di Bernardino" viene prima di "Maria Di Paola"
    .sort((a, b) => `${a.nome} ${a.cognome}`.localeCompare(`${b.nome} ${b.cognome}`, 'it', { sensitivity: 'base' }));
  coristiInCache = { elenco, letti: Date.now() };
  return elenco;
}

// Se un corista faceva parte del coro tra due giorni (anche solo per uno di questi)
export const nelCoro = (c: SchedaCorista, da: string, a = da) =>
  (c.periodi?.length ? c.periodi : [{ dal: c.dal, al: c.al }]).some((p) => (!p.dal || p.dal <= a) && (!p.al || p.al >= da));

// Le persone inventate della modalità demo, per email vera (dell'associazione o personale)
const fintiInCache = new WeakMap<SchedaCorista[], Map<string, Finto>>();
async function finti() {
  const elenco = await coristiVeri();
  if (!fintiInCache.has(elenco)) fintiInCache.set(elenco, fintiPer(elenco));
  return fintiInCache.get(elenco)!;
}
const trova = (m: Map<string, Finto>, email: string) => m.get(email.toLowerCase()) ?? [...m.entries()].find(([k]) => normalizza(k) === normalizza(email))?.[1];

// In modalità demo: l'email finta e il nome breve inventato di chi ha scritto o caricato qualcosa
// (chi non è corista è «Redazione»); fuori dalla demo, quelli veri
export async function personaVista(email: string, elenco?: SchedaCorista[]): Promise<{ email: string; chi: string; sezione?: string }> {
  const vero = (elenco ?? (await coristiVeri())).find((x) => x.email === normalizza(email) || (x.emailPersonale && normalizza(x.emailPersonale) === normalizza(email)));
  if (!inDemo()) return { email, chi: vero ? nomeBreve(vero) : email, sezione: vero?.sezione };
  const f = email ? trova(await finti(), email) : undefined;
  return f ? { email: f.email, chi: nomeBreve(f), sezione: vero?.sezione } : { email: EMAIL_REDAZIONE, chi: 'Redazione', sezione: vero?.sezione };
}

// I coristi come li vede chi guarda: in modalità demo con nomi ed email inventati (sezione e periodo veri)
export async function coristi(): Promise<SchedaCorista[]> {
  const elenco = await coristiVeri();
  if (!inDemo()) return elenco;
  const m = await finti();
  return elenco
    .map((c) => ({ ...c, ...m.get(c.email)!, emailPersonale: '', numeroSocio: '', periodi: c.periodi.map((p) => ({ ...p, nota: '' })) }))
    .sort((a, b) => `${a.nome} ${a.cognome}`.localeCompare(`${b.nome} ${b.cognome}`, 'it', { sensitivity: 'base' }));
}

// Chi faceva parte del coro quel giorno
export const attivi = (elenco: SchedaCorista[], giorno: string) => elenco.filter((c) => nelCoro(c, giorno));

// Il corista di un indirizzo, dell'associazione o personale
export async function coristaDi(email: string) {
  const n = normalizza(email);
  return (await coristi()).find((c) => c.email === n || (c.emailPersonale && normalizza(c.emailPersonale) === n));
}

// Sezioni nell'ordine del coro, più quelle non previste scritte nel foglio
export const sezioniDi = (elenco: { sezione: string }[]) => [...SEZIONI, ...new Set(elenco.map((c) => c.sezione).filter((s) => !SEZIONI.includes(s)))];

// ——— Prove e concerti ———

export interface Evento {
  id: string;             // dell'evento nel calendario (per una prova ricorrente, della singola data)
  tipo: 'prova' | 'concerto';
  data: string;
  inizio?: string;        // "20:00"; manca se l'orario è da definire
  fine?: string;
  inizioMs: number;
  titolo: string;
  luogo?: string;
  righe: [string, string][]; // righe "Etichetta: valore" della descrizione (Brani, Portare, Note…)
  // Solo per i concerti: come nel sito pubblico, l'opera (con l'autore) al posto del titolo
  // dell'evento, che di solito è la rassegna, e il luogo breve ("Rignano Flaminio (RM) · Chiesa…")
  opera?: string;
  autore?: string;
  rassegna?: string;
  luogoBreve?: string;
  // Solo per i concerti: 'da-confermare', 'confermato' (nel calendario "Prove", non pubblici) o
  // 'in-cartellone' (src/admin/stati.ts)
  stato?: 'da-confermare' | 'confermato' | 'in-cartellone';
}

// Per le schede: "Da confermare" o "Confermato" sui concerti non ancora in cartellone
// (e "Passato" dopo la data, ricavato dalla data come nell'Amministrazione)
export const etichettaStato = (e: Evento) => (e.tipo !== 'concerto' ? undefined : e.data < oggi() ? 'Passato' : e.stato && e.stato !== 'in-cartellone' ? (e.stato === 'confermato' ? 'Confermato' : 'Da confermare') : undefined);

// "Mozart · Requiem in re minore K 626" per i concerti, il titolo per le prove
export const nomeEvento = (e: Evento) => (e.tipo === 'concerto' && e.opera ? [e.autore?.split(/\s+/).at(-1), e.opera].filter(Boolean).join(' · ') : e.titolo);

interface EventoApi {
  id: string;
  summary?: string;
  location?: string;
  description?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

const testo = (html = '') => html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

function evento(e: EventoApi, tipo: Evento['tipo']): Evento {
  const inizio = e.start.dateTime ? new Date(e.start.dateTime) : undefined;
  const fine = e.end.dateTime ? new Date(e.end.dateTime) : undefined;
  const data = inizio ? giornoDi(inizio) : e.start.date!;
  const righe = testo(e.description).split('\n').map((r) => r.match(/^\s*([^:]{2,30}):\s*(.+)$/)).filter((m) => m).map((m) => [m![1].trim(), m![2].trim()] as [string, string]);
  return {
    id: e.id,
    tipo,
    data,
    inizio: inizio && oraDi(inizio),
    fine: fine && oraDi(fine),
    inizioMs: inizio?.getTime() ?? Date.parse(`${data}T12:00:00Z`),
    titolo: e.summary?.trim() || (tipo === 'prova' ? 'Prova' : 'Concerto'),
    luogo: e.location?.trim() || undefined,
    righe,
    ...(tipo === 'concerto' ? sommario(e.summary?.trim() ?? '', testo(e.description), e.location ?? '') : {}),
    ...(tipo === 'concerto' ? { stato: (['da-confermare', 'confermato', 'in-cartellone'] as const).find((x) => x === e.extendedProperties?.private?.stato) ?? (e.extendedProperties?.private?.tipo === 'concerto' ? 'da-confermare' : 'in-cartellone') } : {}),
  };
}

// Nel calendario "Prove" ci sono anche i concerti (proprietà tipo = concerto); nel calendario
// "Concerti" le copie pubbliche (proprietà origine) si saltano: il concerto è già quello in "Prove"
async function eventiDi(calendario: string, tipo: Evento['tipo'], da: string, a: string) {
  const p = new URLSearchParams({
    singleEvents: 'true', orderBy: 'startTime', maxResults: '500', timeZone: FUSO,
    timeMin: new Date(`${da}T00:00:00Z`).toISOString(), timeMax: new Date(`${piuGiorni(a, 1)}T00:00:00Z`).toISOString(),
  });
  const { items = [] } = await google<{ items?: EventoApi[] }>(`${CAL}/calendars/${encodeURIComponent(calendario)}/events?${p}`);
  return items
    .filter((e) => !(tipo === 'concerto' && e.extendedProperties?.private?.origine))
    .map((e) => evento(e, tipo === 'prova' && e.extendedProperties?.private?.tipo === 'concerto' ? 'concerto' : tipo));
}

const eventiInCache = new Map<string, { elenco: Evento[]; letti: number }>();

// Prove e concerti tra due giorni (compresi), in ordine di data
export async function eventi(da: string, a: string): Promise<Evento[]> {
  const chiave = `${da}/${a}`;
  const c = eventiInCache.get(chiave);
  if (c && Date.now() - c.letti < 60 * 1000) return c.elenco;
  const [prove, concerti] = await Promise.all([
    eventiDi(CALENDARIO_PROVE_ID!, 'prova', da, a),
    CALENDARIO_CONCERTI_ID ? eventiDi(CALENDARIO_CONCERTI_ID, 'concerto', da, a).catch(() => []) : [],
  ]);
  const elenco = [...prove, ...concerti].sort((x, y) => x.inizioMs - y.inizioMs);
  eventiInCache.set(chiave, { elenco, letti: Date.now() });
  return elenco;
}

// Un evento entro un anno prima o dopo oggi, per id
export async function eventoDa(id: string) {
  return (await eventi(piuGiorni(oggi(), -366), piuGiorni(oggi(), 366))).find((e) => e.id === id);
}

// Si può ancora dichiarare (o ritirare) un'assenza: fino all'inizio dell'evento
export const aperto = (e: Evento) => e.inizioMs > Date.now();

export const luogoDi = (e: Evento) => e.luogo ?? (e.tipo === 'prova' ? `${coro.prove.nome}, ${coro.prove.indirizzo}` : undefined);
// Per le schede: il luogo breve dei concerti (l'indirizzo completo resta per la mappa)
export const luogoBreveDi = (e: Evento) => (e.tipo === 'concerto' ? e.luogoBreve ?? e.luogo : luogoDi(e));

// ——— Assenze ———

export interface Assenza {
  riga: number;
  data: string;
  idEvento: string;
  email: string;
  nota: string;
  inseritaDa: string;
}

const COLONNE_ASSENZE = ['Data', 'Evento', 'ID evento', 'Nome', 'Email', 'Sezione', 'Nota', 'Inserita il', 'Inserita da'];

// Tutte le assenze (non si tengono in cache: le scrivono coristi e redattori)
// In modalità demo con le email inventate di coristi() e senza note
export async function assenze(): Promise<Assenza[]> {
  const tutte = (await leggiScheda('Assenze'))
    .filter((r) => r['ID evento'] && r['Email'])
    .map((r) => ({ riga: r.riga, data: dataFoglio(r['Data']) ?? '', idEvento: r['ID evento'], email: r['Email'].toLowerCase(), nota: r['Nota'], inseritaDa: r['Inserita da'] }));
  if (!inDemo()) return tutte;
  const m = await finti();
  return tutte.map((a) => {
    const chi = trova(m, a.email);
    const da = trova(m, a.inseritaDa);
    // Chi non avvisa da sé resta riconoscibile come «inserita dai redattori»
    return { ...a, email: chi?.email ?? EMAIL_REDAZIONE, nota: '', inseritaDa: da?.email ?? (normalizza(a.inseritaDa) === normalizza(a.email) ? chi?.email ?? EMAIL_REDAZIONE : EMAIL_REDAZIONE) };
  });
}

// "02/10/2026 21:43": il foglio (in italiano) la riconosce come data e ora
export const adesso = () => `${oggi().split('-').reverse().join('/')} ${oraDi(new Date())}`;

// Segna un'assenza; se c'è già, aggiorna la nota
export async function segnaAssenza(e: Evento, c: SchedaCorista, nota: string, da: string) {
  const esistente = (await assenze()).find((a) => a.idEvento === e.id && a.email === c.email);
  const p = new URLSearchParams({ valueInputOption: 'USER_ENTERED' });
  if (esistente) {
    await google(`${SHEETS}/${FOGLIO_CORISTI_ID}/values/${encodeURIComponent(`Assenze!G${esistente.riga}:I${esistente.riga}`)}?${p}`, {
      method: 'PUT', body: JSON.stringify({ values: [[nota, adesso(), da]] }),
    });
    return;
  }
  const descrizione = e.tipo === 'concerto' ? `Concerto · ${e.titolo}` : /^prova\b/i.test(e.titolo) ? e.titolo : `Prova · ${e.titolo}`;
  const riga = [e.data, descrizione, e.id, `${c.nome} ${c.cognome}`, c.email, c.sezione, nota, adesso(), da];
  // OVERWRITE: la riga va nella prima vuota sotto la tabella e prende il formato delle colonne (date)
  await google(`${SHEETS}/${FOGLIO_CORISTI_ID}/values/${encodeURIComponent(`Assenze!A:${String.fromCharCode(64 + COLONNE_ASSENZE.length)}`)}:append?${new URLSearchParams({ valueInputOption: 'USER_ENTERED', insertDataOption: 'OVERWRITE' })}`, {
    method: 'POST', body: JSON.stringify({ values: [riga] }),
  });
}

// L'identificativo numerico di una scheda del foglio (serve per cancellare righe); se la scheda
// non c'è e si danno le intestazioni, la crea
const idSchede = new Map<string, number>();
export async function idScheda(nome: string, intestazioni?: string[], foglio = FOGLIO_CORISTI_ID!) {
  const chiave = `${foglio}/${nome}`;
  if (idSchede.has(chiave)) return idSchede.get(chiave)!;
  const { sheets } = await google<{ sheets: { properties: { sheetId: number; title: string } }[] }>(`${SHEETS}/${foglio}?fields=sheets.properties`);
  let id = sheets.find((s) => s.properties.title === nome)?.properties.sheetId;
  if (id === undefined) {
    if (!intestazioni) throw new Error(`manca la scheda ${nome} nel foglio`);
    const r = await google<{ replies: { addSheet: { properties: { sheetId: number } } }[] }>(`${SHEETS}/${foglio}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: nome, gridProperties: { frozenRowCount: 1 } } } }] }),
    });
    id = r.replies[0].addSheet.properties.sheetId;
    await google(`${SHEETS}/${foglio}/values/${encodeURIComponent(`${nome}!A1`)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [intestazioni] }) });
  }
  else if (intestazioni) {
    // Colonne aggiunte dopo la creazione della scheda: si scrivono in fondo all'intestazione (le
    // colonne nuove si aggiungono sempre alla fine dell'elenco, mai in mezzo)
    const { values = [] } = await google<{ values?: string[][] }>(`${SHEETS}/${foglio}/values/${encodeURIComponent(`${nome}!1:1`)}`);
    const presenti = (values[0] ?? []).map((t) => t.trim());
    const mancanti = intestazioni.filter((t) => !presenti.includes(t));
    if (mancanti.length) await google(`${SHEETS}/${foglio}/values/${encodeURIComponent(`${nome}!A1`)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [[...presenti, ...mancanti]] }) });
  }
  idSchede.set(chiave, id);
  return id;
}

// L'intestazione di una scheda, com'è ora nel foglio
export async function intestazioneScheda(scheda: string, foglio = FOGLIO_CORISTI_ID!) {
  const { values = [] } = await google<{ values?: string[][] }>(`${SHEETS}/${foglio}/values/${encodeURIComponent(`${scheda}!1:1`)}`);
  return (values[0] ?? []).map((t) => t.trim());
}

// Scrive una riga (numero di riga del foglio) o la aggiunge in fondo (riga assente)
// I numeri (importi) si passano come numeri: arrivano al foglio come numeri qualunque sia la sua lingua
export async function scriviRiga(scheda: string, valori: (string | number)[], riga?: number, foglio = FOGLIO_CORISTI_ID!) {
  const fine = String.fromCharCode(64 + valori.length);
  const p = new URLSearchParams({ valueInputOption: 'USER_ENTERED' });
  if (riga) {
    await google(`${SHEETS}/${foglio}/values/${encodeURIComponent(`${scheda}!A${riga}:${fine}${riga}`)}?${p}`, { method: 'PUT', body: JSON.stringify({ values: [valori] }) });
    return;
  }
  p.set('insertDataOption', 'OVERWRITE');
  await google(`${SHEETS}/${foglio}/values/${encodeURIComponent(`${scheda}!A:${fine}`)}:append?${p}`, { method: 'POST', body: JSON.stringify({ values: [valori] }) });
}

// Aggiunge più righe in fondo con una richiesta sola
export async function aggiungiRighe(scheda: string, righe: (string | number)[][], foglio = FOGLIO_CORISTI_ID!) {
  if (!righe.length) return;
  const fine = String.fromCharCode(64 + Math.max(...righe.map((r) => r.length)));
  const p = new URLSearchParams({ valueInputOption: 'USER_ENTERED', insertDataOption: 'OVERWRITE' });
  await google(`${SHEETS}/${foglio}/values/${encodeURIComponent(`${scheda}!A:${fine}`)}:append?${p}`, { method: 'POST', body: JSON.stringify({ values: righe }) });
}

// Cancella una riga del foglio
export async function cancellaRiga(scheda: string, riga: number, foglio = FOGLIO_CORISTI_ID!) {
  await google(`${SHEETS}/${foglio}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: await idScheda(scheda, undefined, foglio), dimension: 'ROWS', startIndex: riga - 1, endIndex: riga } } }] }),
  });
}

// Cancella più righe con una sola richiesta, dal basso, perché ogni cancellazione sposta le righe sotto
export async function cancellaRighe(scheda: string, righe: number[], foglio = FOGLIO_CORISTI_ID!) {
  if (!righe.length) return;
  const sheetId = await idScheda(scheda, undefined, foglio);
  await google(`${SHEETS}/${foglio}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [...new Set(righe)].sort((a, b) => b - a).map((riga) => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: riga - 1, endIndex: riga } } })) }),
  });
}

// Toglie l'assenza (cioè: era presente)
export async function togliAssenza(idEvento: string, email: string) {
  const a = (await assenze()).find((x) => x.idEvento === idEvento && x.email === email);
  if (!a) return;
  await cancellaRiga('Assenze', a.riga);
}

// ——— Riepiloghi per le pagine ———

export interface Riepilogo {
  evento: Evento;
  attesi: SchedaCorista[];                 // attivi quel giorno
  assenti: (SchedaCorista & { nota: string; daRedattore: boolean })[];
  perSezione: { sezione: string; totale: number; presenti: number; assenti: number }[];
}

export function riepilogo(e: Evento, elenco: SchedaCorista[], tutte: Assenza[]): Riepilogo {
  const attesi = attivi(elenco, e.data);
  const qui = new Map(tutte.filter((a) => a.idEvento === e.id).map((a) => [a.email, a]));
  const assenti = attesi.filter((c) => qui.has(c.email)).map((c) => ({ ...c, nota: qui.get(c.email)!.nota, daRedattore: normalizza(qui.get(c.email)!.inseritaDa) !== c.email }));
  const perSezione = sezioniDi(attesi).map((sezione) => {
    const totale = attesi.filter((c) => c.sezione === sezione).length;
    const n = assenti.filter((c) => c.sezione === sezione).length;
    return { sezione, totale, presenti: totale - n, assenti: n };
  }).filter((s) => s.totale > 0);
  return { evento: e, attesi, assenti, perSezione };
}
