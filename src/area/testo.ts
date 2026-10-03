// Testo scritto in un modulo (avvisi, note) come HTML sicuro: caratteri speciali protetti,
// paragrafi alle righe vuote, a capo alle righe singole, indirizzi web cliccabili.
const protetto = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const conLink = (s: string) => s.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)»"']/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\//, '')}</a>`);

export const comeHtml = (testo: string) =>
  testo.trim().split(/\n\s*\n/).map((p) => `<p>${conLink(protetto(p)).replace(/\n/g, '<br>')}</p>`).join('');
