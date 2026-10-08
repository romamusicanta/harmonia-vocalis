// Convocazioni ai concerti: scheda "Convocazioni" del foglio "Coristi e assenze" (la crea il sito),
// una riga per concerto, legata all'evento del calendario pubblico "Concerti" dal suo ID. Lì stanno
// solo le informazioni riservate ai coristi: orario di convocazione, prova generale (sempre una
// prova del calendario "Prove", di cui si tiene l'ID: così ha presenze e promemoria), programma della giornata, abito, cosa portare, come arrivare, pezzi del
// repertorio in programma, bis (anch'essi dal repertorio: non compaiono mai nel sito pubblico), note. Le scrivono i redattori (Amministrazione); i coristi le leggono nella pagina Concerti della loro area. La presenza
// si segna come per le prove, con "Non ci sarò" (scheda Assenze).
import { adesso, eventi, idScheda, leggiScheda, luogoBreveDi, nomeEvento, oggi, piuGiorni, scriviRiga, type Evento } from './dati';
import { spiegaTesto } from './errori';
import { inDemo } from './demo';

const SCHEDA = 'Convocazioni';
const COLONNE = ['ID evento', 'Data', 'Concerto', 'Convocazione', 'Ritrovo', 'Prova generale', 'Programma', 'Abito', 'Portare', 'Come arrivare', 'Repertorio', 'Note', 'Aggiornato il', 'Aggiornato da', 'Bis'];
// Le colonne nuove vanno sempre in fondo: idScheda le aggiunge all'intestazione delle schede già create
export const SEPARATORE_PEZZI = ' · ';

export interface Convocazione {
  riga: number;
  idEvento: string;
  convocazione: string;      // "16:00"
  ritrovo: string;           // dove ci si ritrova, se non è il luogo del concerto
  generale: string;          // ID della prova generale nel calendario "Prove" (vuoto = nessuna)
  programma: { ora: string; cosa: string }[]; // nel foglio una riga per voce, "16:30 Prova acustica"
  abito: string;
  portare: string[];         // una riga per cosa
  arrivare: string;
  repertorio: string[];      // titoli dei pezzi del repertorio in programma, nell'ordine
  bis: string[];             // titoli dei pezzi del repertorio per i bis, nell'ordine (riservati ai coristi)
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
    generale: r['Prova generale'] ?? '',
    programma: righe(r['Programma']).map((x) => { const m = x.match(/^(\d{1,2}[:.]\d{2})\s*[-–·]?\s*(.*)$/); return m ? { ora: ora(m[1]), cosa: m[2] } : { ora: '', cosa: x }; }),
    abito: r['Abito'],
    portare: righe(r['Portare']),
    arrivare: r['Come arrivare'],
    repertorio: (r['Repertorio'] ?? '').split(SEPARATORE_PEZZI).map((x) => x.trim()).filter(Boolean),
    bis: (r['Bis'] ?? '').split(SEPARATORE_PEZZI).map((x) => x.trim()).filter(Boolean),
    note: r['Note'],
  }));
  // Modalità demo (src/area/demo.ts): le note sono testo libero dei redattori, si nascondono
  return new Map(elenco.map((c) => [c.idEvento, inDemo() ? { ...c, note: '' } : c]));
}

// Le prove che possono fare da generale a un concerto: dalle due settimane prima al giorno stesso
export const proveVicine = (e: Evento, tutte: Evento[]) => tutte.filter((x) => x.tipo === 'prova' && x.data <= e.data && x.data >= piuGiorni(e.data, -14));

// I concerti da oggi a un anno, dal calendario Concerti
export const concertiInArrivo = async (): Promise<Evento[]> => (await eventi(oggi(), piuGiorni(oggi(), 366))).filter((e) => e.tipo === 'concerto');

// Il messaggio per il gruppo WhatsApp dei coristi, dopo aver salvato una convocazione
export function convocazionePerWhatsapp(e: Evento, c: Convocazione, generale: Evento | undefined, quando: (data: string) => string, sito: string) {
  const righe = [
    `*Convocazione: ${nomeEvento(e)}*`,
    [`${quando(e.data)}${e.inizio ? `, concerto alle ${e.inizio}` : ''}`, luogoBreveDi(e)].filter(Boolean).join(' · '),
    c.convocazione && `Convocazione alle ${c.convocazione}${c.ritrovo ? ` · ${c.ritrovo}` : ''}`,
    generale && `Prova generale: ${quando(generale.data)}${generale.inizio ? `, ${generale.inizio}` : ''}`,
    c.abito && `Abito: ${c.abito}`,
    c.portare.length > 0 && `Portare: ${c.portare.join(', ')}`,
    c.note,
  ].filter(Boolean);
  return [righe.join('\n'), `Tutti i dettagli e "Non ci sarò": ${sito}/area/concerti#c-${e.id}`].join('\n\n');
}

// C'è qualcosa da mostrare?
export const vuota = (c?: Convocazione) => !c || !(c.convocazione || c.generale || c.programma.length || c.abito || c.portare.length || c.arrivare || c.repertorio.length || c.bis.length || c.note);

const t = (v?: string) => (v ? `'${v}` : '');
const perFoglio = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

// Modulo (POST): salva la convocazione del concerto (evento)
export async function gestisci(f: FormData, email: string): Promise<{ ok: boolean; messaggio: string; evento?: string }> {
  const v = (k: string) => String(f.get(k) ?? '').replace(/\r\n/g, '\n').trim();
  const idEvento = v('evento');
  const e = (await concertiInArrivo()).find((x) => x.id === idEvento);
  if (!e) return { ok: false, messaggio: 'Concerto non trovato nel calendario: ricarica la pagina.' };
  if (v('convocazione') && !/^\d{2}:\d{2}$/.test(v('convocazione'))) return { ok: false, messaggio: 'Orario non valido.', evento: idEvento };
  const esistente = (await convocazioni()).get(idEvento);
  const valori = [
    idEvento, perFoglio(e.data), t(e.titolo),
    t(v('convocazione')), t(v('ritrovo')),
    v('generale'),
    t(v('programma')), t(v('abito')), t(v('portare')), t(v('arrivare')),
    t(f.getAll('repertorio').map(String).filter(Boolean).join(SEPARATORE_PEZZI)),
    t(v('note')), adesso(), email,
    t(f.getAll('bis').map(String).filter(Boolean).join(SEPARATORE_PEZZI)),
  ];
  await scriviRiga(SCHEDA, valori, esistente?.riga);
  return { ok: true, messaggio: `Convocazione del ${e.data.split('-').reverse().join('/')} salvata.`, evento: idEvento };
}

export async function dopoIlModulo(request: Request, email: string, percorso: string) {
  const f = await request.formData();
  const r = await gestisci(f, email).catch((e) => ({ ok: false, messaggio: `Non è stato possibile salvare. ${spiegaTesto(e)}`, evento: String(f.get('evento') ?? '') }));
  const p = new URLSearchParams({ esito: r.messaggio, ok: r.ok ? '1' : '0' });
  if (!r.ok && r.evento) p.set('modifica', r.evento);
  if (r.ok && r.evento) p.set('salvata', r.evento);
  return `${percorso}?${p}${r.ok && r.evento ? `#c-${r.evento}` : ''}`;
}
