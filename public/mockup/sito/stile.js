// Micro-interazioni del mockup. Niente framework, niente dati salvati.
(function () {
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  // Menu mobile
  const hamb = document.querySelector('.hamb');
  if (hamb) {
    hamb.addEventListener('click', () => {
      const aperto = document.body.classList.toggle('menu-aperto');
      hamb.setAttribute('aria-expanded', aperto ? 'true' : 'false');
    });
  }

  // Video: miniatura, poi youtube-nocookie solo al clic
  $$('.video[data-id]').forEach((v) => {
    v.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${v.dataset.id}?autoplay=1&rel=0`;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.title = v.getAttribute('aria-label') || 'Video';
      v.replaceChildren(f);
    }, { once: true });
  });

  // Toast
  let toast;
  function avvisa(testo) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'avviso-toast';
      toast.setAttribute('role', 'status');
      document.body.append(toast);
    }
    toast.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' + testo;
    toast.classList.add('visto');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('visto'), 2600);
  }
  window.avvisa = avvisa;

  // "Non ci sarò"
  $$('.assenza').forEach((a) => {
    a.querySelector('.segnala')?.addEventListener('click', () => {
      a.classList.add('segnalata');
      a.querySelector('.nota-assenza textarea, .nota-assenza input')?.focus();
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

  // Filtri a chip: data-filtro="gruppo" sui bottoni, data-valore; elementi con data-<gruppo>
  $$('[data-filtri]').forEach((contenitore) => {
    const bersaglio = document.querySelector(contenitore.dataset.filtri);
    if (!bersaglio) return;
    const stato = {};
    function applica() {
      $$('[data-voce]', bersaglio).forEach((el) => {
        const ok = Object.entries(stato).every(([g, v]) => v === 'tutti' || (el.dataset[g] || '').split(' ').includes(v));
        el.classList.toggle('nascosto', !ok);
      });
      // Nasconde i gruppi rimasti vuoti
      $$('[data-gruppo]', bersaglio).forEach((g) => {
        g.classList.toggle('nascosto', !$$('[data-voce]:not(.nascosto)', g).length);
      });
      const vuoto = bersaglio.querySelector('.nessun-risultato');
      if (vuoto) vuoto.classList.toggle('nascosto', !!$$('[data-voce]:not(.nascosto)', bersaglio).length);
    }
    $$('[data-filtro]', contenitore).forEach((b) => {
      const g = b.dataset.filtro;
      if (b.classList.contains('on')) stato[g] = b.dataset.valore;
      b.addEventListener('click', () => {
        $$(`[data-filtro="${g}"]`, contenitore).forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        stato[g] = b.dataset.valore;
        applica();
      });
    });
    applica();
  });

  // Ricerca testuale semplice: input[data-cerca="#lista"]
  $$('[data-cerca]').forEach((inp) => {
    const lista = document.querySelector(inp.dataset.cerca);
    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      $$('li', lista).forEach((li) => li.classList.toggle('nascosto', q && !li.textContent.toLowerCase().includes(q)));
    });
  });

  // Lettore audio finto
  $$('.audio').forEach((a) => {
    const barra = a.querySelector('.onda i');
    let t;
    a.querySelector('.pl')?.addEventListener('click', () => {
      const suona = a.classList.toggle('suona');
      clearInterval(t);
      if (suona) {
        $$('.audio.suona').forEach((x) => { if (x !== a) x.querySelector('.pl').click(); });
        t = setInterval(() => {
          const w = (parseFloat(barra.style.width) || 0) + 0.6;
          barra.style.width = Math.min(w, 100) + '%';
          if (w >= 100) a.querySelector('.pl').click();
        }, 120);
      }
    });
  });

  // Moduli finti: mostrano una conferma
  $$('form[data-finto]').forEach((f) => {
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const c = f.querySelector('.conferma') || document.querySelector(f.dataset.finto);
      if (c) { c.classList.add('vista'); c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
  });

  // Bottoni finti (download, calendario…)
  $$('[data-finto-avviso]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    avvisa(b.dataset.fintoAvviso);
  }));
})();

// Ascolta: un video dell'elenco si apre nel lettore in evidenza
(function () {
  let lettore = document.getElementById('lettore');
  if (!lettore) return;
  function carica(el, avvia) {
    const id = el.dataset.carica;
    const nuovo = lettore.cloneNode(false);
    nuovo.dataset.id = id;
    nuovo.innerHTML = `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt=""><span class="play"><i><svg class="ic" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></i><b>${el.dataset.titolo}<span>${el.dataset.sotto}</span></b></span>`;
    nuovo.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.title = el.dataset.titolo;
      nuovo.replaceChildren(f);
    }, { once: true });
    lettore.replaceWith(nuovo);
    lettore = nuovo;
    nuovo.scrollIntoView({ behavior: avvia ? 'smooth' : 'auto', block: 'center' });
    if (avvia) nuovo.click();
  }
  document.querySelectorAll('[data-carica]').forEach((el) => el.addEventListener('click', () => carica(el, true)));
  const dalLink = location.hash && document.querySelector(`[data-carica="${location.hash.slice(1)}"]`);
  if (dalLink) carica(dalLink, false);
})();
