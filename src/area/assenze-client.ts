// Nel browser: "Non ci sarò" (con nota) e "Ritira" per prove e concerti (elementi .assenza con
// data-evento), e il modulo "Assente per un periodo" (form.periodo); scrivono con /area/assenze.
// Usato dal Calendario (ProveVere.astro) e dalla pagina Concerti (ConcertiVeri.astro).
const avvisa = (t: string) => (window as unknown as { avvisa?: (t: string) => void }).avvisa?.(t);
async function invia(dati: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(dati)) f.set(k, v);
  const r = await fetch('/area/assenze', { method: 'POST', body: f });
  const esito = await r.json().catch(() => ({ ok: false, errore: `errore ${r.status}` }));
  if (!esito.ok) throw new Error(esito.errore);
  return esito;
}

document.querySelectorAll<HTMLElement>('.assenza[data-evento]').forEach((a) => {
  const evento = a.dataset.evento!;
  const nota = a.querySelector<HTMLInputElement>('.nota')!;
  const prova = async (fn: () => Promise<unknown>, ok: string) => {
    a.setAttribute('aria-busy', 'true');
    try { await fn(); avvisa(ok); } catch (e) { alert((e as Error).message); } finally { a.removeAttribute('aria-busy'); }
  };
  a.querySelector('.segna')!.addEventListener('click', () => prova(async () => {
    await invia({ azione: 'segna', evento, nota: nota.value });
    a.classList.add('segnalata');
    nota.focus();
  }, 'Assenza segnalata'));
  a.querySelector('.togli')!.addEventListener('click', () => prova(async () => {
    await invia({ azione: 'togli', evento });
    a.classList.remove('segnalata');
    nota.value = '';
  }, 'Assenza ritirata: sei atteso'));
  nota.addEventListener('change', () => prova(() => invia({ azione: 'segna', evento, nota: nota.value }), 'Nota salvata'));
});

document.querySelector<HTMLFormElement>('form.periodo')?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget as HTMLFormElement;
  const d = Object.fromEntries(new FormData(form)) as Record<string, string>;
  try {
    const { segnate } = await invia({ azione: 'periodo', ...d });
    avvisa(segnate.length ? `Segnate ${segnate.length} assenze` : 'Nessuna prova in quel periodo');
    location.reload();
  } catch (e) {
    alert((e as Error).message);
  }
});
