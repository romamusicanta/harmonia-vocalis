// Nel browser, Amministrazione: la finestra «Importa dal Chorus Repository» (src/admin/repository.ts).
// scegliDalRepository apre la finestra sulla cartella usata l'ultima volta per quel tipo di file, si
// scorrono le cartelle (/admin/repository/elenco) e si spuntano i file; restituisce quelli scelti (vuoto
// se si annulla). importa chiede a un endpoint di caricamento (rispondiCaricamento in src/area/drive.ts)
// di copiare un file del repository dove andrebbe caricato, con i dati della pagina (extra).
import './repository.css';

export type Tipi = 'immagini' | 'spartiti' | 'audio';
export interface Scelto { id: string; nome: string; tipo: string; byte?: number }
interface Elenco {
  ok: boolean; errore?: string;
  percorso: { id: string; nome: string }[];
  cartelle: { id: string; nome: string }[];
  file: (Scelto & { miniatura: boolean })[];
}

const NOMI: Record<Tipi, string> = { immagini: 'le foto', spartiti: 'gli spartiti (PDF o immagini)', audio: 'i file audio' };
const chiave = (t: Tipi) => `hv-repository-${t}`;
const ricorda = (t: Tipi, cartella: string) => { try { localStorage.setItem(chiave(t), cartella); } catch {} };
const ricordata = (t: Tipi) => { try { return localStorage.getItem(chiave(t)) ?? undefined; } catch { return undefined; } };
const peso = (b?: number) => (b === undefined ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`);
const icona = (tipo: string) => (tipo.startsWith('audio/') ? '♪' : tipo === 'application/pdf' ? 'PDF' : '▢');
const testo = (s: string) => { const d = document.createElement('span'); d.textContent = s; return d.innerHTML; };

export function scegliDalRepository(o: { tipi: Tipi; multipli?: boolean; titolo?: string }): Promise<Scelto[]> {
  return new Promise((risolvi) => {
    const d = document.createElement('dialog');
    d.className = 'finestra-repository';
    d.innerHTML = `
      <form method="dialog">
        <header>
          <h2>${testo(o.titolo ?? 'Importa dal Chorus Repository')}</h2>
          <p class="nota">Si vedono le cartelle e ${NOMI[o.tipi]}. ${o.multipli === false ? 'Scegli un file' : 'Spunta uno o più file'} e premi «Importa»: il sito ne fa una copia, il repository non cambia.</p>
          <nav class="percorso" aria-label="Cartella"></nav>
        </header>
        <div class="contenuto" aria-live="polite"></div>
        <footer>
          <span class="quanti nota"></span>
          <button type="button" class="btn o piccolo annulla">Annulla</button>
          <button type="submit" class="btn g piccolo importa" disabled>Importa</button>
        </footer>
      </form>`;
    document.body.append(d);
    const percorso = d.querySelector<HTMLElement>('.percorso')!;
    const contenuto = d.querySelector<HTMLElement>('.contenuto')!;
    const quanti = d.querySelector<HTMLElement>('.quanti')!;
    const pulsante = d.querySelector<HTMLButtonElement>('.importa')!;
    // I file scelti restano scelti anche cambiando cartella
    const scelti = new Map<string, Scelto>();
    const aggiorna = () => {
      pulsante.disabled = !scelti.size;
      pulsante.textContent = scelti.size > 1 ? `Importa ${scelti.size} file` : 'Importa';
      quanti.textContent = scelti.size ? `${scelti.size} ${scelti.size === 1 ? 'file scelto' : 'file scelti'}` : '';
    };
    let fine = false;
    const chiudi = (esito: Scelto[]) => { if (fine) return; fine = true; d.close(); d.remove(); risolvi(esito); };

    async function apri(cartella?: string) {
      contenuto.innerHTML = '<p class="nota attesa">Sto leggendo il repository…</p>';
      try {
        const r = await fetch(`/admin/repository/elenco?${new URLSearchParams({ tipi: o.tipi, ...(cartella ? { cartella } : {}) })}`);
        const e: Elenco = await r.json().catch(() => ({ ok: false, errore: `Il sito non ha risposto (${r.status}).` }));
        if (!e.ok) throw new Error(e.errore);
        const qui = e.percorso.at(-1)!.id;
        ricorda(o.tipi, qui);
        percorso.innerHTML = e.percorso.map((p, i) => i === e.percorso.length - 1
          ? `<span aria-current="page">${testo(p.nome)}</span>`
          : `<button type="button" class="link" data-cartella="${p.id}">${testo(p.nome)}</button><span aria-hidden="true">›</span>`).join('');
        const righe = [
          ...e.cartelle.map((c) => `<li><button type="button" class="cartella" data-cartella="${c.id}"><span class="segno" aria-hidden="true">▸</span>${testo(c.nome)}</button></li>`),
          ...e.file.map((f) => `
            <li><label class="file">
              <input type="${o.multipli === false ? 'radio' : 'checkbox'}" name="scelto" value="${f.id}" ${scelti.has(f.id) ? 'checked' : ''} />
              ${f.miniatura ? `<img src="/admin/repository/miniatura/${f.id}" alt="" loading="lazy" />` : `<span class="segno-file" aria-hidden="true">${icona(f.tipo)}</span>`}
              <span class="nome">${testo(f.nome)}<small>${peso(f.byte)}</small></span>
            </label></li>`),
        ];
        contenuto.innerHTML = righe.length ? `<ul class="${e.file.some((f) => f.miniatura) ? 'con-miniature' : ''}">${righe.join('')}</ul>` : '<p class="nota">In questa cartella non ci sono altre cartelle né file che si possano importare qui.</p>';
        const perId = new Map(e.file.map((f) => [f.id, f]));
        contenuto.querySelectorAll<HTMLInputElement>('input[name=scelto]').forEach((c) => c.addEventListener('change', () => {
          if (o.multipli === false) scelti.clear();
          const f = perId.get(c.value)!;
          if (c.checked) scelti.set(f.id, { id: f.id, nome: f.nome, tipo: f.tipo, byte: f.byte }); else scelti.delete(f.id);
          aggiorna();
        }));
      } catch (err) {
        contenuto.innerHTML = `<p class="messaggio errore">Non riesco a leggere il Chorus Repository: ${testo((err as Error).message)}</p>`;
        if (cartella) contenuto.insertAdjacentHTML('beforeend', '<p><button type="button" class="btn o piccolo" data-cartella="">Torna all’inizio del repository</button></p>');
      }
    }

    d.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-cartella]');
      if (b) apri(b.dataset.cartella || undefined);
    });
    d.querySelector('.annulla')!.addEventListener('click', () => chiudi([]));
    d.addEventListener('close', () => chiudi([]));
    d.querySelector('form')!.addEventListener('submit', (e) => { e.preventDefault(); chiudi([...scelti.values()]); });
    d.showModal();
    apri(ricordata(o.tipi));
  });
}

// Copia un file del repository attraverso un endpoint di caricamento; restituisce l'id della copia
export async function importa(indirizzo: string, id: string, extra: Record<string, string> = {}): Promise<string | undefined> {
  const r = await fetch(indirizzo, { method: 'POST', headers: { 'x-azione': 'importa', 'Content-Type': 'application/json' }, body: JSON.stringify({ ...extra, id }) });
  const esito = await r.json().catch(() => ({ ok: false, errore: `Il sito non ha risposto (${r.status}).` }));
  if (!esito.ok) throw new Error(esito.errore);
  return esito.id;
}

// Importa i file scelti uno dopo l'altro, con il punto a cui si è (avanzamento da 0 a 1); restituisce
// gli id delle copie e i file non importati, con il motivo
export async function importaTutti(scelti: Scelto[], indirizzo: string, extra: (s: Scelto) => Record<string, string>, avanzamento?: (quota: number, messaggio: string) => void) {
  const ids: string[] = [];
  const errori: string[] = [];
  for (const [i, s] of scelti.entries()) {
    avanzamento?.(i / scelti.length, `Importo «${s.nome}»${scelti.length > 1 ? ` (${i + 1} di ${scelti.length})` : ''}…`);
    try {
      const id = await importa(indirizzo, s.id, extra(s));
      if (id) ids.push(id);
    } catch (e) {
      errori.push(`${s.nome}: ${(e as Error).message}`);
    }
  }
  avanzamento?.(1, '');
  return { ids, errori };
}

// Il messaggio alla fine: «3 file importati. Non importati: …»
export const esitoImportazione = (fatti: number, errori: string[], nome = ['file importato', 'file importati']) =>
  `${fatti ? `${fatti} ${fatti === 1 ? nome[0] : nome[1]}.` : 'Niente importato.'}${errori.length ? ` Non importati: ${errori.join(' · ')}` : ''}`;
