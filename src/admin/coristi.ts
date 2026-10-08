// Amministrazione → Coristi (/admin/coristi, dall'8/10/2026): la scheda Coristi del foglio "Coristi e
// assenze" gestita dal sito, con l'account di servizio. Una riga per periodo nel coro: chi esce e poi
// rientra ha più righe con la stessa email dell'associazione; nome, cognome, sezione, email personale
// e numero di socio si tengono uguali su tutte le sue righe, la nota è del periodo.
// L'email dell'associazione non si cambia: è la chiave di assenze, quote, notifiche e accessi.
// Il sito scrive solo il foglio: l'account @romamusicanta.org e l'iscrizione al gruppo coro@ si fanno
// dalla console di Workspace.
import { coro } from '../motore/coro';
import { cancellaRiga, coristiVeri, dimenticaCoristi, intestazioneScheda, leggiScheda, oggi, scriviRiga, SEZIONI, type SchedaCorista } from '../area/dati';
import { normalizza } from '../area/servizio';
import { spiegaTesto } from '../area/errori';

const SCHEDA = 'Coristi';
const COLONNE = ['N. socio', 'Nome', 'Cognome', 'Sezione', 'Email personale', 'Email associazione', 'Dal', 'Al', 'Note'];
const DOMINIO = coro.amministrazione?.dominio ?? 'romamusicanta.org';

// Il testo così com'è (il foglio non lo prende per un numero, una data o una formula)
const testo = (v: string) => (v ? `'${v}` : '');
const perFoglio = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');
const giorno = (iso?: string) => perFoglio(iso) || '…';

// L'indirizzo dell'associazione proposto per un nome: nome.cognome, senza accenti, spazi e apostrofi
export const emailProposta = (nome: string, cognome: string) => {
  const pulito = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  return nome && cognome ? `${pulito(nome)}.${pulito(cognome)}@${DOMINIO}` : '';
};

// L'ancora di un corista nell'elenco
export const ancora = (email: string) => `c-${email.split('@')[0].replace(/[^a-z0-9]/gi, '-')}`;

type Riga = { riga: number } & Record<string, string>;
interface Dati { nome: string; cognome: string; sezione: string; emailPersonale: string; numeroSocio: string }
interface PeriodoScritto { dal: string; al: string; nota: string }

async function scrivi(valori: Record<string, string>, riga?: number) {
  const intestazione = await intestazioneScheda(SCHEDA);
  if (COLONNE.some((c) => !intestazione.includes(c))) throw new Error('Nella scheda Coristi manca una colonna: controlla l’intestazione del foglio.');
  await scriviRiga(SCHEDA, intestazione.map((t) => valori[t] ?? ''), riga);
}

// Le colonne di una riga come sono nel foglio, per riscriverla cambiando solo alcune
const comeNelFoglio = (r: Riga) => Object.fromEntries(COLONNE.map((c) => [c, c === 'Dal' || c === 'Al' ? r[c] ?? '' : testo(r[c] ?? '')]));
const colonneDati = (d: Dati) => ({ 'N. socio': testo(d.numeroSocio), Nome: testo(d.nome), Cognome: testo(d.cognome), Sezione: d.sezione, 'Email personale': testo(d.emailPersonale) });
const colonnePeriodo = (p: PeriodoScritto) => ({ Dal: perFoglio(p.dal), Al: perFoglio(p.al), Note: testo(p.nota) });

const campo = (f: FormData, nome: string, max = 120) => String(f.get(nome) ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const data = (f: FormData, nome: string) => {
  const v = campo(f, nome, 10);
  if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Data non valida.');
  return v;
};

function leggiDati(f: FormData): Dati {
  const d = { nome: campo(f, 'nome', 60), cognome: campo(f, 'cognome', 60), sezione: campo(f, 'sezione', 30), emailPersonale: campo(f, 'emailPersonale', 120).toLowerCase(), numeroSocio: campo(f, 'numeroSocio', 10) };
  if (!d.nome || !d.cognome) throw new Error('Scrivi nome e cognome.');
  if (!SEZIONI.includes(d.sezione)) throw new Error('Scegli la sezione.');
  if (d.emailPersonale && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.emailPersonale)) throw new Error('L’email personale non sembra un indirizzo valido.');
  return d;
}

function leggiPeriodo(f: FormData): PeriodoScritto {
  const p = { dal: data(f, 'dal'), al: data(f, 'al'), nota: campo(f, 'nota', 300) };
  if (!p.dal) throw new Error('Scrivi la data di inizio del periodo.');
  if (p.al && p.al < p.dal) throw new Error('La fine del periodo viene prima dell’inizio.');
  return p;
}

// I periodi di un corista, con quello nuovo o cambiato (riga 0 = nuovo), non si devono sovrapporre e
// solo l'ultimo può essere ancora aperto
function controllaPeriodi(c: SchedaCorista | undefined, p: PeriodoScritto, riga = 0) {
  const tutti = [...(c?.periodi ?? []).filter((x) => x.riga !== riga).map((x) => ({ dal: x.dal ?? '', al: x.al ?? '' })), { dal: p.dal, al: p.al }]
    .sort((a, b) => a.dal.localeCompare(b.dal));
  for (let i = 1; i < tutti.length; i++) {
    const prima = tutti[i - 1];
    if (!prima.al) throw new Error(`Il periodo dal ${giorno(prima.dal)} è ancora aperto: prima di aggiungerne uno dopo scrivi la sua data di fine.`);
    if (prima.al >= tutti[i].dal) throw new Error(`I periodi si sovrappongono: uno finisce il ${giorno(prima.al)} e il successivo comincia il ${giorno(tutti[i].dal)}.`);
  }
}

