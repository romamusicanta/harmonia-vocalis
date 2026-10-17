// Le voci delle tracce di studio del repertorio (dal 17/10/2026): una traccia è di una voce, e ogni
// voce appartiene a una sezione del coro (src/area/dati.ts, SEZIONI), così il corista dei bassi vede
// in evidenza sia «Baritoni» sia «Bassi». Sezione vuota = per tutti (Tutte le voci, la base). Il
// catalogo è fisso; i redattori aggiungono altre voci caricando una traccia (nome e sezione stanno
// nella riga della traccia, e da lì tornano nell'elenco). Niente import dal server: lo usa anche lo
// script del modulo, che indovina la voce dal nome del file.
export interface Voce { nome: string; sezione: string }

export const VOCI: Voce[] = [
  { nome: 'Soprani', sezione: 'Soprani' },
  { nome: 'Soprani I', sezione: 'Soprani' },
  { nome: 'Soprani II', sezione: 'Soprani' },
  { nome: 'Contralti', sezione: 'Contralti' },
  { nome: 'Contralti I', sezione: 'Contralti' },
  { nome: 'Contralti II', sezione: 'Contralti' },
  { nome: 'Tenori', sezione: 'Tenori' },
  { nome: 'Tenori I', sezione: 'Tenori' },
  { nome: 'Tenori II', sezione: 'Tenori' },
  { nome: 'Baritoni', sezione: 'Bassi' },
  { nome: 'Bassi', sezione: 'Bassi' },
  { nome: 'Bassi I', sezione: 'Bassi' },
  { nome: 'Bassi II', sezione: 'Bassi' },
  { nome: 'Tutte le voci', sezione: '' },
  { nome: 'Base', sezione: '' },
];

// Il catalogo più le voci aggiunte dai redattori (quelle già usate nelle tracce), dopo le fisse
export function catalogoVoci(usate: Voce[] = []): Voce[] {
  const tutte = [...VOCI];
  for (const v of usate) if (v.nome && !tutte.some((x) => x.nome === v.nome)) tutte.push(v);
  return tutte;
}

// Ordine delle voci in un gruppo di tracce: quello del catalogo
export const ordineVoce = (nome: string, catalogo: Voce[]) => {
  const i = catalogo.findIndex((v) => v.nome === nome);
  return i < 0 ? catalogo.length : i;
};

// Dal nome del file la voce più probabile ("Kyrie_Sop1.mp3" → Soprani I, "gloria-bar.m4a" →
// Baritoni); undefined se non si capisce. Si corregge sempre prima di caricare.
export function indovinaVoce(file: string, catalogo: Voce[] = VOCI): string | undefined {
  const n = file.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\.[a-z0-9]{2,4}$/, '');
  // Prima le voci aggiunte dai redattori, scritte per intero
  for (const v of catalogo.slice(VOCI.length)) if (n.includes(v.nome.toLowerCase())) return v.nome;
  const parti = n.split(/[^a-z0-9]+/).filter(Boolean);
  const radici: [RegExp, string][] = [
    [/^(soprani|soprano|sopr|sop|s)(\d|i{1,2})?$/, 'Soprani'],
    [/^(contralti|contralto|alti|alto|alt|a|c)(\d|i{1,2})?$/, 'Contralti'],
    [/^(tenori|tenore|tenor|ten|t)(\d|i{1,2})?$/, 'Tenori'],
    [/^(baritoni|baritono|baritone|bar)$/, 'Baritoni'],
    [/^(bassi|basso|bass|bas|b)(\d|i{1,2})?$/, 'Bassi'],
    [/^(tutti|tutte|tutto|coro|full|all|insieme)$/, 'Tutte le voci'],
    [/^(base|piano|pianoforte|pf|accompagnamento)$/, 'Base'],
  ];
  // Le lettere sole (s, a, t, b) valgono con il numero ("T1") o in fondo al nome, dove di solito sta la voce
  for (const [i, p] of [...parti.entries()].reverse()) {
    for (const [re, voce] of radici) {
      const m = p.match(re);
      if (!m || (m[1].length === 1 && !m[2] && i !== parti.length - 1)) continue;
      const dopo = parti[i + 1];
      const num = m[2] ?? (dopo && /^(1|2|i|ii)$/.test(dopo) ? dopo : undefined);
      if (!num || voce === 'Baritoni' || voce === 'Tutte le voci' || voce === 'Base') return voce;
      const romano = num === '1' || num === 'i' ? 'I' : 'II';
      return catalogo.some((v) => v.nome === `${voce} ${romano}`) ? `${voce} ${romano}` : voce;
    }
  }
  return undefined;
}
