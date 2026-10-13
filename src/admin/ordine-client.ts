// Riordino di un elenco di foto nel browser (carosello della home in Foto dei concerti, carosello del
// Maestro in Foto del sito): trascinamento sul computer, frecce ↑ ↓ (anche sul telefono); dopo una
// pausa di 0,8 secondi si salva tutto l'ordine con una richiesta. Ogni voce è un <li data-id> con
// .posto (il numero), .su e .giu; dalla posizione limite in poi la voce ha la classe «fuori».
export function attivaOrdine(lista: HTMLOListElement, esito: HTMLElement, salvaOrdine: (ids: string[]) => Promise<void>, limite = Infinity) {
  let attesa: ReturnType<typeof setTimeout> | undefined;
  const voci = () => [...lista.querySelectorAll<HTMLLIElement>(':scope > li')];
  const numera = () => voci().forEach((li, i, tutte) => {
    li.querySelector('.posto')!.textContent = String(i + 1);
    li.classList.toggle('fuori', i >= limite);
    li.querySelector<HTMLButtonElement>('.su')!.disabled = i === 0;
    li.querySelector<HTMLButtonElement>('.giu')!.disabled = i === tutte.length - 1;
  });
  const salva = () => {
    numera();
    esito.textContent = 'Ordine cambiato…';
    clearTimeout(attesa);
    attesa = setTimeout(async () => {
      esito.textContent = 'Salvo l\'ordine…';
      try {
        await salvaOrdine(voci().map((li) => li.dataset.id!));
        esito.textContent = 'Ordine salvato: sul sito vale dopo la prossima pubblicazione.';
      } catch (err) {
        esito.textContent = `Ordine non salvato: ${(err as Error).message}`;
      }
    }, 800);
  };
  numera();
  lista.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('.su, .giu');
    if (!b) return;
    const li = b.closest('li')!;
    if (b.classList.contains('su') && li.previousElementSibling) li.previousElementSibling.before(li);
    else if (b.classList.contains('giu') && li.nextElementSibling) li.nextElementSibling.after(li);
    else return;
    b.focus();
    salva();
  });
  let trascinata: HTMLLIElement | undefined;
  lista.addEventListener('dragstart', (e) => {
    trascinata = (e.target as Element).closest('li') ?? undefined;
    trascinata?.classList.add('trascinata');
    e.dataTransfer?.setData('text/plain', trascinata?.dataset.id ?? '');
  });
  lista.addEventListener('dragover', (e) => {
    const su = (e.target as Element).closest<HTMLLIElement>('li');
    if (!trascinata || !su || su === trascinata) return;
    e.preventDefault();
    voci().forEach((x) => x.classList.toggle('sopra', x === su));
  });
  lista.addEventListener('drop', (e) => {
    const su = (e.target as Element).closest<HTMLLIElement>('li');
    if (!trascinata || !su || su === trascinata) return;
    e.preventDefault();
    // Prima o dopo, secondo dove cade rispetto alla foto sotto
    const r = su.getBoundingClientRect();
    if (e.clientX < r.left + r.width / 2) su.before(trascinata); else su.after(trascinata);
    salva();
  });
  lista.addEventListener('dragend', () => {
    trascinata?.classList.remove('trascinata');
    voci().forEach((x) => x.classList.remove('sopra'));
    trascinata = undefined;
  });
  return { voci, numera, salva };
}

// POST JSON con risposta { ok, errore }
export async function inviaJson(url: string, corpo: object) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({ ok: false }));
  if (!j.ok) throw new Error(j.errore ?? `Errore ${r.status}`);
  return j;
}
