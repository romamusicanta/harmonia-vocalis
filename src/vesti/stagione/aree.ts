// Le aree riservate del sito, nell'ordine in cui compaiono nella tendina "Area riservata" e nel
// menu del telefono: solo quelle attive (nella demo c'è solo l'area coristi).
import { coro, DEMO } from '../../motore/coro';
import { linkArea } from '../../motore/url';
import type { Veste } from '../../motore/aspetto';
import type { NomeIcona } from '../../componenti/Icona.astro';

export type AreaRiservata = 'coristi' | 'admin' | 'maestro';

export function areeRiservate(veste: Veste, en = false) {
  const aree: { id: AreaRiservata; testo: string; href?: string; icona: NomeIcona }[] = [
    { id: 'coristi', testo: en ? 'Choir members' : 'Coristi', href: linkArea(veste), icona: 'persone' },
    { id: 'admin', testo: en ? 'Administrators' : 'Amministratori', href: !DEMO && coro.amministrazione ? '/admin' : undefined, icona: 'persona' },
    { id: 'maestro', testo: en ? 'Conductor' : 'Maestro', href: !DEMO && coro.coristi?.direzione ? '/maestro' : undefined, icona: 'nota' },
  ];
  return aree.filter((a): a is typeof a & { href: string } => Boolean(a.href));
}
