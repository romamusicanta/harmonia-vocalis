// Registro delle vesti grafiche: per ogni veste, i componenti dei punti chiave e il foglio di stile.
// Le pagine in src/pages sono comuni a tutte le vesti e prendono da qui ciò che cambia.
import type { Veste } from '../motore/aspetto';

import StagioneTestata from './stagione/Testata.astro';
import StagionePiede from './stagione/Piede.astro';
import StagioneTestataArea from './stagione/TestataArea.astro';
import StagionePiedeArea from './stagione/PiedeArea.astro';
import StagioneHome from './stagione/Home.astro';
import StagioneSchedaConcerto from './stagione/SchedaConcerto.astro';
import stileStagione from './stagione/stile.css?url';

type Componente = (props: any) => any;

export type ComponentiVeste = {
  Testata: Componente;
  Piede: Componente;
  TestataArea: Componente;
  PiedeArea: Componente;
  Home: Componente;
  SchedaConcerto: Componente;
  stile: string;
};

const stagione: ComponentiVeste = {
  Testata: StagioneTestata,
  Piede: StagionePiede,
  TestataArea: StagioneTestataArea,
  PiedeArea: StagionePiedeArea,
  Home: StagioneHome,
  SchedaConcerto: StagioneSchedaConcerto,
  stile: stileStagione,
};

// Le vesti non ancora pronte usano quella di Stagione
export const vesti: Record<Veste, ComponentiVeste> = {
  stagione,
  palco: stagione,
  segno: stagione,
  classica: stagione,
  calda: stagione,
};
