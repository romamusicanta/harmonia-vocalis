// Avvisi della bacheca dell'area coristi: scheda "Bacheca" del foglio "Coristi e assenze" (la crea
// il sito al primo avviso), scritta dall'account di servizio. Li scrive chi ha un ruolo in
// coro.coristi.bacheca (Maestro, presidente, tesoriere, amministratori: un gruppo Google per ruolo),
// dall'area coristi, da quella del Maestro o dall'Amministrazione; ognuno modifica e cancella gli
// avvisi firmati con i suoi ruoli (gli amministratori, tutti). Una riga per avviso, leggibile e
// correggibile anche direttamente nel foglio.
import { randomBytes } from 'node:crypto';
import { coro } from '../motore/coro';
import { adesso, cancellaRiga, idScheda, leggiScheda, oggi, scriviRiga } from './dati';
import { avvisiDiEsempio, EMAIL_REDAZIONE, inDemo } from './demo';
import { nelGruppo } from './servizio';
import { spiegaTesto } from './errori';

const SCHEDA = 'Bacheca';
const COLONNE = ['ID', 'Pubblicato il', 'Firma', 'Titolo', 'Testo', 'Fino al', 'Scritto da', 'Modificato il'];

export type Ruolo = NonNullable<typeof coro.coristi>['bacheca'][number];
export const ruoli = (): Ruolo[] => coro.coristi?.bacheca ?? [];

export interface Avviso {
  riga: number;
  id: string;
  pubblicato: string;     // AAAA-MM-GG
  ruolo?: Ruolo;
  firma: string;          // come scritta nel foglio (l'id del ruolo o un testo libero)
  titolo: string;
  testo: string;
  finoAl?: string;        // AAAA-MM-GG: dopo questo giorno non si vede più in bacheca
  scrittoDa: string;
}

// "03/10/2026 08:15" o "2026-10-03" → "2026-10-03"
const giorno = (v?: string) => {
  const it = v?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (it) return `${it[3]}-${it[2].padStart(2, '0')}-${it[1].padStart(2, '0')}`;
  return v?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
};
const perFoglio = (iso: string) => iso.split('-').reverse().join('/');

// I ruoli di un indirizzo (i gruppi che non esistono ancora valgono come "no")
export async function ruoliDi(email: string): Promise<Ruolo[]> {
  const dentro = (gruppo: string) => nelGruppo(email, gruppo).catch(() => false);
  const esiti = await Promise.all(ruoli().map(async (r) => (await dentro(r.gruppo)) && !(r.tranne && (await dentro(r.tranne)))));
  return ruoli().filter((_, i) => esiti[i]);
}

// Tutti gli avvisi, i più recenti prima
export async function avvisi(): Promise<Avviso[]> {
  // Modalità demo (src/area/demo.ts): al posto degli avvisi veri, testi liberi, quelli d'esempio
  if (inDemo()) {
    return avvisiDiEsempio(oggi())
      .map((a, i) => ({ ...a, riga: i + 2, ruolo: ruoli().find((x) => x.id === a.firma), scrittoDa: EMAIL_REDAZIONE }))
      .filter((a) => a.ruolo);
  }
  await idScheda(SCHEDA, COLONNE);
  const elenco = (await leggiScheda(SCHEDA))
    .filter((r) => r['ID'] && (r['Titolo'] || r['Testo']))
    .map((r) => ({
      riga: r.riga,
      id: r['ID'],
      pubblicato: giorno(r['Pubblicato il']) ?? '',
      ruolo: ruoli().find((x) => x.id === r['Firma'] || x.firma === r['Firma']),
      firma: r['Firma'],
      titolo: r['Titolo'],
      testo: r['Testo'],
      finoAl: giorno(r['Fino al']),
      scrittoDa: r['Scritto da'],
    }))
    .sort((a, b) => b.pubblicato.localeCompare(a.pubblicato) || b.riga - a.riga);
  return elenco;
}

// Quelli da mostrare in bacheca oggi
export const inBacheca = (elenco: Avviso[]) => elenco.filter((a) => !a.finoAl || a.finoAl >= oggi());
export const firmaDi = (a: Avviso) => a.ruolo?.firma ?? a.firma;
// Nuovo: pubblicato negli ultimi 7 giorni
export const nuovo = (a: Avviso) => a.pubblicato >= new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

