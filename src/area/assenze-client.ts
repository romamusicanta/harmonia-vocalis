// Nel browser: "Non ci sarò" (con nota) e "Ritira" per prove e concerti (elementi .assenza con
// data-evento ed eventualmente data-etichetta, "mercoledì 7 ottobre · Prova"), e il modulo
// "Sarò via per un periodo": "Al" non prima di "Dal", anteprima delle prove e dei concerti
// coinvolti (gli .assenza della pagina con data-data), poi la pagina si ricarica con l'esito.
// "Ritira le assenze" (dal 25/11/2026) toglie quelle già segnate tra le due date.
const periodo = document.querySelector<HTMLFormElement>('form.periodo');
if (periodo) {
  const dal = periodo.querySelector<HTMLInputElement>('[name=dal]')!;
  const al = periodo.querySelector<HTMLInputElement>('[name=al]')!;
  const anteprima = periodo.querySelector<HTMLElement>('.anteprima-periodo');
  const pulsante = periodo.querySelector<HTMLButtonElement>('button[type=submit]:not(.ritira)')!;
  const ritira = periodo.querySelector<HTMLButtonElement>('button.ritira');
  const coinvolti = () => [...document.querySelectorAll<HTMLElement>('.assenza[data-data]')].filter((x) => dal.value && al.value && x.dataset.data! >= dal.value && x.dataset.data! <= al.value);
  const segnate = () => coinvolti().filter((x) => x.classList.contains('segnalata'));
  const data = (d: string) => d.split('-').reverse().join('/');
  const aggiorna = () => {
    al.min = dal.value || al.min;
    if (dal.value && al.value && al.value < dal.value) al.value = dal.value;
    const elenco = coinvolti();
    const gia = segnate().length;
    pulsante.textContent = elenco.length ? `Segna ${elenco.length === 1 ? 'l’assenza' : `${elenco.length} assenze`}` : 'Segna le assenze';
    if (ritira) {
      ritira.textContent = gia ? `Ritira ${gia === 1 ? 'l’assenza segnata' : `le ${gia} assenze segnate`}` : 'Ritira le assenze';
      ritira.hidden = Boolean(dal.value && al.value && !gia);
    }
    if (anteprima) anteprima.textContent = !dal.value || !al.value ? '' : elenco.length ? `Saranno segnati: ${elenco.map((x) => x.dataset.etichetta).join('; ')}.` : 'In quelle date non ci sono prove né concerti.';
  };
  dal.addEventListener('change', aggiorna);
  al.addEventListener('change', aggiorna);
  periodo.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(periodo)) as Record<string, string>;
    const perRitirare = (ev as SubmitEvent).submitter === ritira && ritira !== null;
    const usato = perRitirare ? ritira! : pulsante;
    usato.disabled = true;
    usato.textContent = perRitirare ? 'Ritiro le assenze…' : 'Segno le assenze…';
    try {
      let esito: string;
      if (perRitirare) {
        const { ritirate } = await invia({ azione: 'ritira-periodo', dal: d.dal, al: d.al });
        esito = ritirate.length ? `Ritirate ${ritirate.length === 1 ? 'un’assenza' : `${ritirate.length} assenze`} tra il ${data(d.dal)} e il ${data(d.al)}.` : `Tra il ${data(d.dal)} e il ${data(d.al)} non avevi assenze da ritirare.`;
      } else {
        const { segnate } = await invia({ azione: 'periodo', dal: d.dal, al: d.al, nota: d.nota ?? '' });
        esito = segnate.length ? `Segnate ${segnate.length === 1 ? 'un’assenza' : `${segnate.length} assenze`} tra il ${data(d.dal)} e il ${data(d.al)}.` : 'In quelle date non ci sono prove né concerti.';
      }
      location.href = `${location.pathname}?${new URLSearchParams({ ok: '1', esito })}`;
    } catch (e) {
      if (anteprima) { anteprima.textContent = (e as Error).message; anteprima.classList.add('errore-assenza'); }
      usato.disabled = false;
      aggiorna();
    }
  });
}
