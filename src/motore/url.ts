// Indirizzi delle pagine.
// Il sito di un coro ha una sola veste, servita dalla radice. Nella demo le altre vesti pronte
// hanno una copia di ogni pagina sotto /<veste>/, così il pannello può passare dall'una all'altra.
import { coro, DEMO } from './coro';
import { vestiPronte, type Veste } from './aspetto';

// Da esportare in ogni pagina: export const getStaticPaths = percorsiVesti;
export function percorsiVesti() {
  return vesteDaPercorsi().map((veste) => ({ params: { veste: prefisso(veste) } }));
}

function vesteDaPercorsi(): Veste[] {
  if (!DEMO) return [coro.aspetto.veste];
  return [coro.aspetto.veste, ...vestiPronte.filter((v) => v !== coro.aspetto.veste)];
}

export const vestiInDemo = vesteDaPercorsi;

const prefisso = (veste: Veste) => (veste === coro.aspetto.veste ? undefined : veste);

// Veste della pagina corrente, dal parametro [...veste]
export function vesteCorrente(param: string | undefined): Veste {
  return (param as Veste | undefined) ?? coro.aspetto.veste;
}

// Collegamento a una pagina interna nella stessa veste: link(veste, '/concerti')
export function link(veste: Veste, percorso: string) {
  const p = prefisso(veste);
  return p ? `/${p}${percorso === '/' ? '/' : percorso}` : percorso;
}

// Collegamento all'area coristi: quella del sito (per ora solo nella demo) oppure, finché quella
// vera non è pronta, un indirizzo esterno indicato in coro.link.areaCoristi. Senza nessuna delle
// due, undefined: le vesti non mostrano il collegamento.
export function linkArea(veste: Veste): string | undefined {
  if (!coro.funzioni.areaCoristi) return undefined;
  return DEMO ? link(veste, '/area') : coro.link.areaCoristi;
}
