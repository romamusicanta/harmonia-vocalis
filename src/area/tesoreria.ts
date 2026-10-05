// Area del tesoriere (/tesoriere, dal 5/10/2026): quote mensili dei coristi, cassa, onorari dei
// maestri e rendiconto annuale, nel foglio "Tesoreria – quote e cassa" (cartella Tesoreria del Drive
// condiviso, FOGLIO_TESORERIA_ID), separato da "Coristi e assenze" perché quello lo leggono anche il
// Maestro e i redattori. Lo legge e scrive l'account di servizio; il sito crea da solo le schede:
// - "Quote": una riga per quota pagata o esonerata (mese, corista, stato, importo, data del
//   pagamento, nota). Chi non ha una riga per un mese deve ancora pagare quella quota. Una riga con
//   email "tutti" e stato "Nessuna quota" segna un mese in cui la quota non si raccoglie (come
//   settembre 2025, coperto dalla quota di giugno).
//   Una riga con email "tutti" e stato "Quota base" dà la quota di un mese diversa dal solito (dal
//   5/10/2026): serve per giugno e settembre. Settembre ha poche prove e si assimila a giugno: se
//   giugno ha avuto poche prove (come nel 2026) a settembre la quota base è zero, se giugno è stato un
//   mese intero è metà quota (coro.coristi.tesoreria.quotaSettembre, di base).
//   A settembre si pagano anche i debiti della stagione prima: la cifra di ognuno è la quota base più
//   l'ammanco (le quote della stagione prima rimaste da pagare, settembre compreso). Il tesoriere la
//   corregge a mano, e allora la riga ha lo stato "Da pagare" con la cifra nell'Importo. Cifra zero =
//   esonerato, e viceversa: chi non deve niente risulta esonerato da solo, senza riga.
// - "Movimenti": una riga per entrata, uscita o avanzo di cassa (saldo di inizio stagione).
// - "Prove dei maestri": le prove del calendario "Prove" per cui qualcosa cambia rispetto al solito
//   (sostituto, prova gratuita, lezione di vocalità), più le prove non in calendario.
// - "Verifiche di cassa": saldo del conto corrente e contanti a una data, da confrontare con i conti.
// Come il rendiconto 2025-26 (vedi la relazione del tesoriere), i conti sono "per cassa": vale la
// data in cui i soldi entrano o escono. Le quote pagate entrano da sole nella cassa, nel mese del
// pagamento. Gli spartiti comprati per i coristi e da loro rimborsati sono partite di giro: entrano ed
// escono, e si tolgono dalle spese di gestione. I coristi tenuti a pagare in un mese sono quelli
// attivi in quel mese secondo la scheda Coristi di "Coristi e assenze" (periodo Dal–Al). La stagione
// va dal 1 settembre al 31 agosto; le quote si pagano nei mesi di coro.coristi.tesoreria.mesi.
import { randomBytes } from 'node:crypto';
import { FOGLIO_TESORERIA_ID } from 'astro:env/server';
import { coro } from '../motore/coro';
import { adesso, cancellaRiga, coristi, dataFoglio, eventi, idScheda, inizioStagione, leggiScheda, oggi, scriviRiga, type SchedaCorista } from './dati';
import { normalizza } from './servizio';

const QUOTE = 'Quote';
const COLONNE_QUOTE = ['Mese', 'Corista', 'Email', 'Stato', 'Importo', 'Pagata il', 'Nota', 'Segnata da', 'Modificata il'];
const MOVIMENTI = 'Movimenti';
const COLONNE_MOVIMENTI = ['ID', 'Data', 'Tipo', 'Categoria', 'Descrizione', 'Importo', 'Note', 'Scritto da', 'Modificato il'];
const MAESTRI = 'Prove dei maestri';
const COLONNE_MAESTRI = ['ID prova', 'Data', 'Maestro', 'Onorario', 'Vocalità', 'Importo vocalità', 'Note', 'Segnata da', 'Modificata il'];
const VERIFICHE = 'Verifiche di cassa';
const COLONNE_VERIFICHE = ['ID', 'Data', 'Saldo conto corrente', 'Contanti in cassa', 'Note', 'Scritta da'];
const TUTTI = 'tutti';

export const configurata = () => Boolean(FOGLIO_TESORERIA_ID && coro.coristi?.tesoreria);
const conf = () => coro.coristi!.tesoreria!;
export const quotaMensile = () => conf().quota;
export const onorari = () => conf().onorari;
export const direttore = () => coro.maestro.nome;