// Chi ha questi ruoli può modificare e cancellare l'avviso?
export const puoModificare = (a: Avviso, suoi: Ruolo[]) => suoi.some((r) => r.tutti || r.id === a.ruolo?.id);

// Testo per WhatsApp: titolo in grassetto, testo, firma e link alla bacheca
export function perWhatsapp(a: Pick<Avviso, 'titolo' | 'testo'> & { firma: string }, sito: string) {
  return [a.titolo && `*${a.titolo}*`, a.testo, `— ${a.firma}`, `${sito}/area`].filter(Boolean).join('\n\n');
}
export const linkWhatsapp = (testo: string) => `https://wa.me/?text=${encodeURIComponent(testo)}`;

// Gestione da modulo (POST): azione=salva (id per modificare) o cancella. Restituisce un messaggio
// per la pagina e, dopo un salvataggio, l'avviso salvato (per il pulsante WhatsApp).
export async function gestisci(f: FormData, email: string): Promise<{ ok: boolean; messaggio: string; salvato?: Avviso }> {
  const suoi = await ruoliDi(email);
  if (!suoi.length) return { ok: false, messaggio: 'Non hai un ruolo per scrivere in bacheca.' };
  const azione = String(f.get('azione') ?? '');
  const id = String(f.get('id') ?? '');
  const esistente = id ? (await avvisi()).find((a) => a.id === id) : undefined;
  if (id && !esistente) return { ok: false, messaggio: 'Avviso non trovato: forse è stato cancellato.' };
  if (esistente && !puoModificare(esistente, suoi)) return { ok: false, messaggio: 'Puoi modificare solo gli avvisi firmati con i tuoi ruoli.' };

  if (azione === 'cancella') {
    if (!esistente) return { ok: false, messaggio: 'Avviso non trovato.' };
    await cancellaRiga(SCHEDA, esistente.riga);
    return { ok: true, messaggio: `Avviso «${esistente.titolo}» cancellato.` };
  }
  if (azione !== 'salva') return { ok: false, messaggio: 'Azione sconosciuta.' };

  const titolo = String(f.get('titolo') ?? '').trim().slice(0, 140);
  const testo = String(f.get('testo') ?? '').replace(/\r\n/g, '\n').trim().slice(0, 4000);
  const ruolo = suoi.find((r) => r.id === f.get('firma'));
  const finoAl = String(f.get('fino') ?? '');
  if (!titolo) return { ok: false, messaggio: 'Manca il titolo.' };
  if (!ruolo) return { ok: false, messaggio: 'Scegli con quale firma pubblicare.' };
  if (finoAl && !/^\d{4}-\d{2}-\d{2}$/.test(finoAl)) return { ok: false, messaggio: 'Data "fino al" non valida.' };

  const nuovoId = esistente?.id ?? randomBytes(4).toString('hex');
  const pubblicato = esistente?.pubblicato || oggi();
  // Il testo si scrive come testo (apostrofo iniziale): niente formule né date interpretate
  const valori = [nuovoId, perFoglio(pubblicato), ruolo.id, `'${titolo}`, `'${testo}`, finoAl ? perFoglio(finoAl) : '', esistente?.scrittoDa || email, esistente ? adesso() : ''];
  await scriviRiga(SCHEDA, valori, esistente?.riga);
  const salvato: Avviso = { riga: esistente?.riga ?? 0, id: nuovoId, pubblicato, ruolo, firma: ruolo.id, titolo, testo, finoAl: finoAl || undefined, scrittoDa: email };
  return { ok: true, messaggio: esistente ? 'Avviso aggiornato.' : 'Avviso pubblicato in bacheca.', salvato };
}

// Per le pagine: esegue l'azione del modulo e restituisce dove tornare (con l'esito; se non è
// andata, anche quanto scritto, per non perderlo)
export async function dopoIlModulo(request: Request, email: string, percorso: string) {
  const f = await request.formData();
  const r = await gestisci(f, email).catch((e) => ({ ok: false, messaggio: `Non è stato possibile salvare. ${spiegaTesto(e)}`, salvato: undefined }));
  const p = new URLSearchParams({ esito: r.messaggio, ok: r.ok ? '1' : '0' });
  if (r.salvato) p.set('avviso', r.salvato.id);
  if (!r.ok && f.get('azione') === 'salva') for (const k of ['titolo', 'testo', 'fino']) p.set(k, String(f.get(k) ?? ''));
  return `${percorso}?${p}${r.salvato ? `#avviso-${r.salvato.id}` : ''}`;
}
