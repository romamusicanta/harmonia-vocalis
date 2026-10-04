// Menu a tendina con la grafica del sito, al posto dell'elenco del browser. Il <select> resta
// quello vero (si vede chiuso, con le misure del suo modulo, e il suo valore va col modulo):
// cambia solo l'elenco che si apre, disegnato qui. Funziona con mouse, dito e tastiera
// (frecce, Inizio/Fine, Invio, Spazio, Esc, Tab, lettere per cercare). Senza JavaScript resta
// la tendina del browser. Per tenere quella del browser: <select data-nativa>.
// Stile in src/stile/comune.css (.tendina).

let aperta: { select: HTMLSelectElement; elenco: HTMLUListElement; chiudi: (rifocalizza?: boolean) => void } | undefined;
let contatore = 0;

function apri(select: HTMLSelectElement) {
  if (aperta?.select === select) return;
  aperta?.chiudi();
  const contenitore = select.parentElement!;
  const id = `tendina-${++contatore}`;
  const elenco = document.createElement('ul');
  elenco.className = 'tendina-elenco';
  elenco.id = id;
  elenco.setAttribute('role', 'listbox');
  elenco.tabIndex = -1;
  // Stesso carattere del campo chiuso, che cambia da un modulo all'altro
  elenco.style.fontSize = getComputedStyle(select).fontSize;
  const nome = select.labels?.[0]?.textContent?.trim() || select.getAttribute('aria-label');
  if (nome) elenco.setAttribute('aria-label', nome);

  const opzioni = [...select.options];
  const voci = opzioni.map((o, i) => {
    const li = document.createElement('li');
    li.id = `${id}-${i}`;
    li.setAttribute('role', 'option');
    li.textContent = o.textContent;
    li.setAttribute('aria-selected', String(o.selected));
    if (o.disabled) li.setAttribute('aria-disabled', 'true');
    // Le opzioni dentro un <optgroup> si rientrano, preceduto dal nome del gruppo
    const gruppo = o.parentElement instanceof HTMLOptGroupElement ? o.parentElement : undefined;
    if (gruppo && o === gruppo.querySelector('option')) {
      const titolo = document.createElement('li');
      titolo.className = 'tendina-gruppo';
      titolo.setAttribute('role', 'presentation');
      titolo.textContent = gruppo.label;
      elenco.append(titolo);
    }
    if (gruppo) li.classList.add('nel-gruppo');
    elenco.append(li);
    return li;
  });

  let attiva = Math.max(0, select.selectedIndex);
  const evidenzia = (i: number, scorri = true) => {
    voci[attiva]?.classList.remove('attiva');
    attiva = i;
    const v = voci[i];
    if (!v) return;
    v.classList.add('attiva');
    elenco.setAttribute('aria-activedescendant', v.id);
    if (scorri) v.scrollIntoView({ block: 'nearest' });
  };
  const scegli = (i: number) => {
    if (opzioni[i]?.disabled) return;
    if (select.selectedIndex !== i) {
      select.selectedIndex = i;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    chiudi(true);
  };
  const passo = (da: number, verso: 1 | -1) => {
    for (let i = da + verso; i >= 0 && i < voci.length; i += verso) if (!opzioni[i].disabled) return i;
    return da;
  };

  let cerca = '';
  let tempoCerca: ReturnType<typeof setTimeout>;
  elenco.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowDown') evidenzia(passo(attiva, 1));
    else if (k === 'ArrowUp') evidenzia(passo(attiva, -1));
    else if (k === 'Home' || k === 'PageUp') evidenzia(passo(-1, 1));
    else if (k === 'End' || k === 'PageDown') evidenzia(passo(voci.length, -1));
    else if (k === 'Enter' || k === ' ') scegli(attiva);
    else if (k === 'Escape') chiudi(true);
    else if (k === 'Tab') { chiudi(true); return; }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Lettere: salta alla prima voce che comincia così
      clearTimeout(tempoCerca);
      cerca += k.toLowerCase();
      tempoCerca = setTimeout(() => (cerca = ''), 700);
      const trovata = opzioni.findIndex((o) => !o.disabled && o.textContent!.trim().toLowerCase().startsWith(cerca));
      if (trovata >= 0) evidenzia(trovata);
    } else return;
    e.preventDefault();
  });
  elenco.addEventListener('pointermove', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>('[role=option]');
    const i = li ? voci.indexOf(li) : -1;
    if (i >= 0 && i !== attiva && !opzioni[i].disabled) evidenzia(i, false);
  });
  elenco.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>('[role=option]');
    if (li) scegli(voci.indexOf(li));
  });

  // Si apre sotto il campo, o sopra se sotto non c'è spazio
  contenitore.classList.add('aperta');
  contenitore.append(elenco);
  const r = select.getBoundingClientRect();
  const sotto = window.innerHeight - r.bottom;
  if (sotto < Math.min(elenco.scrollHeight, 320) + 12 && r.top > sotto) elenco.classList.add('sopra');
  select.setAttribute('aria-expanded', 'true');
  select.setAttribute('aria-controls', id);
  evidenzia(attiva);
  elenco.focus({ preventScroll: true });

  const fuori = (e: PointerEvent) => {
    if (!contenitore.contains(e.target as Node)) chiudi();
  };
  document.addEventListener('pointerdown', fuori, true);
  function chiudi(rifocalizza = false) {
    document.removeEventListener('pointerdown', fuori, true);
    elenco.remove();
    contenitore.classList.remove('aperta');
    select.setAttribute('aria-expanded', 'false');
    select.removeAttribute('aria-controls');
    if (aperta?.select === select) aperta = undefined;
    if (rifocalizza) select.focus({ preventScroll: true });
  }
  aperta = { select, elenco, chiudi };
}

function prepara(select: HTMLSelectElement) {
  if (select.multiple || select.size > 1 || select.dataset.nativa !== undefined || select.closest('.tendina')) return;
  const contenitore = document.createElement('span');
  contenitore.className = 'tendina';
  select.before(contenitore);
  contenitore.append(select);
  select.setAttribute('aria-haspopup', 'listbox');
  select.setAttribute('aria-expanded', 'false');
  // Il browser non apre il suo elenco: al suo posto quello del sito
  select.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || select.disabled) return;
    e.preventDefault();
    select.focus({ preventScroll: true });
    if (aperta?.select === select) aperta.chiudi(true);
    else apri(select);
  });
  // iPhone e Android aprono il loro selettore al tocco (non se il dito ha fatto scorrere la pagina)
  let inizio: { x: number; y: number } | undefined;
  select.addEventListener('touchstart', (e) => (inizio = { x: e.touches[0].clientX, y: e.touches[0].clientY }), { passive: true });
  select.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    if (select.disabled || !inizio || Math.hypot(t.clientX - inizio.x, t.clientY - inizio.y) > 10) return;
    e.preventDefault();
    select.focus({ preventScroll: true });
    if (aperta?.select === select) aperta.chiudi(true);
    else apri(select);
  });
  select.addEventListener('keydown', (e) => {
    if (select.disabled) return;
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'F4'].includes(e.key) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      apri(select);
    }
  });
}

export function preparaTendine(radice: ParentNode = document) {
  radice.querySelectorAll('select').forEach(prepara);
}

preparaTendine();
