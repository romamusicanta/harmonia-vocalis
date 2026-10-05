// "Pubblica ora", in tutte le pagine dell'Amministrazione (caricato da LayoutAdmin.astro): ogni modulo
// che va a /admin/pubblica e ogni pulsante con data-pubblica. Premuto, il pulsante si disattiva e
// mostra la rotella con il tempo passato; la pagina chiede ogni 5 secondi quando è stata costruita la
// versione online (/admin/stato) e, quando cambia, si ricarica da sola con i dati aggiornati e il
// messaggio "Pubblicazione completata". La pubblicazione avviata resta nel browser: cambiando pagina
// o ricaricando, la rotella continua (anche in basso a destra, in un riquadro sempre visibile).
const CHIAVE = 'hv-pubblicazione';
const FATTA = 'hv-pubblicazione-fatta';
const OGNI = 5000, LENTA = 10 * 60_000, MASSIMO = 20 * 60_000;

interface Avvio { avviata: number; build: string }

const leggi = (): Avvio | undefined => {
  try { return JSON.parse(localStorage.getItem(CHIAVE) ?? 'null') ?? undefined; } catch { return undefined; }
};
const scrivi = (v?: Avvio) => {
  try { v ? localStorage.setItem(CHIAVE, JSON.stringify(v)) : localStorage.removeItem(CHIAVE); } catch {}
};
const mmss = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

// I pulsanti "Pubblica ora" della pagina, anche quelli comparsi dopo (nei messaggi dopo un salvataggio)
const pulsanti = () => [
  ...document.querySelectorAll<HTMLButtonElement>('form[action="/admin/pubblica"] button, button[data-pubblica]'),
];

// Il riquadro in basso a destra e il messaggio in testa alla pagina
const riquadro = Object.assign(document.createElement('div'), { className: 'pubblicazione-in-corso', hidden: true });
riquadro.setAttribute('role', 'status');
riquadro.innerHTML = '<span class="rotella" aria-hidden="true"></span><div><b>Pubblicazione in corso…</b><span data-tempo>di solito due o tre minuti</span></div>';
document.body.append(riquadro);

function messaggio(testo: string, classe: 'ok' | 'errore') {
  let m = document.getElementById('esito-pubblicazione');
  if (!m) {
    m = Object.assign(document.createElement('p'), { id: 'esito-pubblicazione' });
    m.setAttribute('role', 'status');
    const main = document.querySelector('main .w') ?? document.body;
    const titolo = main.querySelector('h1');
    titolo ? titolo.after(m) : main.prepend(m);
  }
  m.hidden = false;
  m.className = `messaggio ${classe}`;
  m.textContent = testo;
}

// Pulsanti in attesa (disattivati, con la rotella e il tempo) o di nuovo pronti
// (si toccano solo i pulsanti e i testi che cambiano davvero: l'osservatore qui sotto non riparte)
function stato(attesa: boolean, tempo = '') {
  for (const b of pulsanti()) {
    if (attesa && !b.classList.contains('in-attesa')) {
      b.dataset.testo ??= b.textContent?.trim() || 'Pubblica ora';
      b.disabled = true;
      b.classList.add('in-attesa');
      b.innerHTML = '<span class="rotella piccola" aria-hidden="true"></span>Pubblicazione in corso… <span data-tempo></span>';
    } else if (!attesa && b.classList.contains('in-attesa')) {
      b.disabled = false;
      b.classList.remove('in-attesa');
      b.textContent = b.dataset.testo ?? 'Pubblica ora';
    }
    const t = b.querySelector('[data-tempo]');
    if (t && t.textContent !== tempo) t.textContent = tempo;
  }
  riquadro.hidden = !attesa;
  const t = riquadro.querySelector('[data-tempo]')!;
  const scritta = tempo ? `${tempo} · di solito due o tre minuti` : 'di solito due o tre minuti';
  if (t.textContent !== scritta) t.textContent = scritta;
}

let inAttesa = false;

function attendi(avvio: Avvio) {
  if (inAttesa) return;
  inAttesa = true;
  const orologio = setInterval(() => {
    const passato = Date.now() - avvio.avviata;
    stato(true, mmss(passato));
    if (passato > LENTA) messaggio('La pubblicazione sta impiegando più del solito. Se non finisce, la ricostruzione potrebbe essere fallita: riprova tra qualche minuto, o avvisa Mario.', 'errore');
  }, 1000);
  stato(true, mmss(Date.now() - avvio.avviata));
  const fine = () => { clearInterval(orologio); scrivi(); inAttesa = false; };
  const controlla = async () => {
    if (Date.now() - avvio.avviata > MASSIMO) {
      fine();
      stato(false);
      messaggio('La pubblicazione non si è conclusa entro 20 minuti: probabilmente è fallita. Riprova, e se succede ancora avvisa Mario.', 'errore');
      return;
    }
    try {
      const r = await fetch('/admin/stato', { cache: 'no-store' });
      if (r.redirected && r.url.includes('/admin/accedi')) {
        messaggio('La sessione è scaduta: ricarica la pagina per rientrare (la pubblicazione intanto continua).', 'errore');
      } else {
        const { build } = await r.json();
        if (build !== avvio.build) {
          fine();
          try { sessionStorage.setItem(FATTA, '1'); } catch {}
          location.reload();
          return;
        }
      }
    } catch {
      // Durante il passaggio alla nuova versione una richiesta può fallire: si riprova
    }
    setTimeout(controlla, OGNI);
  };
  setTimeout(controlla, OGNI);
}

async function avvia() {
  if (inAttesa) return;
  stato(true);
  try {
    // La versione online di adesso: quando cambia, la pubblicazione è finita
    const { build } = await (await fetch('/admin/stato', { cache: 'no-store' })).json();
    const r = await fetch('/admin/pubblica', { method: 'POST', headers: { Accept: 'application/json' } });
    const j = await r.json().catch(() => ({ ok: false, errore: `risposta inattesa dal server (${r.status})` }));
    if (!j.ok) throw new Error(j.errore);
    const avvio = { avviata: Date.now(), build };
    scrivi(avvio);
    attendi(avvio);
  } catch (e) {
    stato(false);
    messaggio(`Pubblicazione non avviata: ${(e as Error).message}`, 'errore');
  }
}

document.addEventListener('submit', (ev) => {
  const f = ev.target as HTMLFormElement;
  if (f.getAttribute('action') !== '/admin/pubblica') return;
  ev.preventDefault();
  avvia();
});
document.addEventListener('click', (ev) => {
  if (!(ev.target as HTMLElement).closest('button[data-pubblica]')) return;
  ev.preventDefault();
  avvia();
});

// Dopo la ricarica di fine pubblicazione
try {
  if (sessionStorage.getItem(FATTA)) {
    sessionStorage.removeItem(FATTA);
    messaggio('Pubblicazione completata: il sito è aggiornato.', 'ok');
  }
} catch {}

// Una pubblicazione avviata prima (in questa o in un'altra pagina): si continua ad aspettare
const avvio = leggi();
if (avvio && Date.now() - avvio.avviata < MASSIMO) attendi(avvio);
else if (avvio) scrivi();

// I pulsanti che compaiono dopo (nei messaggi) nascono già in attesa, se serve
new MutationObserver(() => { if (inAttesa && pulsanti().some((b) => !b.classList.contains('in-attesa'))) stato(true, mmss(Date.now() - (leggi()?.avviata ?? Date.now()))); })
  .observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true });
