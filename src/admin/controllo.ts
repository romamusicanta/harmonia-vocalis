// Controllo dei concerti per l'Amministrazione (pagine Concerti e Pubblicazione): ogni evento del
// calendario "Concerti" letto come lo legge la build, con i problemi trovati e se è cambiato dopo
// la versione online (da pubblicare).
import { comeIcal, eventiConcerti, type EventoApi } from './operazioni';
import { daEvento } from '../motore/calendario';
import { esisteImmagine } from '../motore/coro';
import type { Concerto } from '../motore/tipi';
import type { Sessione } from './sessione';

const immagini = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const estensione: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

export interface Riga { e: EventoApi; c: Concerto; avvisi: string[]; daPubblicare: boolean; futuro: boolean }

export async function controllaConcerti(sessione: Sessione): Promise<Riga[]> {
  const build = new Date(__ORA_BUILD__);
  const oggi = new Date().toISOString().slice(0, 10);
  return (await eventiConcerti(sessione)).map((e) => {
    const avvisi: string[] = [];
    const c = daEvento(comeIcal(e), (m) => avvisi.push(m));
    for (const a of e.attachments ?? []) {
      if (!immagini.has(a.mimeType)) avvisi.push(`allegato "${a.title}" non usato: il sito prende solo immagini JPEG, PNG, WebP o AVIF`);
    }
    // Un allegato che la versione online non ha ancora: serve "Pubblica ora"
    const nuoviAllegati = (e.attachments ?? []).some((a) => immagini.has(a.mimeType) && a.fileId && !esisteImmagine(`drive/${a.fileId}.${estensione[a.mimeType]}`));
    // Gli allegati non scaricati li segnala già il controllo qui sopra
    const filtrati = avvisi.filter((m) => !(nuoviAllegati && /non scaricato da Drive/.test(m)));
    return { e, c, avvisi: filtrati, daPubblicare: new Date(e.updated) > build || nuoviAllegati, futuro: c.data.slice(0, 10) >= oggi };
  });
}