// Categorie dei movimenti, come le voci del rendiconto (le quote dei coristi non ci sono: entrano da
// sole dalla scheda Quote)
export const CATEGORIE = {
  Entrata: ['Rimborsi concerti', 'Spartiti: versamenti dei coristi', 'Contributi e donazioni', 'Altre entrate'],
  Uscita: [
    'Onorario Direttore', 'Altri maestri', 'Lezioni di vocalità', 'Compensi per i concerti', 'Affitto sala prove', 'Spartiti per i coristi', 'Spartiti e materiale musicale',
    'Concerti (trasporti, fiori, allestimento)', 'Pedane e attrezzatura', 'Feste e rinfreschi', 'Adesioni e assicurazione', 'Spese bancarie',
    'Omaggi e donazioni', 'Altre uscite',
  ],
} as const;
// Compensi ai maestri pagati con il rimborso di un concerto: nella sintesi del rendiconto i rimborsi si
// contano al netto di questi (come il concerto in Vaticano del 2025: 750 €, di cui 250 al Maestro)
export const COMPENSI_CONCERTI = 'Compensi per i concerti';
// Partite di giro: gli spartiti comprati per i coristi e da loro rimborsati (si tolgono dalle spese di gestione)
export const PARTITE_DI_GIRO: string[] = ['Spartiti: versamenti dei coristi', 'Spartiti per i coristi'];
// Le categorie degli onorari, per confrontare il pagato con il maturato (pagina Maestri)
export const CATEGORIE_ONORARI = { direttore: 'Onorario Direttore', sostituti: 'Altri maestri', vocalita: 'Lezioni di vocalità' } as const;
export type TipoMovimento = 'Entrata' | 'Uscita' | 'Saldo iniziale';

// ——— Mesi e stagioni ———

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const nomeMese = (mese: string) => MESI[Number(mese.slice(5, 7)) - 1];
export const meseEsteso = (mese: string) => `${nomeMese(mese)} ${mese.slice(0, 4)}`;
export const meseBreve = (mese: string) => nomeMese(mese).slice(0, 3);
export const meseDi = (giorno: string) => giorno.slice(0, 7);
export const questoMese = () => meseDi(oggi());
export const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// La stagione si indica con l'anno in cui comincia: 2026 = dal 1/9/2026 al 31/8/2027
export const stagioneDi = (giorno: string) => Number(inizioStagione(giorno).slice(0, 4));
export const nomeStagione = (anno: number) => `${anno}/${String(anno + 1).slice(2)}`;
export const nomeStagioneLungo = (anno: number) => `${anno}-${anno + 1}`;
export const stagioneCorrente = () => stagioneDi(oggi());
export const inizioDi = (anno: number) => `${anno}-09-01`;
export const fineDi = (anno: number) => `${anno + 1}-08-31`;
// I dodici mesi della stagione, da settembre ad agosto
export const mesiDellaStagione = (anno: number) =>
  Array.from({ length: 12 }, (_, i) => { const m = ((8 + i) % 12) + 1; return `${m >= 9 ? anno : anno + 1}-${String(m).padStart(2, '0')}`; });
// I mesi in cui si paga la quota (senza quelli segnati "Nessuna quota", se si danno le quote)
export const mesiDelleQuote = (anno: number, tutte?: Quota[]) => {
  const senza = tutte ? mesiSenzaQuota(tutte) : new Set<string>();
  return tutteLeQuote(anno).filter((m) => !senza.has(m));
};
// Tutti i mesi delle quote della stagione, anche quelli senza quota (per le colonne delle tabelle)
export const tutteLeQuote = (anno: number) => mesiDellaStagione(anno).filter((m) => conf().mesi.includes(Number(m.slice(5, 7))));
// Quelli già "scaduti": fino al mese in corso compreso
export const mesiDovuti = (anno: number, tutte?: Quota[]) => mesiDelleQuote(anno, tutte).filter((m) => m <= questoMese());

const ultimoGiorno = (mese: string) => new Date(Date.UTC(Number(mese.slice(0, 4)), Number(mese.slice(5, 7)), 0)).toISOString().slice(0, 10);
// Chi faceva parte del coro in quel mese (anche solo per qualche giorno)
export const attiviNelMese = (elenco: SchedaCorista[], mese: string) =>
  elenco.filter((c) => (!c.dal || c.dal <= ultimoGiorno(mese)) && (!c.al || c.al >= `${mese}-01`));

// ——— Numeri e date ———

