// Nel browser: carica un file a pezzi da 3,5 MB con gli endpoint di src/area/drive.ts
// (rispondiCaricamento). "inizia" apre la sessione su Drive con i dati della pagina (extra), poi i
// pezzi uno dopo l'altro; avanzamento da 0 a 1. Se un pezzo non passa (rete instabile, schermo
// del telefono bloccato) si riprova fino a tre volte, aspettando sempre di più, dallo stesso punto.
// Finché il caricamento non è finito, chiudere la pagina chiede conferma.
const attendi = (ms: number) => new Promise((r) => setTimeout(r, ms));
const trattieni = (e: BeforeUnloadEvent) => { e.preventDefault(); };

async function richiesta(indirizzo: string, init: RequestInit) {
  const r = await fetch(indirizzo, init);
  const esito = await r.json().catch(() => ({ ok: false, errore: `Il sito non ha risposto (${r.status}).` }));
  if (!esito.ok) throw new Error(esito.errore);
  return esito;
}

// Restituisce l'id su Drive del file caricato
export async function carica(indirizzo: string, file: File, extra: Record<string, string>, avanzamento?: (quota: number) => void): Promise<string | undefined> {
  addEventListener('beforeunload', trattieni);
  let id: string | undefined;
  try {
    const avvio = await richiesta(indirizzo, {
      method: 'POST', headers: { 'x-azione': 'inizia', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...extra, nome: file.name, tipo: file.type, dimensione: file.size }),
    });
    for (let inizio = 0; inizio < file.size; inizio += avvio.pezzo) {
      avanzamento?.(inizio / file.size);
      for (let tentativo = 0; ; tentativo++) {
        try {
          const r = await richiesta(indirizzo, { method: 'POST', headers: { 'x-gettone': avvio.gettone, 'x-inizio': String(inizio) }, body: file.slice(inizio, inizio + avvio.pezzo) });
          if (r.id) id = r.id;
          break;
        } catch (e) {
          if (tentativo >= 3) throw new Error(`Caricamento interrotto al ${Math.round((inizio / file.size) * 100)}%: ${(e as Error).message} Tieni la pagina aperta e riprova.`);
          await attendi([2000, 5000, 10000][tentativo]);
        }
      }
    }
    avanzamento?.(1);
  } finally {
    removeEventListener('beforeunload', trattieni);
  }
  return id;
}
