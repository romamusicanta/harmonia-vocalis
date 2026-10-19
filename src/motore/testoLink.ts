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

// Grassetto (dal 19/10/2026): **frase** come in Markdown, anche nei testi brevi. Gli asterischi devono
// stare attaccati alle parole («** a **» resta com'è). Prima dei link, che si fermano al «<» del tag.
const GRASSETTO = /\*\*(?=\S)([^*]+?)(?<=\S)\*\*/g;
export const conGrassetto = (s: string) => s.replace(GRASSETTO, '<strong>$1</strong>');
// Dove non si può mostrare il grassetto (description, anteprime dei link, dati per Google): solo il testo
export const senzaGrassetto = (s = '') => s.replace(GRASSETTO, '$1');
// In WhatsApp il grassetto è un asterisco solo: *frase*
export const grassettoWhatsapp = (s: string) => s.replace(GRASSETTO, '*$1*');

// Una riga o un paragrafo dentro un elemento già esistente (<p>, <dd>, <li>…): a capo con <br>
export const inLinea = (testo = '') => conLink(conGrassetto(protetto(testo.trim()))).replace(/\n/g, '<br>');

// Più paragrafi: paragrafi alle righe vuote, a capo alle righe singole
export const comeHtml = (testo: string) =>
  testo.trim().split(/\n\s*\n/).map((p) => `<p>${inLinea(p)}</p>`).join('');