// "20", "12,5", "1.234,50 €" → numero
export function numero(v?: string | number) {
  if (typeof v === 'number') return v;
  let t = (v ?? '').replace(/[^\d,.-]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}
// Il punto delle migliaia anche con quattro cifre (4.443 €, come nei rendiconti): l'italiano di base lo mette da 10.000
const formatoEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
export const euro = (n: number) => formatoEuro.format(n).replace(/,00(?=\s?€)/, '');
export const euroEsatto = (n: number) => formatoEuro.format(n);
const centesimi = (n: number) => Math.round(n * 100) / 100;
const perFoglio = (iso: string) => iso.split('-').reverse().join('/');
export const giornoBreve = (iso: string) => iso.split('-').reverse().join('/');
const testo = (v: string) => (v ? `'${v}` : '');

// ——— Quote ———

export type StatoQuota = 'pagata' | 'esonerato' | 'da-pagare';
// riga 0 = quota di settembre calcolata (quota base più ammanco), non scritta nel foglio; calcolata:
// solo a settembre, anche quando la cifra è scritta a mano. Stato "base": riga "tutti" con la quota base del mese
export interface Quota { riga: number; mese: string; email: string; nome: string; stato: StatoQuota | 'nessuna' | 'base'; importo: number; pagataIl?: string; nota: string; calcolata?: Calcolata }
export interface Calcolata { base: number; ammanco: number; mesi: string[]; importo: number }
// Settembre: quota base ridotta più i debiti della stagione prima
export const diSettembre = (mese: string) => mese.slice(5, 7) === '09';

export async function quote(): Promise<Quota[]> {
  await idScheda(QUOTE, COLONNE_QUOTE, FOGLIO_TESORERIA_ID);
  return (await leggiScheda(QUOTE, FOGLIO_TESORERIA_ID))
    .filter((r) => /^\d{4}-\d{2}$/.test(r['Mese']) && r['Email'] && /^(pagata|esonerat|nessuna|da pagare|quota base)/i.test(r['Stato']))
    .map((r) => ({
      riga: r.riga,
      mese: r['Mese'],
      email: r['Email'].toLowerCase(),
      nome: r['Corista'] ?? '',
      stato: /^pagata/i.test(r['Stato']) ? 'pagata' : /^nessuna/i.test(r['Stato']) ? 'nessuna' : /^da pagare/i.test(r['Stato']) ? 'da-pagare' : /^quota base/i.test(r['Stato']) ? 'base' : 'esonerato',
      importo: numero(r['Importo']),
      pagataIl: dataFoglio(r['Pagata il']),
      nota: r['Nota'] ?? '',
    }));
}

// Chi ha quote nel foglio ma non è nella scheda Coristi (ex coristi caricati dai rendiconti passati)
export const exCoristi = (tutte: Quota[], elenco: SchedaCorista[]) => {
  const noti = new Set(elenco.map((c) => c.email));
  const visti = new Map<string, string>();
  for (const q of tutte) if (q.email !== TUTTI && !noti.has(q.email)) visti.set(q.email, q.nome || q.email);
  return [...visti].map(([email, nome]) => ({ email, nome }));
};

// I mesi in cui la quota non si raccoglie
export const mesiSenzaQuota = (tutte: Quota[]) => new Set(tutte.filter((q) => q.email === TUTTI && q.stato === 'nessuna').map((q) => q.mese));

const chiave = (email: string, mese: string) => `${email}|${mese}`;
// Le quote per corista e mese, più le quote base dei mesi (chiave "tutti|mese"). Con l'elenco dei
// coristi ci sono anche le quote di settembre di chi non ha una riga nel foglio, calcolate come quota
// base più ammanco della stagione prima (riga 0: esonerato se fa zero), e ogni quota di settembre
// porta il calcolo, anche se la cifra è scritta a mano.
export function indice(tutte: Quota[], elenco?: SchedaCorista[]) {
  const idx = new Map(tutte.filter((q) => q.email !== TUTTI || q.stato === 'base').map((q) => [chiave(q.email, q.mese), { ...q }]));
  if (!elenco || !tutte.length) return idx;
  const senza = mesiSenzaQuota(tutte);
  const stagioni = tutte.map((q) => stagioneDi(`${q.mese}-15`));
  // Dalla stagione più vecchia: l'ammanco di una stagione comprende il suo settembre, calcolato prima.
  // Della stagione prima della più vecchia nel foglio non si sa niente: nessun debito.
  const prima = Math.min(...stagioni);
  for (let anno = prima; anno <= stagioneCorrente() + 1; anno++) {
    const settembre = `${anno}-09`;
    if (senza.has(settembre)) continue;
    const mesiPrima = anno > prima ? mesiDelleQuote(anno - 1, tutte).filter((m) => m <= questoMese()) : [];
    for (const c of attiviNelMese(elenco, settembre)) {
      const mesi = mesiPrima.filter((m) => attiviNelMese([c], m).length && statoDi(idx, c.email, m) === 'da-pagare');
      const base = quotaBase(idx, settembre);
      const ammanco = centesimi(mesi.reduce((t, m) => t + dovutoDi(idx, c.email, m), 0));
      const calcolata = { base, ammanco, mesi, importo: centesimi(base + ammanco) };
      const q = idx.get(chiave(c.email, settembre));
      if (q) q.calcolata = calcolata;
      else idx.set(chiave(c.email, settembre), {
        riga: 0, mese: settembre, email: c.email, nome: `${c.nome} ${c.cognome}`,
        stato: calcolata.importo ? 'da-pagare' : 'esonerato', importo: calcolata.importo, nota: '', calcolata,
      });
    }
  }
  return idx;
}
export const quotaDi = (idx: Map<string, Quota>, email: string, mese: string) => idx.get(chiave(email, mese));
export const statoDi = (idx: Map<string, Quota>, email: string, mese: string): StatoQuota => {
  const s = idx.get(chiave(email, mese))?.stato;
  return s === 'pagata' || s === 'esonerato' ? s : 'da-pagare';
};
// La quota base di un mese: quella indicata dal tesoriere per quel mese, altrimenti la solita
// (a settembre quotaSettembre, di base metà quota)
export const quotaBase = (idx: Map<string, Quota>, mese: string) =>
  idx.get(chiave(TUTTI, mese))?.importo ?? (diSettembre(mese) ? conf().quotaSettembre ?? quotaMensile() / 2 : quotaMensile());
// Quanto deve (o doveva) un corista per un mese: la quota base; a settembre la sua cifra (quota base più debiti)
export const dovutoDi = (idx: Map<string, Quota>, email: string, mese: string) => {
  if (!diSettembre(mese)) return quotaBase(idx, mese);
  const q = idx.get(chiave(email, mese));
  return !q || q.stato === 'esonerato' ? 0 : q.importo;
};

export interface SituazioneMese {
  mese: string;
  senzaQuota: boolean;
  attesi: SchedaCorista[];
  pagate: number;
  esonerati: number;
  daPagare: number;
  raccolto: number;   // le quote di quel mese pagate (in qualunque giorno), anche da chi non è più nella scheda Coristi
  dovuto: number;     // le quote dei non esonerati (a settembre le cifre dei debiti)
}

export function situazioneMese(mese: string, elenco: SchedaCorista[], idx: Map<string, Quota>, senza = new Set<string>()): SituazioneMese {
  const tutteDelMese = [...idx.values()].filter((q) => q.mese === mese && q.stato === 'pagata');
  const attesi = attiviNelMese(elenco, mese);
  const stati = attesi.map((c) => idx.get(chiave(c.email, mese)));
  const pagate = stati.filter((q) => q?.stato === 'pagata');
  const esonerati = stati.filter((q) => q?.stato === 'esonerato').length;
  const senzaQuota = senza.has(mese);
  return {
    mese, senzaQuota, attesi,
    pagate: pagate.length,
    esonerati,
    daPagare: senzaQuota ? 0 : attesi.length - pagate.length - esonerati,
    raccolto: tutteDelMese.reduce((t, q) => t + q.importo, 0),
    dovuto: senzaQuota ? 0 : centesimi(attesi.filter((c) => statoDi(idx, c.email, mese) !== 'esonerato').reduce((t, c) => t + dovutoDi(idx, c.email, mese), 0)),
  };
}

export interface Arretrato { corista: SchedaCorista; mesi: string[]; importo: number }

// Chi deve ancora pagare le quote dei mesi indicati (di solito: quelli della stagione fino a oggi)
export function arretrati(mesi: string[], elenco: SchedaCorista[], idx: Map<string, Quota>): Arretrato[] {
  return elenco
    .map((c) => {
      const suoi = mesi.filter((m) => attiviNelMese([c], m).length && statoDi(idx, c.email, m) === 'da-pagare');
      return { corista: c, mesi: suoi, importo: centesimi(suoi.reduce((t, m) => t + dovutoDi(idx, c.email, m), 0)) };
    })
    .filter((a) => a.mesi.length);
}

// La quota base di un mese per tutti (giugno, settembre): se è quella solita la riga si toglie
export async function segnaQuotaBase(mese: string, importo: number, da: string) {
  if (!/^\d{4}-\d{2}$/.test(mese)) throw new Error('Mese non valido.');
  const cifra = centesimi(importo);
  if (!(cifra >= 0)) throw new Error('Quota non valida.');
  if (!cifra && !diSettembre(mese)) throw new Error('Per un mese senza quota usa «Nessuna quota questo mese».');
  const tutte = await quote();
  const esistente = tutte.find((q) => q.email === TUTTI && q.mese === mese && q.stato === 'base');
  const solita = quotaBase(new Map(), mese);
  if (cifra === solita) {
    if (esistente) await cancellaRiga(QUOTE, esistente.riga, FOGLIO_TESORERIA_ID);
    return;
  }
  await scriviRiga(QUOTE, [testo(mese), 'Tutti i coristi', TUTTI, 'Quota base', cifra, '', '', da, adesso()], esistente?.riga, FOGLIO_TESORERIA_ID);
}

// Segna la quota di un corista per un mese: pagata (oggi, o il giorno dato; la quota intera, o
// l'importo dato), esonerato (con il motivo nella nota) o da pagare (si cancella la riga).
// A settembre l'importo di "da pagare" è la cifra del corista: zero vale esonerato, e "esonerato" vale
// zero; se la cifra è quella calcolata (quota base più ammanco, senza nota) la riga si toglie, così
// segue da sola le correzioni della quota base e della stagione prima.
export async function segnaQuota(email: string, mese: string, stato: StatoQuota, nota: string, da: string, pagataIl?: string, importo?: number) {
  if (!/^\d{4}-\d{2}$/.test(mese)) throw new Error('Mese non valido.');
  const elenco = await coristi();
  const c = elenco.find((x) => x.email === email.toLowerCase());
  if (!c) throw new Error('Corista non trovato nella scheda Coristi.');
  const tutte = await quote();
  const esistente = tutte.find((q) => q.email === c.email && q.mese === mese);
  if (diSettembre(mese) && stato !== 'pagata') {
    const calcolata = quotaDi(indice(tutte, elenco), c.email, mese)?.calcolata?.importo ?? 0;
    const cifra = centesimi(stato === 'esonerato' ? 0 : importo !== undefined && importo >= 0 ? importo : calcolata);
    if (cifra === calcolata && !nota.trim()) {
      if (esistente) await cancellaRiga(QUOTE, esistente.riga, FOGLIO_TESORERIA_ID);
      return;
    }
    await scriviRiga(QUOTE, [testo(mese), testo(`${c.nome} ${c.cognome}`), c.email, cifra ? 'Da pagare' : 'Esonerato', cifra, '', testo(nota.trim().slice(0, 300)), da, adesso()], esistente?.riga, FOGLIO_TESORERIA_ID);
    return;
  }
  if (stato === 'da-pagare') {
    if (esistente) await cancellaRiga(QUOTE, esistente.riga, FOGLIO_TESORERIA_ID);
    return;
  }
  const giorno = stato === 'pagata' ? (pagataIl && /^\d{4}-\d{2}-\d{2}$/.test(pagataIl) ? pagataIl : esistente?.stato === 'pagata' && esistente.pagataIl ? esistente.pagataIl : oggi()) : '';
  const solito = () => dovutoDi(indice(tutte, elenco), c.email, mese);
  const quanto = stato === 'pagata' ? centesimi(importo !== undefined && importo >= 0 ? importo : esistente?.stato === 'pagata' ? esistente.importo : solito()) : 0;
  if (stato === 'pagata' && diSettembre(mese) && !quanto) throw new Error('A settembre la cifra zero vuol dire esonerato: scrivi quanto ha versato.');
  const valori = [
    testo(mese), testo(`${c.nome} ${c.cognome}`), c.email,
    stato === 'pagata' ? 'Pagata' : 'Esonerato',
    quanto,
    giorno ? perFoglio(giorno) : '',
    testo(nota.trim().slice(0, 300)), da, adesso(),
  ];
  await scriviRiga(QUOTE, valori, esistente?.riga, FOGLIO_TESORERIA_ID);
}

// Un mese senza quota per nessuno (sì) o di nuovo con la quota (no)
export async function segnaMeseSenzaQuota(mese: string, senza: boolean, nota: string, da: string) {
  if (!/^\d{4}-\d{2}$/.test(mese)) throw new Error('Mese non valido.');
  const esistente = (await quote()).find((q) => q.email === TUTTI && q.mese === mese && q.stato === 'nessuna');
  if (!senza) {
    if (esistente) await cancellaRiga(QUOTE, esistente.riga, FOGLIO_TESORERIA_ID);
    return;
  }
  await scriviRiga(QUOTE, [testo(mese), 'Tutti i coristi', TUTTI, 'Nessuna quota', 0, '', testo(nota.trim().slice(0, 300)), da, adesso()], esistente?.riga, FOGLIO_TESORERIA_ID);
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
      tipo: (/^uscita/i.test(r['Tipo']) ? 'Uscita' : /^saldo|^avanzo/i.test(r['Tipo']) ? 'Saldo iniziale' : 'Entrata') as TipoMovimento,
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
    return { ok: true, messaggio: `Movimento «${esistente.descrizione || esistente.categoria || 'avanzo di cassa'}» cancellato.`, data: esistente.data };
  }
  const tipo = (['Entrata', 'Uscita', 'Saldo iniziale'] as const).find((t) => t === v('tipo'));
  const data = v('data');
  const importo = numero(v('importo'));
  const categoria = tipo === 'Saldo iniziale' ? '' : v(tipo === 'Uscita' ? 'categoria-uscita' : 'categoria-entrata');
  const descrizione = v('descrizione').slice(0, 200);
  if (!tipo) return { ok: false, messaggio: 'Scegli se è un’entrata, un’uscita o l’avanzo di cassa.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, messaggio: 'Data non valida.' };
  if (!(importo > 0) && tipo !== 'Saldo iniziale') return { ok: false, messaggio: 'Scrivi un importo maggiore di zero.' };
  if (tipo !== 'Saldo iniziale' && !descrizione) return { ok: false, messaggio: 'Scrivi una breve descrizione.' };
  const nuovoId = esistente?.id ?? randomBytes(4).toString('hex');
  const valori = [nuovoId, perFoglio(data), tipo, testo(categoria), testo(descrizione), centesimi(importo), testo(v('note').slice(0, 500)), email, esistente ? adesso() : ''];
  await scriviRiga(MOVIMENTI, valori, esistente?.riga, FOGLIO_TESORERIA_ID);
  return { ok: true, messaggio: esistente ? 'Movimento aggiornato.' : `${tipo === 'Uscita' ? 'Uscita' : tipo === 'Entrata' ? 'Entrata' : 'Avanzo di cassa'} di ${euroEsatto(importo)} registrata.`, data };
}

// ——— Verifiche di cassa (conto corrente e contanti) ———

export interface Verifica { riga: number; id: string; data: string; contoCorrente: number; contanti: number; note: string }

export async function verifiche(): Promise<Verifica[]> {
  await idScheda(VERIFICHE, COLONNE_VERIFICHE, FOGLIO_TESORERIA_ID);
  return (await leggiScheda(VERIFICHE, FOGLIO_TESORERIA_ID))
    .map((r) => ({ riga: r.riga, id: r['ID'], data: dataFoglio(r['Data']) ?? '', contoCorrente: numero(r['Saldo conto corrente']), contanti: numero(r['Contanti in cassa']), note: r['Note'] ?? '' }))
    .filter((x) => x.id && x.data)
    .sort((a, b) => b.data.localeCompare(a.data) || b.riga - a.riga);
}

export async function gestisciVerifica(f: FormData, email: string): Promise<{ ok: boolean; messaggio: string; data?: string }> {
  const v = (k: string) => String(f.get(k) ?? '').trim();
  await idScheda(VERIFICHE, COLONNE_VERIFICHE, FOGLIO_TESORERIA_ID);
  if (v('azione') === 'cancella-verifica') {
    const x = (await verifiche()).find((y) => y.id === v('id'));
    if (!x) return { ok: false, messaggio: 'Verifica non trovata.' };
    await cancellaRiga(VERIFICHE, x.riga, FOGLIO_TESORERIA_ID);
    return { ok: true, messaggio: 'Verifica cancellata.', data: x.data };
  }
  const data = v('data');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, messaggio: 'Data non valida.' };
  if (!v('conto') && !v('contanti')) return { ok: false, messaggio: 'Scrivi il saldo del conto corrente e i contanti in cassa.' };
  await scriviRiga(VERIFICHE, [randomBytes(4).toString('hex'), perFoglio(data), centesimi(numero(v('conto'))), centesimi(numero(v('contanti'))), testo(v('note').slice(0, 300)), email], undefined, FOGLIO_TESORERIA_ID);
  return { ok: true, messaggio: 'Verifica di cassa registrata.', data };
}

