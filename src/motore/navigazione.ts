// Voci del menu principale e del piè di pagina, secondo le funzioni attive del coro.
import { coro } from './coro';
import { link } from './url';
import type { Veste } from './aspetto';

export type Pagina = 'home' | 'concerti' | 'ascolta' | 'il-coro' | 'il-maestro' | 'canta-con-noi' | 'contatti' | 'organizzatori' | 'privacy' | 'area';

export function vociMenu(veste: Veste) {
  const f = coro.funzioni;
  return [
    { id: 'concerti', testo: 'Stagione', href: link(veste, '/concerti') },
    f.ascolta && { id: 'ascolta', testo: 'Ascolta', href: link(veste, '/ascolta') },
    { id: 'il-coro', testo: 'Il coro', href: link(veste, '/il-coro') },
    { id: 'il-maestro', testo: 'Il Maestro', href: link(veste, '/il-maestro') },
    f.cantaConNoi && { id: 'canta-con-noi', testo: 'Canta con noi', href: link(veste, '/canta-con-noi') },
    { id: 'contatti', testo: 'Contatti', href: link(veste, '/contatti') },
  ].filter((v): v is { id: Pagina; testo: string; href: string } => Boolean(v));
}
