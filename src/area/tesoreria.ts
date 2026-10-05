// Area del tesoriere (/tesoriere, dal 5/10/2026): quote mensili dei coristi e cassa del coro, nel
// foglio "Tesoreria – quote e cassa" (cartella Tesoreria del Drive condiviso, FOGLIO_TESORERIA_ID),
// separato da "Coristi e assenze" perché quello lo leggono anche il Maestro e i redattori. Lo legge
// e scrive l'account di servizio; il sito crea da solo le due schede:
// - "Quote": una riga per quota pagata o esonerata (mese, corista, stato, importo, data del
//   pagamento, nota). Chi non ha una riga per un mese deve ancora pagare quella quota.
// - "Movimenti": una riga per entrata, uscita o saldo di inizio stagione.
// Le quote pagate entrano da sole nella cassa, nel mese del pagamento: non vanno scritte anche tra i
// movimenti. I coristi tenuti a pagare in un mese sono quelli attivi in quel mese secondo la scheda
// Coristi di "Coristi e assenze" (periodo Dal–Al). La stagione va dal 1 settembre al 31 agosto; le
// quote si pagano nei mesi di coro.coristi.tesoreria.mesi (da settembre a giugno).
import { randomBytes } from 'node:crypto';
import { FOGLIO_TESORERIA_ID } from 'astro:env/server';
import { coro } from '../motore/coro';
import { adesso, cancellaRiga, coristi, dataFoglio, idScheda, inizioStagione, leggiScheda, oggi, scriviRiga, type SchedaCorista } from './dati';
import { normalizza } from './servizio';

const QUOTE = 'Quote';
const COLONNE_QUOTE = ['Mese', 'Corista', 'Email', 'Stato', 'Importo', 'Pagata il', 'Nota', 'Segnata da', 'Modificata il'];
const MOVIMENTI = 'Movimenti';
const COLONNE_MOVIMENTI = ['ID', 'Data', 'Tipo', 'Categoria', 'Descrizione', 'Importo', 'Note', 'Scritto da', 'Modificato il'];

export const configurata = () => Boolean(FOGLIO_TESORERIA_ID && coro.coristi?.tesoreria);
const conf = () => coro.coristi!.tesoreria!;
export const quotaMensile = () => conf().quota;

// Categorie dei movimenti (le quote dei coristi non ci sono: entrano da sole dalla scheda Quote)
export const CATEGORIE = {
  Entrata: ['Contributi e donazioni', 'Concerti', 'Iscrizioni', 'Altre entrate'],
  Uscita: ['Maestro', 'Sala prove', 'Spartiti', 'Concerti', 'Trasporti', 'Spese bancarie', 'Altre uscite'],
} as const;
export type TipoMovimento = 'Entrata' | 'Uscita' | 'Saldo iniziale';

// ——— Mesi e stagioni ———

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const nomeMese = (mese: string) => MESI[Number(mese.slice(5, 7)) - 1];
export const meseEsteso = (mese: string) => `${nomeMese(mese)} ${mese.slice(0, 4)}`;
export const meseBreve = (mese: string) => nomeMese(mese).slice(0, 3);
export const meseDi = (giorno: string) => giorno.slice(0, 7);
export const questoMese = () => meseDi(oggi());

// La stagione si indica con l'anno in cui comincia: 2026 = dal 1/9/2026 al 31/8/2027
export const stagioneDi = (giorno: string) => Number(inizioStagione(giorno).slice(0, 4));
export const nomeStagione = (anno: number) => `${anno}/${String(anno + 1).slice(2)}`;
export const stagioneCorrente = () => stagioneDi(oggi());
// I dodici mesi della stagione, da settembre ad agosto
export const mesiDellaStagione = (anno: number) =>
  Array.from({ length: 12 }, (_, i) => { const m = ((8 + i) % 12) + 1; return `${m >= 9 ? anno : anno + 1}-${String(m).padStart(2, '0')}`; });
// I mesi in cui si paga la quota
export const mesiDelleQuote = (anno: number) => mesiDellaStagione(anno).filter((m) => conf().mesi.includes(Number(m.slice(5, 7))));

const ultimoGiorno = (mese: string) => new Date(Date.UTC(Number(mese.slice(0, 4)), Number(mese.slice(5, 7)), 0)).toISOString().slice(0, 10);
// Chi faceva parte del coro in quel mese (anche solo per qualche giorno)
export const attiviNelMese = (elenco: SchedaCorista[], mese: string) =>
  elenco.filter((c) => (!c.dal || c.dal <= ultimoGiorno(mese)) && (!c.al || c.al >= `${mese}-01`));