// ——— Cassa: il rendiconto entrate-uscite della stagione ———

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
  saldoInizialeRiportato: boolean; // l'avanzo viene dalla stagione prima (non scritto a mano)
  mesi: MeseCassa[];
  quote: number;
  entrate: number;
  uscite: number;
  partiteDiGiro: { entrate: number; uscite: number };
  speseDiGestione: number;         // uscite meno le partite di giro
  saldoFinale: number;
  perCategoria: { tipo: 'Entrata' | 'Uscita'; categoria: string; totale: number }[];
  movimenti: Movimento[];          // della stagione, dal più vecchio
}

export function cassa(anno: number, tutte: Quota[], tutti: Movimento[]): Cassa {
  const mesi = mesiDellaStagione(anno);
  const inStagione = tutti.filter((m) => mesi.includes(meseDi(m.data)));
  const manuale = inStagione.filter((m) => m.tipo === 'Saldo iniziale');
  // L'avanzo di cassa: scritto a mano, o il saldo finale della stagione prima se ci sono i suoi dati
  const precedente = !manuale.length && haDati(anno - 1, tutte, tutti) ? cassa(anno - 1, tutte, tutti).saldoFinale : 0;
  const saldoIniziale = manuale.length ? manuale.reduce((t, m) => t + m.importo, 0) : precedente;
  const pagate = tutte.filter((q) => q.stato === 'pagata' && q.email !== TUTTI);
  const righe = mesi.map((mese) => {
    const qui = inStagione.filter((m) => meseDi(m.data) === mese);
    const q = pagate.filter((x) => meseDi(x.pagataIl ?? `${x.mese}-01`) === mese);
    const quoteMese = q.reduce((t, x) => t + x.importo, 0);
    const entrate = qui.filter((m) => m.tipo === 'Entrata').reduce((t, m) => t + m.importo, 0);
    const uscite = qui.filter((m) => m.tipo === 'Uscita').reduce((t, m) => t + m.importo, 0);
    return { mese, quote: quoteMese, numeroQuote: q.length, entrate, uscite, saldo: quoteMese + entrate - uscite, movimenti: qui };
  });
  const somma = (k: 'quote' | 'entrate' | 'uscite') => centesimi(righe.reduce((t, r) => t + r[k], 0));
  const perCategoria = new Map<string, { tipo: 'Entrata' | 'Uscita'; categoria: string; totale: number }>();
  for (const m of inStagione) {
    if (m.tipo === 'Saldo iniziale') continue;
    const k = `${m.tipo}|${m.categoria || 'Senza categoria'}`;
    const x = perCategoria.get(k) ?? { tipo: m.tipo, categoria: m.categoria || 'Senza categoria', totale: 0 };
    x.totale += m.importo;
    perCategoria.set(k, x);
  }
  const giro = (tipo: TipoMovimento) => inStagione.filter((m) => m.tipo === tipo && PARTITE_DI_GIRO.includes(m.categoria)).reduce((t, m) => t + m.importo, 0);
  return {
    anno, saldoIniziale: centesimi(saldoIniziale), saldoInizialeRiportato: !manuale.length && precedente !== 0, mesi: righe,
    quote: somma('quote'), entrate: somma('entrate'), uscite: somma('uscite'),
    partiteDiGiro: { entrate: giro('Entrata'), uscite: giro('Uscita') },
    speseDiGestione: centesimi(somma('uscite') - giro('Uscita')),
    saldoFinale: centesimi(saldoIniziale + somma('quote') + somma('entrate') - somma('uscite')),
    perCategoria: [...perCategoria.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || b.totale - a.totale),
    movimenti: [...inStagione].sort((a, b) => a.data.localeCompare(b.data) || a.riga - b.riga),
  };
}

