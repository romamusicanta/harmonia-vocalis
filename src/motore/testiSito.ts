// Testi principali del sito pubblico che i redattori cambiano dall'Amministrazione (/admin/testi,
// dal 5/10/2026), senza toccare il codice. Al salvataggio l'inglese si scrive da solo (Claude,
// attraverso l'AI Gateway) e si può correggere a mano. I testi salvati stanno nel file
// "Testi del sito.json" della cartella Sito del Drive condiviso; prima della build
// scripts/scarica-allegati.mjs lo porta in coro/immagini/drive/testi/testi.json e, per i corpi in
// Markdown, scrive coro/immagini/drive/testi/<nome>.md (e en/<nome>.md) con l'intestazione del file di
// coro/testi. Qui sotto l'elenco dei testi: quelli di coro.config.ts (fonte "coro", percorso nei dati
// del coro, inglese in coro/coro.en.ts) e quelli di coro/testi/<nome>.md (fonte "testo": un campo
// dell'intestazione o "corpo", il testo in Markdown). Quelli che non sono nel file restano come nel
// codice.

export type TipoTesto = 'riga' | 'paragrafo' | 'markdown';
export interface CampoTesto {
  id: string;            // "coro:stagione.presentazione", "testo:storia.corpo"
  gruppo: string;        // la pagina, per l'Amministrazione
  etichetta: string;
  tipo: TipoTesto;
  dove?: string;         // dove si vede, per chi scrive
  traduci?: false;       // uguale nelle due lingue (la sigla della stagione)
}

export const CAMPI_TESTO: CampoTesto[] = [
  { id: 'coro:stagione.sigla', gruppo: 'Home', etichetta: 'Stagione', tipo: 'riga', traduci: false, dove: 'Il numero grande in alto nella home e nella pagina Concerti, come «26/27».' },
  { id: 'coro:stagione.presentazione', gruppo: 'Home', etichetta: 'Presentazione della stagione', tipo: 'paragrafo', dove: 'Sotto la stagione, in alto nella home.' },
  { id: 'coro:descrizione', gruppo: 'Home', etichetta: 'Descrizione del coro', tipo: 'paragrafo', dove: 'Nel piè di pagina di tutte le pagine e nei risultati di Google.' },
  { id: 'testo:storia.titolo', gruppo: 'Il coro', etichetta: 'Titolo', tipo: 'riga', dove: 'Il titolo della pagina «Il coro».' },
  { id: 'testo:storia.lead', gruppo: 'Il coro', etichetta: 'Introduzione', tipo: 'paragrafo', dove: 'Sotto il titolo.' },
  { id: 'testo:storia.attacco', gruppo: 'Il coro', etichetta: 'Frase in evidenza', tipo: 'paragrafo', dove: 'In grande, all’inizio della storia.' },
  { id: 'testo:storia.corpo', gruppo: 'Il coro', etichetta: 'La storia', tipo: 'markdown' },
  { id: 'coro:maestro.presentazione', gruppo: 'Il Maestro', etichetta: 'Presentazione breve', tipo: 'paragrafo', dove: 'Nella sezione del Maestro della home.' },
  { id: 'testo:maestro.attacco', gruppo: 'Il Maestro', etichetta: 'Frase in evidenza', tipo: 'paragrafo', dove: 'In grande, all’inizio della pagina «Il Maestro».' },
  { id: 'testo:maestro.corpo', gruppo: 'Il Maestro', etichetta: 'Biografia', tipo: 'markdown', dove: 'Ogni «## titolo» è un capitolo e compare nell’indice in testa alla pagina.' },
  { id: 'testo:canta-con-noi.presentazione', gruppo: 'Canta con noi', etichetta: 'Presentazione', tipo: 'paragrafo', dove: 'In alto nella pagina «Canta con noi».' },
  { id: 'testo:organizzatori.presentazione', gruppo: 'Per gli organizzatori', etichetta: 'Presentazione', tipo: 'paragrafo', dove: 'In alto nella pagina «Per gli organizzatori».' },
  { id: 'testo:organizzatori.corpo', gruppo: 'Per gli organizzatori', etichetta: 'Chi siamo, in breve', tipo: 'markdown', dove: 'Continua la prima frase, che si scrive da sola con nome, associazione e direttore.' },
  { id: 'testo:privacy.corpo', gruppo: 'Privacy', etichetta: 'Informativa', tipo: 'markdown' },
];

export const GRUPPI_TESTO = [...new Set(CAMPI_TESTO.map((c) => c.gruppo))];
export const FILE_TESTI = 'Testi del sito.json';

export interface TestoSalvato { it: string; en: string; modificato: string; da: string }
export type TestiSalvati = Record<string, TestoSalvato>;

// I testi salvati com'erano alla build (non nella demo)
const file = import.meta.glob<TestiSalvati>('/coro/immagini/drive/testi/testi.json', { eager: true, import: 'default' });
export const testiPubblicati: TestiSalvati = process.env.DEMO === '1' ? {} : (Object.values(file)[0] ?? {});

const parti = (id: string) => {
  const [fonte, percorso] = id.split(':');
  return { fonte, percorso };
};

// Mette i testi salvati nei dati del coro (italiano) e nella loro versione inglese (coro/coro.en.ts)
export function applicaTestiCoro(it: Record<string, any>, en: Record<string, any>) {
  for (const c of CAMPI_TESTO) {
    const t = testiPubblicati[c.id];
    const { fonte, percorso } = parti(c.id);
    if (!t || fonte !== 'coro') continue;
    imposta(it, percorso, t.it);
    imposta(en, percorso, c.traduci === false ? t.it : t.en);
  }
}

function imposta(o: Record<string, any>, percorso: string, valore: string) {
  const chiavi = percorso.split('.');
  const ultima = chiavi.pop()!;
  let qui = o;
  for (const k of chiavi) qui = qui[k] ??= {};
  qui[ultima] = valore;
}

// I campi dell'intestazione salvati per un testo di coro/testi, in una lingua
export function campiDelTesto(nome: string, lingua: 'it' | 'en') {
  return Object.fromEntries(CAMPI_TESTO.flatMap((c) => {
    const { fonte, percorso } = parti(c.id);
    const [testo, campo] = percorso.split('.');
    const t = testiPubblicati[c.id];
    return fonte === 'testo' && testo === nome && campo !== 'corpo' && t ? [[campo, lingua === 'en' && c.traduci !== false ? t.en : t.it]] : [];
  }));
}

export const fonteDi = parti;
