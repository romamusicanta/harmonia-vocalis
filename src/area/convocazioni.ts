// Convocazioni ai concerti: scheda "Convocazioni" del foglio "Coristi e assenze" (la crea il sito),
// una riga per concerto, legata all'evento del calendario pubblico "Concerti" dal suo ID. Lì stanno
// solo le informazioni riservate ai coristi: orario di convocazione, prova generale (anche in un
// altro giorno o luogo), programma della giornata, abito, cosa portare, come arrivare, pezzi del
// repertorio, note. Le scrivono i redattori (Amministrazione); i coristi le leggono nella pagina Concerti della loro area. La presenza
// si segna come per le prove, con "Non ci sarò" (scheda Assenze).
import { adesso, eventi, idScheda, leggiScheda, oggi, piuGiorni, scriviRiga, type Evento } from './dati';
import { spiegaTesto } from './errori';

const SCHEDA = 'Convocazioni';
const COLONNE = ['ID evento', 'Data', 'Concerto', 'Convocazione', 'Ritrovo', 'Prova generale data', 'Prova generale ora', 'Prova generale luogo', 'Programma', 'Abito', 'Portare', 'Come arrivare', 'Repertorio', 'Note', 'Aggiornato il', 'Aggiornato da'];
export const SEPARATORE_PEZZI = ' · ';

export interface Convocazione {
  riga: number;
  idEvento: string;
  convocazione: string;      // "16:00"
  ritrovo: string;           // dove ci si ritrova, se non è il luogo del concerto
  generale: { data: string; ora: string; luogo: string }; // data AAAA-MM-GG (vuota = il giorno del concerto)
  programma: { ora: string; cosa: string }[]; // nel foglio una riga per voce, "16:30 Prova acustica"
  abito: string;
  portare: string[];         // una riga per cosa
  arrivare: string;
  repertorio: string[];      // titoli dei pezzi del repertorio
  note: string;
}

const righe = (v = '') => v.split('\n').map((r) => r.trim()).filter(Boolean);
const giorno = (v?: string) => {
  const it = v?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (it) return `${it[3]}-${it[2].padStart(2, '0')}-${it[1].padStart(2, '0')}`;
  return v?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
};
const ora = (v = '') => v.match(/^(\d{1,2})[:.](\d{2})/)?.slice(1).map((x, i) => (i ? x : x.padStart(2, '0'))).join(':') ?? '';

export async function convocazioni(): Promise<Map<string, Convocazione>> {
  await idScheda(SCHEDA, COLONNE);
  const elenco = (await leggiScheda(SCHEDA)).filter((r) => r['ID evento']).map((r): Convocazione => ({
    riga: r.riga,
    idEvento: r['ID evento'],
    convocazione: ora(r['Convocazione']),
    ritrovo: r['Ritrovo'],
    generale: { data: giorno(r['Prova generale data']), ora: ora(r['Prova generale ora']), luogo: r['Prova generale luogo'] },
    programma: righe(r['Programma']).map((x) => { const m = x.match(/^(\d{1,2}[:.]\d{2})\s*[-–·]?\s*(.*)$/); return m ? { ora: ora(m[1]), cosa: m[2] } : { ora: '', cosa: x }; }),
    abito: r['Abito'],
    portare: righe(r['Portare']),
    arrivare: r['Come arrivare'],
    repertorio: (r['Repertorio'] ?? '').split(SEPARATORE_PEZZI).map((x) => x.trim()).filter(Boolean),
    note: r['Note'],
  }));
  return new Map(elenco.map((c) => [c.idEvento, c]));
}

// I concerti da oggi a un anno, dal calendario Concerti
export const concertiInArrivo = async (): Promise<Evento[]> => (await eventi(oggi(), piuGiorni(oggi(), 366))).filter((e) => e.tipo === 'concerto');

// C'è qualcosa da mostrare?
export const vuota = (c?: Convocazione) => !c || !(c.convocazione || c.generale.ora || c.programma.length || c.abito || c.portare.length || c.arrivare || c.repertorio.length || c.note);

const t = (v?: string) => (v ? `'${v}` : '');
const perFoglio = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

// Modulo (POST): salva la convocazione del concerto (evento)
export async function gestisci(f: FormData, email: string): Promise<{ ok: boolean; messaggio: string; evento?: string }> {
  const v = (k: string) => String(f.get(k) ?? '').replace(/\r\n/g, '\n').trim();
  const idEvento = v('evento');
  const e = (await concertiInArrivo()).find((x) => x.id === idEvento);
  if (!e) return { ok: false, messaggio: 'Concerto non trovato nel calendario: ricarica la pagina.' };
  for (const k of ['convocazione', 'generale-ora']) if (v(k) && !/^\d{2}:\d{2}$/.test(v(k))) return { ok: false, messaggio: 'Orario non valido.', evento: idEvento };
  if (v('generale-data') && !/^\d{4}-\d{2}-\d{2}$/.test(v('generale-data'))) return { ok: false, messaggio: 'Data della prova generale non valida.', evento: idEvento };
  const esistente = (await convocazioni()).get(idEvento);
  const valori = [
    idEvento, perFoglio(e.data), t(e.titolo),
    t(v('convocazione')), t(v('ritrovo')),
    perFoglio(v('generale-data')), t(v('generale-ora')), t(v('generale-luogo')),
    t(v('programma')), t(v('abito')), t(v('portare')), t(v('arrivare')),
    t(f.getAll('repertorio').map(String).filter(Boolean).join(SEPARATORE_PEZZI)),
    t(v('note')), adesso(), email,
  ];
  await scriviRiga(SCHEDA, valori, esistente?.riga);
  return { ok: true, messaggio: `Convocazione del ${e.data.split('-').reverse().join('/')} salvata.`, evento: idEvento };
}

export async function dopoIlModulo(request: Request, email: string, percorso: string) {
  const f = await request.formData();
  const r = await gestisci(f, email).catch((e) => ({ ok: false, messaggio: `Non è stato possibile salvare. ${spiegaTesto(e)}`, evento: String(f.get('evento') ?? '') }));
  const p = new URLSearchParams({ esito: r.messaggio, ok: r.ok ? '1' : '0' });
  if (!r.ok && r.evento) p.set('modifica', r.evento);
  return `${percorso}?${p}${r.ok && r.evento ? `#c-${r.evento}` : ''}`;
}
