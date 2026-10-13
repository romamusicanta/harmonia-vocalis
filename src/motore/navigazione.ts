// Voci del menu principale e del piè di pagina, secondo le funzioni attive del coro.
import { albumFoto, coro } from './coro';
import { link } from './url';
import type { Veste } from './aspetto';
import type { Lingua } from './lingua';

export type Pagina = 'home' | 'concerti' | 'ascolta' | 'foto' | 'il-coro' | 'il-maestro' | 'canta-con-noi' | 'contatti' | 'organizzatori' | 'privacy' | 'area';

export function vociMenu(veste: Veste, lingua: Lingua = 'it') {
  const f = coro.funzioni;
  const en = lingua === 'en';
  const l = (p: string) => link(veste, p, lingua);
  return [
    { id: 'concerti', testo: en ? 'Concerts' : 'Concerti', href: l('/concerti') },
    f.ascolta && { id: 'ascolta', testo: en ? 'Listen' : 'Ascolta', href: l('/ascolta') },
    // Le foto dei concerti (dal 13/10/2026): la voce c'è quando c'è almeno un album
    albumFoto().length > 0 && { id: 'foto', testo: en ? 'Photos' : 'Foto', href: l('/foto') },
    { id: 'il-coro', testo: en ? 'The Choir' : 'Il Coro', href: l('/il-coro') },
    { id: 'il-maestro', testo: en ? 'The Conductor' : 'Il Maestro', href: l('/il-maestro') },
    f.cantaConNoi && { id: 'canta-con-noi', testo: en ? 'Sing with us' : 'Canta con noi', href: l('/canta-con-noi') },
    { id: 'contatti', testo: en ? 'Contact' : 'Contatti', href: l('/contatti') },
  ].filter((v): v is { id: Pagina; testo: string; href: string } => Boolean(v));
}
