// Indirizzi delle pagine.
// Il sito di un coro ha una sola veste, servita dalla radice. Nella demo le altre vesti pronte
// hanno una copia di ogni pagina sotto /<veste>/, così il pannello può passare dall'una all'altra.
import { AREA_CORISTI, coro, DEMO } from './coro';
import { vestiPronte, type Veste } from './aspetto';

// Da esportare in ogni pagina: export const getStaticPaths = percorsiVesti;
export function percorsiVesti() {
  return vesteDaPercorsi().map((veste) => ({ params: { veste: prefisso(veste) } }));
}

function vesteDaPercorsi(): Veste[] {
  if (!DEMO) return [coro.aspetto.veste, ...coro.aspetto.inProva.map((p) => p.veste).filter((v) => v !== coro.aspetto.veste)];
  return [coro.aspetto.veste, ...vestiPronte.filter((v) => v !== coro.aspetto.veste)];
}

export const vestiInDemo = vesteDaPercorsi;

const prefisso = (veste: Veste) => (veste === coro.aspetto.veste ? undefined : veste);

// Palette, carattere e colori propri di una veste: quelli del coro, o quelli indicati per una veste in prova
export function aspettoDi(veste: Veste) {
  const inProva = !DEMO && coro.aspetto.inProva.find((p) => p.veste === veste);
  return inProva
    ? { palette: inProva.palette, carattere: inProva.carattere, colori: inProva.colori }
    : { palette: coro.aspetto.palette, carattere: coro.aspetto.carattere, colori: coro.aspetto.colori };
}

// Percorso di una pagina senza il prefisso della veste: "/stagione/concerti" → "/concerti"
export function percorsoSenzaVeste(veste: Veste, percorso: string) {
  const p = prefisso(veste);
  const senza = p && (percorso === `/${p}` || percorso.startsWith(`/${p}/`)) ? percorso.slice(p.length + 1) || '/' : percorso;
  return senza.length > 1 ? senza.replace(/\/$/, '') : senza;
}

// Veste della pagina corrente, dal parametro [...veste]
export function vesteCorrente(param: string | undefined): Veste {
  return (param as Veste | undefined) ?? coro.aspetto.veste;
}

// Collegamento a una pagina interna nella stessa veste: link(veste, '/concerti')
export function link(veste: Veste, percorso: string) {
  const p = prefisso(veste);
  return p ? `/${p}${percorso === '/' ? '/' : percorso}` : percorso;
}

// Collegamento all'area coristi: quella del sito (demo o anteprima, sotto /area) oppure un
// indirizzo esterno indicato in coro.link.areaCoristi. Senza nessuno dei due, undefined: le vesti
// non mostrano il collegamento.
export function linkArea(veste: Veste): string | undefined {
  if (!coro.funzioni.areaCoristi) return undefined;
  return AREA_CORISTI ? link(veste, '/area') : coro.link.areaCoristi;
}
