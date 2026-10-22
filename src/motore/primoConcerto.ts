// Il primo concerto del coro nei testi (dal 22/10/2026, richiesta di Mario): è il più antico
// dell'archivio, cioè dei concerti visibili sul sito, e cambia se quello più antico viene tolto dal
// sito. I testi che lo citano usano i segnaposto {primoAnno} (2019), {primoConcerto} («Missa in
// Angustiis di Haydn», in inglese «Missa in Angustiis by Haydn») e {primoLuogo} (la città):
// numeri di Il coro (coro.config.ts, coro.en.ts) e storia (coro/testi, Testi del sito).
import { archivio, parti } from './concerti';
import { concertoIn } from './inglese';
import type { Lingua } from './lingua';

const primo = archivio.at(-1);

const protetto = (t: string) => t.replace(/[&<>"]/g, (x) => `&#${x.charCodeAt(0)};`);

// Il titolo con il cognome dell'autore, se il titolo non lo contiene già
function nome(lingua: Lingua, html: boolean) {
  if (!primo) return '';
  const c = concertoIn(primo, lingua);
  const cognome = c.autore?.split(' ').at(-1);
  const titolo = html ? `<em>${protetto(c.titolo)}</em>` : c.titolo;
  const autore = cognome && !c.titolo.includes(cognome) ? ` ${lingua === 'en' ? 'by' : 'di'} ${html ? protetto(cognome) : cognome}` : '';
  return titolo + autore;
}

// Sostituisce i segnaposto; con html il titolo è in corsivo e i valori sono protetti
export function conPrimoConcerto(testo: string, lingua: Lingua, html = false): string {
  if (!testo.includes('{primo')) return testo;
  const luogo = primo ? concertoIn(primo, lingua).luogo ?? '' : '';
  return testo
    .replaceAll('{primoAnno}', primo ? parti(primo).anno : '')
    .replaceAll('{primoConcerto}', nome(lingua, html))
    .replaceAll('{primoLuogo}', html ? protetto(luogo) : luogo);
}