const haDati = (anno: number, tutte: Quota[], tutti: Movimento[]) => {
  const mesi = mesiDellaStagione(anno);
  return tutti.some((m) => mesi.includes(meseDi(m.data))) || tutte.some((q) => q.stato === 'pagata' && mesi.includes(meseDi(q.pagataIl ?? `${q.mese}-01`)));
};

// Le stagioni di cui c'è qualcosa nel foglio, più quella in corso (la più recente prima)
export const stagioniConDati = (tutte: Quota[], tutti: Movimento[]) =>
  [...new Set([stagioneCorrente(), ...tutte.map((q) => stagioneDi(`${q.mese}-15`)), ...tutti.map((m) => stagioneDi(m.data))])].sort((a, b) => b - a);

// ——— Prove e onorari dei maestri ———

export type Vocalita = 'nessuna' | 'singola' | 'doppia';
export interface ProvaMaestro {
  id: string;              // dell'evento nel calendario Prove, o "manuale-…" per una prova non in calendario
  data: string;
  titolo: string;
  inCalendario: boolean;
  maestro: string;         // il Direttore, un sostituto, o '' se la prova non si paga
  onorario: number;
  vocalita: Vocalita;
  importoVocalita: number;
  note: string;
  cambiata: boolean;       // c'è una riga nel foglio (non è la prova "solita")
  riga?: number;
}

