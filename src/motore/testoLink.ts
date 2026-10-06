// Testo scritto dai redattori (testi del sito, concerti, avvisi, note) come HTML sicuro, con i link
// cliccabili: caratteri speciali protetti, poi indirizzi web (https://…, www.…) e email.
export const protetto = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Il segno finale di una frase (punto, virgola, parentesi chiusa…) non fa parte dell'indirizzo
const LINK = /\b(?:https?:\/\/|www\.)[^\s<]*[^\s<.,;:!?)»"']|\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
export const conLink = (s: string) => s.replace(LINK, (u) => {
  if (u.includes('@') && !/^(https?:\/\/|www\.)/.test(u)) return `<a class="link-testo" href="mailto:${u}">${u}</a>`;
  const href = u.startsWith('www.') ? `https://${u}` : u;
  return `<a class="link-testo" href="${href}" target="_blank" rel="noopener">${u.replace(/^https?:\/\//, '')}</a>`;
});

// Una riga o un paragrafo dentro un elemento già esistente (<p>, <dd>, <li>…): a capo con <br>
export const inLinea = (testo = '') => conLink(protetto(testo.trim())).replace(/\n/g, '<br>');

// Più paragrafi: paragrafi alle righe vuote, a capo alle righe singole
export const comeHtml = (testo: string) =>
  testo.trim().split(/\n\s*\n/).map((p) => `<p>${inLinea(p)}</p>`).join('');