// ——— Numeri ———

// "20", "12,5", "1.234,50 €" → numero
export function numero(v?: string | number) {
  if (typeof v === 'number') return v;
  let t = (v ?? '').replace(/[^\d,.-]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}
const formatoEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
export const euro = (n: number) => formatoEuro.format(n).replace(/,00(?=\s?€)/, '');
const perFoglio = (iso: string) => iso.split('-').reverse().join('/');
const testo = (v: string) => (v ? `'${v}` : '');

// ——— Quote ———

export type StatoQuota = 'pagata' | 'esonerato' | 'da-pagare';
export interface Quota { riga: number; mese: string; email: string; stato: Exclude<StatoQuota, 'da-pagare'>; importo: number; pagataIl?: string; nota: string }

export async function quote(): Promise<Quota[]> {
  await idScheda(QUOTE, COLONNE_QUOTE, FOGLIO_TESORERIA_ID);
  return (await leggiScheda(QUOTE, FOGLIO_TESORERIA_ID))
    .filter((r) => /^\d{4}-\d{2}$/.test(r['Mese']) && r['Email'] && /^(pagata|esonerat)/i.test(r['Stato']))
    .map((r) => ({
      riga: r.riga,
      mese: r['Mese'],
      email: r['Email'].toLowerCase(),
      stato: /^pagata/i.test(r['Stato']) ? 'pagata' : 'esonerato',
      importo: numero(r['Importo']),
      pagataIl: dataFoglio(r['Pagata il']),
      nota: r['Nota'] ?? '',
    }));
}

const chiave = (email: string, mese: string) => `${email}|${mese}`;
export const indice = (elenco: Quota[]) => new Map(elenco.map((q) => [chiave(q.email, q.mese), q]));
export const statoDi = (idx: Map<string, Quota>, email: string, mese: string): StatoQuota => idx.get(chiave(email, mese))?.stato ?? 'da-pagare';

export interface SituazioneMese {
  mese: string;
  attesi: SchedaCorista[];
  pagate: number;
  esonerati: number;
  daPagare: number;
  raccolto: number;   // le quote di quel mese pagate (in qualunque giorno)
  dovuto: number;     // (attesi - esonerati) × quota
}

export function situazioneMese(mese: string, elenco: SchedaCorista[], idx: Map<string, Quota>): SituazioneMese {
  const attesi = attiviNelMese(elenco, mese);
  const stati = attesi.map((c) => idx.get(chiave(c.email, mese)));
  const pagate = stati.filter((q) => q?.stato === 'pagata');
  const esonerati = stati.filter((q) => q?.stato === 'esonerato').length;
  return {
    mese, attesi,
    pagate: pagate.length,
    esonerati,
    daPagare: attesi.length - pagate.length - esonerati,
    raccolto: pagate.reduce((t, q) => t + (q?.importo ?? 0), 0),
    dovuto: (attesi.length - esonerati) * quotaMensile(),
  };
}

export interface Arretrato { corista: SchedaCorista; mesi: string[]; importo: number }

// Chi deve ancora pagare le quote dei mesi indicati (di solito: quelli della stagione fino a oggi)
export function arretrati(mesi: string[], elenco: SchedaCorista[], idx: Map<string, Quota>): Arretrato[] {
  return elenco
    .map((c) => {
      const suoi = mesi.filter((m) => attiviNelMese([c], m).length && statoDi(idx, c.email, m) === 'da-pagare');
      return { corista: c, mesi: suoi, importo: suoi.length * quotaMensile() };
    })
    .filter((a) => a.mesi.length);
}

// I mesi delle quote già "scaduti" della stagione: fino al mese in corso compreso
export const mesiDovuti = (anno: number) => mesiDelleQuote(anno).filter((m) => m <= questoMese());

// Segna la quota di un corista per un mese: pagata (oggi, o il giorno dato), esonerato (con il
// motivo nella nota) o da pagare (si cancella la riga)
export async function segnaQuota(email: string, mese: string, stato: StatoQuota, nota: string, da: string, pagataIl?: string) {
  if (!/^\d{4}-\d{2}$/.test(mese)) throw new Error('Mese non valido.');
  const c = (await coristi()).find((x) => x.email === email.toLowerCase());
  if (!c) throw new Error('Corista non trovato nella scheda Coristi.');
  const esistente = (await quote()).find((q) => q.email === c.email && q.mese === mese);
  if (stato === 'da-pagare') {
    if (esistente) await cancellaRiga(QUOTE, esistente.riga, FOGLIO_TESORERIA_ID);
    return;
  }
  const giorno = stato === 'pagata' ? (pagataIl && /^\d{4}-\d{2}-\d{2}$/.test(pagataIl) ? pagataIl : esistente?.stato === 'pagata' && esistente.pagataIl ? esistente.pagataIl : oggi()) : '';
  const valori = [
    testo(mese), testo(`${c.nome} ${c.cognome}`), c.email,
    stato === 'pagata' ? 'Pagata' : 'Esonerato',
    stato === 'pagata' ? quotaMensile() : 0,
    giorno ? perFoglio(giorno) : '',
    testo(nota.trim().slice(0, 300)), da, adesso(),
  ];
  await scriviRiga(QUOTE, valori, esistente?.riga, FOGLIO_TESORERIA_ID);
}

// ——— Movimenti di cassa ———

export interface Movimento { riga: number; id: string; data: string; tipo: TipoMovimento; categoria: string; descrizione: string; importo: number; note: string }

export async function movimenti(): Promise<Movimento[]> {
  await idScheda(MOVIMENTI, COLONNE_MOVIMENTI, FOGLIO_TESORERIA_ID);
  return (await leggiScheda(MOVIMENTI, FOGLIO_TESORERIA_ID))
    .map((r) => ({
      riga: r.riga,
      id: r['ID'],
      data: dataFoglio(r['Data']) ?? '',
      tipo: (/^uscita/i.test(r['Tipo']) ? 'Uscita' : /^saldo/i.test(r['Tipo']) ? 'Saldo iniziale' : 'Entrata') as TipoMovimento,
      categoria: r['Categoria'] ?? '',
      descrizione: r['Descrizione'] ?? '',
      importo: Math.abs(numero(r['Importo'])),
      note: r['Note'] ?? '',
    }))
    .filter((m) => m.id && m.data)
    .sort((a, b) => b.data.localeCompare(a.data) || b.riga - a.riga);
}

// Modulo (POST): azione=salva (id per modificare) o cancella
export async function gestisciMovimento(f: FormData, email: string): Promise<{ ok: boolean; messaggio: string; data?: string }> {
  const v = (k: string) => String(f.get(k) ?? '').replace(/\r\n/g, '\n').trim();
  // La scheda deve esistere prima di scriverci (il sito la crea alla prima lettura)
  await idScheda(MOVIMENTI, COLONNE_MOVIMENTI, FOGLIO_TESORERIA_ID);
  const id = v('id');
  const esistente = id ? (await movimenti()).find((m) => m.id === id) : undefined;
  if (id && !esistente) return { ok: false, messaggio: 'Movimento non trovato: forse è stato cancellato.' };
  if (v('azione') === 'cancella') {
    if (!esistente) return { ok: false, messaggio: 'Movimento non trovato.' };
    await cancellaRiga(MOVIMENTI, esistente.riga, FOGLIO_TESORERIA_ID);
    return { ok: true, messaggio: `Movimento «${esistente.descrizione || esistente.categoria}» cancellato.`, data: esistente.data };
  }
  const tipo = (['Entrata', 'Uscita', 'Saldo iniziale'] as const).find((t) => t === v('tipo'));
  const data = v('data');
  const importo = numero(v('importo'));
  const categoria = tipo === 'Saldo iniziale' ? '' : v(tipo === 'Uscita' ? 'categoria-uscita' : 'categoria-entrata');
  const descrizione = v('descrizione').slice(0, 200);
  if (!tipo) return { ok: false, messaggio: 'Scegli se è un’entrata, un’uscita o il saldo di inizio stagione.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, messaggio: 'Data non valida.' };
  if (!(importo > 0) && tipo !== 'Saldo iniziale') return { ok: false, messaggio: 'Scrivi un importo maggiore di zero.' };
  if (tipo !== 'Saldo iniziale' && !descrizione) return { ok: false, messaggio: 'Scrivi una breve descrizione.' };
  const nuovoId = esistente?.id ?? randomBytes(4).toString('hex');
  const valori = [nuovoId, perFoglio(data), tipo, testo(categoria), testo(descrizione), Math.round(importo * 100) / 100, testo(v('note').slice(0, 500)), email, esistente ? adesso() : ''];
  await scriviRiga(MOVIMENTI, valori, esistente?.riga, FOGLIO_TESORERIA_ID);
  return { ok: true, messaggio: esistente ? 'Movimento aggiornato.' : `${tipo === 'Uscita' ? 'Uscita' : tipo === 'Entrata' ? 'Entrata' : 'Saldo di inizio stagione'} di ${euro(importo)} registrata.`, data };
}

// ——— Report della cassa ———

export interface MeseCassa {
  mese: string;
  quote: number;          // quote pagate in quel mese (per data del pagamento)
  numeroQuote: number;
  entrate: number;        // altre entrate
  uscite: number;
  saldo: number;          // quote + entrate - uscite del mese
  movimenti: Movimento[];
}

export interface Cassa {
  anno: number;
  saldoIniziale: number;
  mesi: MeseCassa[];
  quote: number;
  entrate: number;
  uscite: number;
  saldoFinale: number;
  perCategoria: { tipo: 'Entrata' | 'Uscita'; categoria: string; totale: number }[];
}

export function cassa(anno: number, tutte: Quota[], tutti: Movimento[]): Cassa {
  const mesi = mesiDellaStagione(anno);
  const inStagione = tutti.filter((m) => mesi.includes(meseDi(m.data)));
  const saldoIniziale = inStagione.filter((m) => m.tipo === 'Saldo iniziale').reduce((t, m) => t + m.importo, 0);
  const pagate = tutte.filter((q) => q.stato === 'pagata');
  const righe = mesi.map((mese) => {
    const qui = inStagione.filter((m) => meseDi(m.data) === mese);
    const q = pagate.filter((x) => meseDi(x.pagataIl ?? `${x.mese}-01`) === mese);
    const quoteMese = q.reduce((t, x) => t + x.importo, 0);
    const entrate = qui.filter((m) => m.tipo === 'Entrata').reduce((t, m) => t + m.importo, 0);
    const uscite = qui.filter((m) => m.tipo === 'Uscita').reduce((t, m) => t + m.importo, 0);
    return { mese, quote: quoteMese, numeroQuote: q.length, entrate, uscite, saldo: quoteMese + entrate - uscite, movimenti: qui };
  });
  const somma = (k: 'quote' | 'entrate' | 'uscite') => righe.reduce((t, r) => t + r[k], 0);
  const perCategoria = new Map<string, { tipo: 'Entrata' | 'Uscita'; categoria: string; totale: number }>();
  for (const m of inStagione) {
    if (m.tipo === 'Saldo iniziale') continue;
    const k = `${m.tipo}|${m.categoria || 'Senza categoria'}`;
    const x = perCategoria.get(k) ?? { tipo: m.tipo, categoria: m.categoria || 'Senza categoria', totale: 0 };
    x.totale += m.importo;
    perCategoria.set(k, x);
  }
  return {
    anno, saldoIniziale, mesi: righe,
    quote: somma('quote'), entrate: somma('entrate'), uscite: somma('uscite'),
    saldoFinale: saldoIniziale + somma('quote') + somma('entrate') - somma('uscite'),
    perCategoria: [...perCategoria.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || b.totale - a.totale),
  };
}

// Le stagioni di cui c'è qualcosa nel foglio, più quella in corso (la più recente prima)
export const stagioniConDati = (tutte: Quota[], tutti: Movimento[]) =>
  [...new Set([stagioneCorrente(), ...tutte.map((q) => stagioneDi(`${q.mese}-15`)), ...tutti.map((m) => stagioneDi(m.data))])].sort((a, b) => b - a);

// ——— Sollecito ———

// Il messaggio per chi deve pagare, dal modello con {nome}, {mesi} e {importo}
export const MODELLO_SOLLECITO = 'Ciao {nome}, risulta ancora da versare la quota del coro di {mesi} ({importo}). Puoi darla al tesoriere alla prossima prova. Grazie!';
const elencoMesi = (mesi: string[]) => { const n = mesi.map(nomeMese); return n.length > 1 ? `${n.slice(0, -1).join(', ')} e ${n.at(-1)}` : n[0] ?? ''; };
export const testoSollecito = (modello: string, a: Arretrato) =>
  modello.replaceAll('{nome}', a.corista.nome.split(' ')[0]).replaceAll('{mesi}', elencoMesi(a.mesi)).replaceAll('{importo}', euro(a.importo));

// Gli indirizzi con cui un corista può essere iscritto alle notifiche (dell'associazione e personale)
export const indirizziDi = (c: SchedaCorista) => [c.email, c.emailPersonale].filter(Boolean).map((e) => normalizza(e));
