// Nel browser: carica un file a pezzi da 3,5 MB con gli endpoint di src/area/drive.ts
// (rispondiCaricamento). "inizia" apre la sessione su Drive con i dati della pagina (extra), poi i
// pezzi uno dopo l'altro; avanzamento da 0 a 1.
export async function carica(indirizzo: string, file: File, extra: Record<string, string>, avanzamento?: (quota: number) => void) {
  const r = await fetch(indirizzo, {
    method: 'POST', headers: { 'x-azione': 'inizia', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...extra, nome: file.name, tipo: file.type, dimensione: file.size }),
  });
  const avvio = await r.json().catch(() => ({ ok: false, errore: `errore ${r.status}` }));
  if (!avvio.ok) throw new Error(avvio.errore);
  for (let inizio = 0; inizio < file.size; inizio += avvio.pezzo) {
    avanzamento?.(inizio / file.size);
    const p = await fetch(indirizzo, { method: 'POST', headers: { 'x-gettone': avvio.gettone, 'x-inizio': String(inizio) }, body: file.slice(inizio, inizio + avvio.pezzo) });
    const esito = await p.json().catch(() => ({ ok: false, errore: `errore ${p.status}` }));
    if (!esito.ok) throw new Error(esito.errore);
  }
  avanzamento?.(1);
}
