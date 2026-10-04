// Controllo dei concerti per l'Amministrazione (pagine Concerti e Pubblicazione): ogni evento del
// calendario "Concerti" letto come lo legge la build, con i problemi trovati e se è cambiato dopo
// la versione online (da pubblicare).
import { comeIcal, concertiInProve, eventiConcerti, type Calendario, type EventoApi } from './operazioni';
import { daEvento, slug } from '../motore/calendario';
import { archivio, prossimiConcerti } from '../motore/concerti';
import { statoDi, type Stato } from './stati';
import { esisteImmagine } from '../motore/coro';
import type { Concerto } from '../motore/tipi';
import type { Sessione } from './sessione';

const immagini = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const estensione: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

export interface Riga { e: EventoApi; c: Concerto; avvisi: string[]; daPubblicare: boolean; futuro: boolean }

const build = () => new Date(__ORA_BUILD__);
const oggiIso = () => new Date().toISOString().slice(0, 10);

// Pagina Pubblicazione: gli eventi del calendario pubblico "Concerti", come li legge la build
export async function controllaConcerti(sessione: Sessione): Promise<Riga[]> {
  return (await eventiConcerti(sessione)).map(controlla);
}

function controlla(e: EventoApi): Riga {
    const avvisi: string[] = [];
    const c = daEvento(comeIcal(e), (m) => avvisi.push(m));
    for (const a of e.attachments ?? []) {
      if (!immagini.has(a.mimeType)) avvisi.push(`allegato "${a.title}" non usato: il sito prende solo immagini JPEG, PNG, WebP o AVIF`);
    }
    // Un allegato che la versione online non ha ancora: serve "Pubblica ora"
    const nuoviAllegati = (e.attachments ?? []).some((a) => immagini.has(a.mimeType) && a.fileId && !esisteImmagine(`drive/${a.fileId}.${estensione[a.mimeType]}`));
    // Gli allegati non scaricati li segnala già il controllo qui sopra
    const filtrati = avvisi.filter((m) => !(nuoviAllegati && /non scaricato da Drive/.test(m)));
    return { e, c, avvisi: filtrati, daPubblicare: new Date(e.updated) > build() || nuoviAllegati, futuro: c.data.slice(0, 10) >= oggiIso() };
}

// Pagina Concerti: tutti i concerti, quelli del calendario "Prove" (con il loro stato e la copia
// pubblica, se in cartellone) e quelli scritti prima direttamente in "Concerti"
export interface RigaConcerto extends Riga { calendario: Calendario; stato: Stato; pubblico?: EventoApi; sulSito: boolean }
export async function elencoConcerti(sessione: Sessione): Promise<RigaConcerto[]> {
  const [inProve, pubblici, online] = await Promise.all([concertiInProve(sessione), eventiConcerti(sessione), prossimiConcerti()]);
  // Le pagine dei concerti nella versione del sito online
  const pagine = new Set([...online, ...archivio].filter((c) => !c.dataIncerta).map(slug));
  const copie = new Map(pubblici.filter((e) => e.extendedProperties?.private?.origine).map((e) => [e.extendedProperties!.private!.origine, e]));
  const righe: RigaConcerto[] = [
    ...inProve.map((e) => {
      const stato = statoDi(e, 'prove');
      const pubblico = stato === 'in-cartellone' ? copie.get(e.id) : undefined;
      const r = controlla(e);
      const sulSito = pagine.has(slug(r.c));
      // In cartellone: da pubblicare se la copia è cambiata dopo la build; fuori cartellone: se il sito lo mostra ancora
      const daPubblicare = pubblico ? controlla(pubblico).daPubblicare || !sulSito : sulSito;
      return { ...r, calendario: 'prove' as const, stato, pubblico, sulSito, daPubblicare };
    }),
    ...pubblici.filter((e) => !e.extendedProperties?.private?.origine).map((e) => {
      const r = controlla(e);
      return { ...r, calendario: 'concerti' as const, stato: 'in-cartellone' as const, pubblico: e, sulSito: pagine.has(slug(r.c)) };
    }),
  ];
  return righe.sort((a, b) => a.c.data.localeCompare(b.c.data));
}