const importoVocalita = (v: Vocalita) => (v === 'singola' ? onorari().vocalitaSingola : v === 'doppia' ? onorari().vocalitaDoppia : 0);

async function righeMaestri() {
  await idScheda(MAESTRI, COLONNE_MAESTRI, FOGLIO_TESORERIA_ID);
  return leggiScheda(MAESTRI, FOGLIO_TESORERIA_ID);
}

// Le prove della stagione fino a oggi: quelle del calendario "Prove" (di base con il Direttore e il
// suo onorario) con le modifiche del foglio, più quelle aggiunte a mano
export async function proveDeiMaestri(anno: number): Promise<ProvaMaestro[]> {
  const fine = [fineDi(anno), oggi()].sort()[0];
  const [calendario, righe] = await Promise.all([eventi(inizioDi(anno), fine), righeMaestri()]);
  const perId = new Map(righe.filter((r) => r['ID prova']).map((r) => [r['ID prova'], r]));
  const daRiga = (r: Record<string, string> & { riga: number }) => {
    const v = (/^(singola|doppia)/i.exec(r['Vocalità'] ?? '')?.[1]?.toLowerCase() ?? 'nessuna') as Vocalita;
    return { maestro: r['Maestro'] ?? '', onorario: numero(r['Onorario']), vocalita: v, importoVocalita: r['Importo vocalità'] ? numero(r['Importo vocalità']) : importoVocalita(v), note: r['Note'] ?? '', cambiata: true, riga: r.riga };
  };
  const prove: ProvaMaestro[] = calendario
    .filter((e) => e.tipo === 'prova' && e.data <= oggi())
    .map((e) => {
      const r = perId.get(e.id);
      return {
        id: e.id, data: e.data, titolo: e.titolo, inCalendario: true,
        ...(r ? daRiga(r) : { maestro: direttore(), onorario: onorari().prova, vocalita: 'nessuna' as Vocalita, importoVocalita: 0, note: '', cambiata: false }),
      };
    });
  const aMano = righe
    .filter((r) => r['ID prova']?.startsWith('manuale-'))
    .map((r) => ({ id: r['ID prova'], data: dataFoglio(r['Data']) ?? '', titolo: 'Prova (non in calendario)', inCalendario: false, ...daRiga(r) }))
    .filter((p) => p.data >= inizioDi(anno) && p.data <= fineDi(anno));
  return [...prove, ...aMano].sort((a, b) => a.data.localeCompare(b.data));
}

