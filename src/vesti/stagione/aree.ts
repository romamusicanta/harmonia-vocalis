// Le aree riservate del sito, nell'ordine in cui compaiono nella tendina "Area riservata" e nel
// menu del telefono: solo quelle attive (nella demo c'è solo l'area coristi).
import { coro, DEMO } from '../../motore/coro';
import { linkArea } from '../../motore/url';
import type { Veste } from '../../motore/aspetto';
import type { NomeIcona } from '../../componenti/Icona.astro';

export type AreaRiservata = 'coristi' | 'admin' | 'maestro' | 'tesoriere';

// tesoreria: l'area del tesoriere si mostra solo a chi la può aprire (dentro le aree, dove si sa chi è entrato)
export function areeRiservate(veste: Veste, en = false, tesoreria = false) {
  const aree: { id: AreaRiservata; testo: string; href?: string; icona: NomeIcona }[] = [
    { id: 'coristi', testo: en ? 'Choir members' : 'Coristi', href: linkArea(veste), icona: 'persone' },
    { id: 'admin', testo: en ? 'Administrators' : 'Amministratori', href: !DEMO && coro.amministrazione ? '/admin' : undefined, icona: 'persona' },
    { id: 'maestro', testo: en ? 'Conductor' : 'Maestro', href: !DEMO && coro.coristi?.direzione ? '/maestro' : undefined, icona: 'nota' },
    { id: 'tesoriere', testo: en ? 'Treasurer' : 'Tesoriere', href: !DEMO && tesoreria && coro.coristi?.tesoreria ? '/tesoriere' : undefined, icona: 'euro' },
  ];
  return aree.filter((a): a is typeof a & { href: string } => Boolean(a.href));
}
