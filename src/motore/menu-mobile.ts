// Menu del telefono (hamburger), uguale nel sito e nelle aree riservate: apre e chiude con il
// pulsante, aggiorna aria-expanded e il nome del pulsante ("Apri il menu" / "Chiudi il menu"),
// all'apertura porta il cursore sulla prima voce, Esc chiude e riporta il cursore sul pulsante.
export function attivaMenu(bottone: HTMLButtonElement | null) {
  if (!bottone) return;
  const menu = document.getElementById(bottone.getAttribute('aria-controls') ?? '');
  const en = document.documentElement.lang === 'en';
  const nomi = en ? ['Open the menu', 'Close the menu'] : ['Apri il menu', 'Chiudi il menu'];
  const imposta = (aperto: boolean) => {
    document.body.classList.toggle('menu-aperto', aperto);
    bottone.setAttribute('aria-expanded', String(aperto));
    bottone.setAttribute('aria-label', nomi[aperto ? 1 : 0]);
    if (aperto) menu?.querySelector<HTMLElement>('a, button')?.focus();
  };
  bottone.addEventListener('click', () => imposta(!document.body.classList.contains('menu-aperto')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-aperto')) { imposta(false); bottone.focus(); }
  });
}