// Salva come è andata una prova: chi l'ha diretta, l'onorario, la lezione di vocalità. Senza id, una
// prova nuova non in calendario; con elimina, toglie la prova aggiunta a mano o torna al solito
export async function salvaProvaMaestro(d: { id?: string; data?: string; maestro?: string; onorario?: number; vocalita?: string; note?: string; elimina?: boolean }, da: string) {
  const righe = await righeMaestri();
  const id = d.id || `manuale-${randomBytes(4).toString('hex')}`;
  const esistente = righe.find((r) => r['ID prova'] === id);
  if (d.elimina) {
    if (esistente) await cancellaRiga(MAESTRI, esistente.riga, FOGLIO_TESORERIA_ID);
    return { id };
  }
  const data = d.data && /^\d{4}-\d{2}-\d{2}$/.test(d.data) ? d.data : esistente ? dataFoglio(esistente['Data']) : undefined;
  if (!data) throw new Error('Data della prova non valida.');
  const vocalita = (['nessuna', 'singola', 'doppia'] as const).find((x) => x === d.vocalita) ?? 'nessuna';
  const maestro = (d.maestro ?? direttore()).trim().slice(0, 80);
  const onorario = d.onorario !== undefined && d.onorario >= 0 ? centesimi(d.onorario) : maestro === direttore() ? onorari().prova : maestro ? onorari().sostituto : 0;
  const valori = [testo(id), perFoglio(data), testo(maestro), onorario, vocalita === 'nessuna' ? '' : maiuscola(vocalita), importoVocalita(vocalita), testo((d.note ?? '').trim().slice(0, 200)), da, adesso()];
  await scriviRiga(MAESTRI, valori, esistente?.riga, FOGLIO_TESORERIA_ID);
  return { id };
}

