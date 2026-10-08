// Le aree riservate del sito, nell'ordine in cui compaiono nel menu laterale delle aree (dall'8/10/2026:
// coristi, redattori, tesoriere, Maestro): solo quelle attive (nella demo c'è solo l'area coristi) e,
// dentro le aree, solo quelle che chi è entrato può aprire (`permesse`, calcolate in TestataArea.astro).
import { coro, DEMO } from '../../motore/coro';
import { linkArea } from '../../motore/url';
import type { Veste } from '../../motore/aspetto';
import type { NomeIcona } from '../../componenti/Icona.astro';

export type AreaRiservata = 'coristi' | 'admin' | 'maestro' | 'tesoriere';

// permesse: le aree che chi è entrato può aprire; senza (sito pubblico, dove non si sa chi guarda)
// tutte tranne quella del tesoriere
export function areeRiservate(veste: Veste, en = false, permesse?: AreaRiservata[]) {
  const aree: { id: AreaRiservata; testo: string; href?: string; icona: NomeIcona }[] = [
    { id: 'coristi', testo: en ? 'Choir members' : 'Area coristi', href: linkArea(veste), icona: 'persone' },
    { id: 'admin', testo: en ? 'Editors' : 'Area redattori', href: !DEMO && coro.amministrazione ? '/admin' : undefined, icona: 'matita' },
    { id: 'tesoriere', testo: en ? 'Treasurer' : 'Area tesoriere', href: !DEMO && coro.coristi?.tesoreria ? '/tesoriere' : undefined, icona: 'euro' },
    { id: 'maestro', testo: en ? 'Conductor' : 'Area Maestro', href: !DEMO && coro.coristi?.direzione ? '/maestro' : undefined, icona: 'nota' },
  ];
  return aree.filter((a): a is typeof a & { href: string } => Boolean(a.href) && (permesse ? permesse.includes(a.id) : a.id !== 'tesoriere'));
}
