// Nel browser: "Non ci sarò" (con nota) e "Ritira" per prove e concerti (elementi .assenza con
// data-evento ed eventualmente data-etichetta, "mercoledì 7 ottobre · Prova"), e il modulo
// "Sarò via per un periodo" (form.periodo); scrivono con /area/assenze.
// Usato da Bacheca (BachecaVera.astro), Calendario (ProveVere.astro) e Concerti (ConcertiVeri.astro).
// Mentre salva il blocco mostra "Salvo…" e non si può toccare di nuovo; gli errori compaiono nel
// blocco con "Riprova"; la nota ha il suo pulsante "Salva nota" e si salva anche da sola dopo una
// pausa nella scrittura.

async function invia(dati: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(dati)) f.set(k, v);
  let r: Response;
  try {
    r = await fetch('/area/assenze', { method: 'POST', body: f });
  } catch {
    throw new Error('Connessione assente: controlla la rete e riprova.');
  }
  const esito = await r.json().catch(() => ({ ok: false, errore: `Il sito non ha risposto (${r.status}).` }));
  if (!esito.ok) throw new Error(esito.errore);
  return esito;
}

document.querySelectorAll<HTMLElement>('.assenza[data-evento]').forEach((a) => {
  const evento = a.dataset.evento!;
  const segna = a.querySelector<HTMLButtonElement>('.segna')!;
  const togli = a.querySelector<HTMLButtonElement>('.togli')!;
  const nota = a.querySelector<HTMLInputElement>('.nota')!;
  if (a.dataset.etichetta) {
    segna.setAttribute('aria-label', `Non ci sarò: ${a.dataset.etichetta}`);
    togli.setAttribute('aria-label', `Ritira l'assenza: ${a.dataset.etichetta}`);
  }

  // Pulsante "Salva nota" con lo stato accanto, e riga per gli errori (letta subito)
  const riga = document.createElement('div');
  riga.className = 'salva-nota';
  const salva = document.createElement('button');
  salva.type = 'button';
  salva.className = 'btn o piccolo';
  salva.textContent = 'Salva nota';
  const stato = document.createElement('span');
  stato.setAttribute('role', 'status');
  riga.append(salva, stato);
  nota.after(riga);
  const errore = document.createElement('p');
  errore.className = 'errore-assenza';
  errore.setAttribute('role', 'alert');
  errore.hidden = true;
  a.append(errore);
  const testoSegna = segna.innerHTML;
  let fuocoDopo: HTMLElement | undefined; // dove portare il cursore quando il blocco torna attivo

  // Esegue un'azione con il blocco occupato; in caso di errore lo mostra con "Riprova"
  const prova = async (fn: () => Promise<unknown>, occupato: string) => {
    a.setAttribute('aria-busy', 'true');
    a.querySelectorAll('button').forEach((b) => (b.disabled = true));
    if (occupato === 'segna') segna.textContent = 'Salvo…';
    errore.hidden = true;
    try {
      await fn();
      return true;
    } catch (e) {
      errore.replaceChildren(`${(e as Error).message} `);
      const riprova = document.createElement('button');
      riprova.type = 'button';
      riprova.textContent = 'Riprova';
      riprova.addEventListener('click', () => prova(fn, occupato));
      errore.append(riprova);
      errore.hidden = false;
      return false;
    } finally {
      a.removeAttribute('aria-busy');
      a.querySelectorAll('button').forEach((b) => (b.disabled = false));
      segna.innerHTML = testoSegna;
      fuocoDopo?.focus();
      fuocoDopo = undefined;
    }
  };

  segna.addEventListener('click', () => prova(async () => {
    await invia({ azione: 'segna', evento, nota: nota.value });
    a.classList.add('segnalata');
    stato.textContent = 'Assenza segnalata. Se vuoi, aggiungi una nota.';
    fuocoDopo = togli;
  }, 'segna'));
  togli.addEventListener('click', () => prova(async () => {
    await invia({ azione: 'togli', evento });
    a.classList.remove('segnalata');
    nota.value = '';
    stato.textContent = '';
    fuocoDopo = segna;
  }, 'togli'));

  let ultima = nota.value;
  const salvaNota = () => {
    if (nota.value === ultima) return;
    const valore = nota.value;
    stato.textContent = 'Salvo la nota…';
    prova(async () => {
      await invia({ azione: 'segna', evento, nota: valore });
      ultima = valore;
      stato.textContent = 'Nota salvata ✓';
    }, 'nota');
  };
  let attesa: ReturnType<typeof setTimeout>;
  nota.addEventListener('input', () => { stato.textContent = ''; clearTimeout(attesa); attesa = setTimeout(salvaNota, 1500); });
  nota.addEventListener('change', () => { clearTimeout(attesa); salvaNota(); });
  salva.addEventListener('click', () => { clearTimeout(attesa); salvaNota(); });
});

// "Sarò via per un periodo": "Al" non prima di "Dal", anteprima delle prove e dei concerti
// coinvolti (gli .assenza della pagina con data-data), poi la pagina si ricarica con l'esito
const periodo = document.querySelector<HTMLFormElement>('form.periodo');
if (periodo) {
  const dal = periodo.querySelector<HTMLInputElement>('[name=dal]')!;
  const al = periodo.querySelector<HTMLInputElement>('[name=al]')!;
  const anteprima = periodo.querySelector<HTMLElement>('.anteprima-periodo');
  const pulsante = periodo.querySelector<HTMLButtonElement>('button[type=submit]')!;
  const coinvolti = () => [...document.querySelectorAll<HTMLElement>('.assenza[data-data]')].filter((x) => dal.value && al.value && x.dataset.data! >= dal.value && x.dataset.data! <= al.value);
  const aggiorna = () => {
    al.min = dal.value || al.min;
    if (dal.value && al.value && al.value < dal.value) al.value = dal.value;
    const elenco = coinvolti();
    pulsante.textContent = elenco.length ? `Segna ${elenco.length === 1 ? 'l’assenza' : `${elenco.length} assenze`}` : 'Segna le assenze';
    if (anteprima) anteprima.textContent = !dal.value || !al.value ? '' : elenco.length ? `Saranno segnati: ${elenco.map((x) => x.dataset.etichetta).join('; ')}.` : 'In quelle date non ci sono prove né concerti.';
  };
  dal.addEventListener('change', aggiorna);
  al.addEventListener('change', aggiorna);
  periodo.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(periodo)) as Record<string, string>;
    pulsante.disabled = true;
    pulsante.textContent = 'Segno le assenze…';
    try {
      const { segnate } = await invia({ azione: 'periodo', ...d });
      const esito = segnate.length ? `Segnate ${segnate.length === 1 ? 'un’assenza' : `${segnate.length} assenze`} tra il ${d.dal.split('-').reverse().join('/')} e il ${d.al.split('-').reverse().join('/')}.` : 'In quelle date non ci sono prove né concerti.';
      location.href = `${location.pathname}?${new URLSearchParams({ ok: '1', esito })}`;
    } catch (e) {
      if (anteprima) { anteprima.textContent = (e as Error).message; anteprima.classList.add('errore-assenza'); }
      pulsante.disabled = false;
      aggiorna();
    }
  });
}