async function gestisci(f: FormData): Promise<{ messaggio: string; email?: string }> {
  const azione = String(f.get('azione') ?? '');
  const righe = (await leggiScheda(SCHEDA)) as Riga[];
  const elenco = await coristiVeri();
  const chi = normalizza(String(f.get('email') ?? ''));
  const c = elenco.find((x) => x.email === chi);
  const righeDi = (email: string) => righe.filter((r) => (r['Email associazione'] ?? '').toLowerCase() === email);

  if (azione === 'nuovo') {
    const d = leggiDati(f);
    const email = (campo(f, 'emailAssociazione', 120) || emailProposta(d.nome, d.cognome)).toLowerCase();
    if (!new RegExp(`^[a-z0-9._-]+@${DOMINIO.replace(/\./g, '\\.')}$`).test(email)) throw new Error(`L’email dell’associazione deve finire con @${DOMINIO}.`);
    const gia = elenco.find((x) => x.email === email);
    if (gia) throw new Error(`${gia.nome} ${gia.cognome} ha già l’indirizzo ${email}: se rientra nel coro, aggiungi un periodo nella sua scheda.`);
    const p = leggiPeriodo(f);
    await scrivi({ ...colonneDati(d), 'Email associazione': email, ...colonnePeriodo(p) });
    return { messaggio: `${d.nome} ${d.cognome} aggiunto alla scheda Coristi.`, email };
  }
  if (!c) throw new Error('Corista non trovato nella scheda Coristi: ricarica la pagina.');

  if (azione === 'dati') {
    const d = leggiDati(f);
    // Gli stessi dati su tutte le righe (i periodi) del corista
    for (const r of righeDi(c.email)) await scrivi({ ...comeNelFoglio(r), ...colonneDati(d) }, r.riga);
    return { messaggio: `Dati di ${d.nome} ${d.cognome} salvati.`, email: c.email };
  }
  if (azione === 'periodo') {
    const riga = Number(f.get('riga') ?? 0);
    const p = leggiPeriodo(f);
    controllaPeriodi(c, p, riga);
    if (riga) {
      const r = righeDi(c.email).find((x) => x.riga === riga);
      if (!r) throw new Error('Periodo non trovato: la scheda è cambiata nel frattempo, ricarica la pagina.');
      await scrivi({ ...comeNelFoglio(r), ...colonnePeriodo(p) }, riga);
      return { messaggio: `Periodo di ${c.nome} ${c.cognome} salvato${p.al ? `: nel coro fino al ${giorno(p.al)}` : ''}.`, email: c.email };
    }
    // Un periodo in più: i dati della persona come nella sua riga più recente
    const ultima = righeDi(c.email).find((x) => x.riga === c.periodi.at(-1)!.riga)!;
    await scrivi({ ...comeNelFoglio(ultima), ...colonnePeriodo(p) });
    return { messaggio: `Nuovo periodo di ${c.nome} ${c.cognome} dal ${giorno(p.dal)}.`, email: c.email };
  }
  if (azione === 'togli-periodo') {
    const riga = Number(f.get('riga') ?? 0);
    if (c.periodi.length < 2) throw new Error('È l’unico periodo di questo corista: si può cambiare, non togliere.');
    if (!c.periodi.some((x) => x.riga === riga) || !righeDi(c.email).some((x) => x.riga === riga)) throw new Error('Periodo non trovato: ricarica la pagina.');
    await cancellaRiga(SCHEDA, riga);
    return { messaggio: `Periodo tolto dalla scheda di ${c.nome} ${c.cognome}.`, email: c.email };
  }
  throw new Error('Azione sconosciuta.');
}

// POST della pagina: salva e torna all'elenco, sul corista, con l'esito
export async function dopoIlModulo(request: Request, percorso: string) {
  const f = await request.formData();
  let p: URLSearchParams;
  let email: string | undefined;
  try {
    const r = await gestisci(f);
    email = r.email;
    p = new URLSearchParams({ esito: r.messaggio, ok: '1' });
  } catch (e) {
    email = String(f.get('email') ?? '') || undefined;
    p = new URLSearchParams({ esito: `Non è stato possibile salvare. ${spiegaTesto(e)}`, ok: '0' });
    if (f.get('azione') === 'nuovo') p.set('nuovo', '');
  } finally {
    dimenticaCoristi();
  }
  if (email) p.set('apri', email);
  return `${percorso}?${p}${email ? `#${ancora(email)}` : ''}`;
}

// Nel coro adesso o in arrivo: un periodo ancora aperto o che finisce oggi o dopo
export const attuale = (c: SchedaCorista) => c.periodi.some((p) => !p.al || p.al >= oggi());
