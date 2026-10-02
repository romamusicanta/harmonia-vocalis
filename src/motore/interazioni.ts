// Interazioni lato browser comuni a tutte le vesti. Niente framework.
// Si aggancia a classi e attributi data-* presenti nel markup delle pagine.

const $$ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = document) => Array.from(el.querySelectorAll<T>(sel));

// Menu mobile (quello delle aree riservate, .hamb-area, lo gestisce TestataArea della veste Stagione)
const hamb = document.querySelector('.hamb:not(.hamb-area)');
hamb?.addEventListener('click', () => {
  const aperto = document.body.classList.toggle('menu-aperto');
  hamb.setAttribute('aria-expanded', aperto ? 'true' : 'false');
});

// Avviso temporaneo in basso a destra
let toast: HTMLDivElement | undefined;
let timer: ReturnType<typeof setTimeout>;
export function avvisa(testo: string) {
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'avviso-toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  toast.append(testo);
  toast.classList.add('visto');
  clearTimeout(timer);
  timer = setTimeout(() => toast?.classList.remove('visto'), 2600);
}
(window as unknown as { avvisa: typeof avvisa }).avvisa = avvisa;

// Video: miniatura, poi youtube-nocookie solo al clic. I video finti della demo mostrano un avviso.
export function attivaVideo(v: HTMLElement) {
  v.addEventListener('click', () => {
    if (v.dataset.finto !== undefined) {
      avvisa('Demo: nel sito vero qui parte il video da YouTube');
      return;
    }
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${v.dataset.id}?autoplay=1&rel=0`;
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.title = v.getAttribute('aria-label') || 'Video';
    v.replaceChildren(f);
  }, { once: v.dataset.finto === undefined });
}
$$('.video[data-id]').forEach(attivaVideo);

// "Non ci sarò" della demo (quelle vere, con data-evento, le gestisce src/area/ProveVere.astro)
$$('.assenza:not([data-evento])').forEach((a) => {
  a.querySelector('.segnala')?.addEventListener('click', () => {
    a.classList.add('segnalata');
    a.querySelector<HTMLElement>('.nota-assenza textarea, .nota-assenza input')?.focus();
    avvisa('Assenza segnalata al direttivo');
  });
  a.querySelector('.annulla')?.addEventListener('click', () => {
    a.classList.remove('segnalata');
    avvisa('Segnalazione annullata');
  });
});

// Conferma disponibilità Sì / No
$$('.scelta').forEach((s) => {
  $$('button', s).forEach((b) => b.addEventListener('click', () => {
    $$('button', s).forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    b.classList.add('on');
    b.setAttribute('aria-pressed', 'true');
    const esito = s.closest('.riga-conferma')?.querySelector('.esito');
    if (esito) esito.textContent = b.classList.contains('si') ? 'Hai confermato: ci sarai.' : 'Hai segnalato che non ci sarai.';
    avvisa(b.classList.contains('si') ? 'Disponibilità confermata' : 'Indisponibilità registrata');
  }));
});

// Filtri a chip: data-filtri="#bersaglio" sul contenitore, data-filtro="gruppo" e data-valore sui
// bottoni; nel bersaglio, elementi data-voce con data-<gruppo>="valore1 valore2"
$$('[data-filtri]').forEach((contenitore) => {
  const bersaglio = document.querySelector(contenitore.dataset.filtri!);
  if (!bersaglio) return;
  const stato: Record<string, string> = {};
  function applica() {
    $$('[data-voce]', bersaglio!).forEach((el) => {
      const ok = Object.entries(stato).every(([g, v]) => v === 'tutti' || (el.dataset[g] || '').split(' ').includes(v));
      el.classList.toggle('nascosto', !ok);
    });
    $$('[data-gruppo]', bersaglio!).forEach((g) => g.classList.toggle('nascosto', !$$('[data-voce]:not(.nascosto)', g).length));
    bersaglio!.querySelector('.nessun-risultato')?.classList.toggle('nascosto', !!$$('[data-voce]:not(.nascosto)', bersaglio!).length);
  }
  $$('[data-filtro]', contenitore).forEach((b) => {
    const g = b.dataset.filtro!;
    if (b.classList.contains('on')) stato[g] = b.dataset.valore!;
    b.addEventListener('click', () => {
      $$(`[data-filtro="${g}"]`, contenitore).forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      stato[g] = b.dataset.valore!;
      applica();
    });
  });
  applica();
});

// Ricerca testuale semplice: input[data-cerca="#lista"]
$$<HTMLInputElement>('[data-cerca]').forEach((inp) => {
  const lista = document.querySelector(inp.dataset.cerca!);
  if (!lista) return;
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    $$('li', lista).forEach((li) => li.classList.toggle('nascosto', !!q && !li.textContent!.toLowerCase().includes(q)));
  });
});

// Lettore audio finto (demo dell'area coristi)
$$('.audio').forEach((a) => {
  const barra = a.querySelector<HTMLElement>('.onda i');
  const pl = a.querySelector<HTMLElement>('.pl');
  let t: ReturnType<typeof setInterval>;
  pl?.addEventListener('click', () => {
    const suona = a.classList.toggle('suona');
    clearInterval(t);
    if (!suona || !barra) return;
    $$('.audio.suona').forEach((x) => { if (x !== a) x.querySelector<HTMLElement>('.pl')?.click(); });
    t = setInterval(() => {
      const w = (parseFloat(barra.style.width) || 0) + 0.6;
      barra.style.width = Math.min(w, 100) + '%';
      if (w >= 100) pl.click();
    }, 120);
  });
});

// Moduli della demo: mostrano la conferma senza inviare nulla
$$<HTMLFormElement>('form[data-finto]').forEach((f) => {
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const c = f.querySelector('.conferma') || (f.dataset.finto ? document.querySelector(f.dataset.finto) : null);
    if (c) { c.classList.add('vista'); c.scrollIntoView({ block: 'center' }); }
  });
});

// Bottoni della demo (download, calendario…): solo un avviso
$$('[data-finto-avviso]').forEach((b) => b.addEventListener('click', (e) => {
  e.preventDefault();
  avvisa(b.dataset.fintoAvviso!);
}));

// Copia link della pagina
$$('[data-copia-link]').forEach((b) => b.addEventListener('click', async (e) => {
  e.preventDefault();
  const en = document.documentElement.lang === 'en';
  try { await navigator.clipboard.writeText(location.href); avvisa(en ? 'Link copied to the clipboard' : 'Link copiato negli appunti'); }
  catch { avvisa(en ? 'Copy failed: use the address bar' : 'Copia non riuscita: usa la barra degli indirizzi'); }
}));