export interface MeseMaestri { mese: string; proveDirettore: number; direttore: number; sostituti: Map<string, { prove: number; totale: number }>; vocalita: { singole: number; doppie: number; totale: number } }

export function onorariPerMese(prove: ProvaMaestro[]): MeseMaestri[] {
  const mesi = new Map<string, MeseMaestri>();
  for (const p of prove) {
    const mese = meseDi(p.data);
    const m = mesi.get(mese) ?? { mese, proveDirettore: 0, direttore: 0, sostituti: new Map(), vocalita: { singole: 0, doppie: 0, totale: 0 } };
    if (p.maestro === direttore()) { m.proveDirettore++; m.direttore += p.onorario; }
    else if (p.maestro) { const s = m.sostituti.get(p.maestro) ?? { prove: 0, totale: 0 }; s.prove++; s.totale += p.onorario; m.sostituti.set(p.maestro, s); }
    if (p.vocalita === 'singola') m.vocalita.singole++;
    if (p.vocalita === 'doppia') m.vocalita.doppie++;
    m.vocalita.totale += p.importoVocalita;
    mesi.set(mese, m);
  }
  return [...mesi.values()].sort((a, b) => a.mese.localeCompare(b.mese));
}

// La sede di un affitto, dalla descrizione (coro.coristi.tesoreria.sedi); senza corrispondenza, "Altre sedi"
export const sedeDi = (m: Movimento) => conf().sedi.find((s) => s.parole.some((p) => m.descrizione.toLowerCase().includes(p.toLowerCase())))?.nome ?? 'Altre sedi';
export const nomiSedi = () => conf().sedi.map((s) => s.nome);

// Quanto è stato pagato per gli onorari nella stagione, dalle uscite della cassa
export const pagatoPer = (c: Cassa, categoria: string) => c.movimenti.filter((m) => m.tipo === 'Uscita' && m.categoria === categoria).reduce((t, m) => t + m.importo, 0);

// ——— Sollecito ———

// Il messaggio per chi deve pagare, dal modello con {nome}, {mesi} e {importo}
export const MODELLO_SOLLECITO = 'Ciao {nome}, risulta ancora da versare la quota del coro di {mesi} ({importo}). Puoi darla al tesoriere alla prossima prova. Grazie!';
const elencoMesi = (mesi: string[]) => { const n = mesi.map(nomeMese); return n.length > 1 ? `${n.slice(0, -1).join(', ')} e ${n.at(-1)}` : n[0] ?? ''; };
export const testoSollecito = (modello: string, a: Arretrato) =>
  modello.replaceAll('{nome}', a.corista.nome.split(' ')[0]).replaceAll('{mesi}', elencoMesi(a.mesi)).replaceAll('{importo}', euro(a.importo));

// Gli indirizzi con cui un corista può essere iscritto alle notifiche (dell'associazione e personale)
export const indirizziDi = (c: SchedaCorista) => [c.email, c.emailPersonale].filter(Boolean).map((e) => normalizza(e));
