// Le aree riservate del sito, nell'ordine in cui compaiono nella tendina "Area riservata" e nel
// menu del telefono: solo quelle attive (nella demo c'è solo l'area coristi) e, dentro le aree, solo
// quelle che chi è entrato può aprire (dal 7/10/2026; `permesse`, calcolate in TestataArea.astro).
import { coro, DEMO } from '../../motore/coro';
import { linkArea } from '../../motore/url';
import type { Veste } from '../../motore/aspetto';
import type { NomeIcona } from '../../componenti/Icona.astro';

export type AreaRiservata = 'coristi' | 'admin' | 'maestro' | 'tesoriere';

// permesse: le aree che chi è entrato può aprire; senza (sito pubblico, dove non si sa chi guarda)
// tutte tranne quella del tesoriere
export function areeRiservate(veste: Veste, en = false, permesse?: AreaRiservata[]) {
  const aree: { id: AreaRiservata; testo: string; href?: string; icona: NomeIcona }[] = [
    { id: 'coristi', testo: en ? 'Choir members' : 'Coristi', href: linkArea(veste), icona: 'persone' },
    { id: 'admin', testo: en ? 'Administrators' : 'Amministratori', href: !DEMO && coro.amministrazione ? '/admin' : undefined, icona: 'persona' },
    { id: 'maestro', testo: en ? 'Conductor' : 'Maestro', href: !DEMO && coro.coristi?.direzione ? '/maestro' : undefined, icona: 'nota' },
    { id: 'tesoriere', testo: en ? 'Treasurer' : 'Tesoriere', href: !DEMO && coro.coristi?.tesoreria ? '/tesoriere' : undefined, icona: 'euro' },
  ];
  return aree.filter((a): a is typeof a & { href: string } => Boolean(a.href) && (permesse ? permesse.includes(a.id) : a.id !== 'tesoriere'));
}
