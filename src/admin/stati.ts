// Stati di un concerto (dal 4/10/2026) e copia nel calendario pubblico. Il concerto vive nel
// calendario privato "Prove" (proprietà nascoste: tipo = concerto, stato, pubblico); solo "In
// cartellone" ha una copia nel calendario pubblico "Concerti" (proprietà origine), che il sito
// pubblico legge. Vedi anche src/admin/operazioni.ts.
import { aggiornaEventoIn, cancellaEventoIn, creaEventoIn, leggiEventoIn, spostaEvento, type Calendario, type EventoApi } from './operazioni';
import type { Sessione } from './sessione';

export const STATI = [
  { id: 'da-confermare', nome: 'Da confermare', aiuto: 'non visibile sul sito pubblico' },
  { id: 'confermato', nome: 'Confermato', aiuto: 'non visibile sul sito pubblico' },
  { id: 'in-cartellone', nome: 'In cartellone', aiuto: 'visibile sul sito pubblico' },
] as const;
export type Stato = (typeof STATI)[number]['id'];
export const nomeStato = (s: Stato) => STATI.find((x) => x.id === s)!.nome;
export const statoValido = (v: unknown): Stato | undefined => STATI.find((x) => x.id === v)?.id;

// Un concerto con la data prima di oggi (ora di Roma) è "Passato": si ricava dalla data, non si
// scrive. Lo stato salvato resta e dice se è nell'archivio del sito (in cartellone) o no.
export const oggiRoma = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
export const passato = (data: string) => data.slice(0, 10) < oggiRoma();
export const nomeStatoMostrato = (s: Stato, data: string) => (passato(data) ? 'Passato' : nomeStato(s));

// Lo stato di un evento: nel calendario "Prove" quello scritto; in "Concerti" sempre in cartellone
export const statoDi = (e: EventoApi, c: Calendario): Stato => (c === 'concerti' ? 'in-cartellone' : statoValido(e.extendedProperties?.private?.stato) ?? 'da-confermare');

// Un concerto per id: prima nel calendario "Prove", poi (concerti di prima) in "Concerti"
export async function leggiConcerto(s: Sessione, id: string): Promise<{ e: EventoApi; calendario: Calendario }> {
  try {
    const e = await leggiEventoIn(s, 'prove', id);
    if (e.extendedProperties?.private?.tipo === 'concerto') return { e, calendario: 'prove' };
  } catch (err) {
    if (!/\((404|410)\)/.test(String(err))) throw err;
  }
  return { e: await leggiEventoIn(s, 'concerti', id), calendario: 'concerti' };
}

const proprieta = (e: EventoApi) => ({ ...(e.extendedProperties?.private ?? {}) });
// I campi che passano nella copia pubblica
const campiPubblici = (e: EventoApi) => ({
  summary: e.summary ?? '',
  location: e.location ?? '',
  description: e.description ?? '',
  start: e.start,
  end: e.end,
  attachments: (e.attachments ?? []).map(({ fileUrl, title, mimeType }) => ({ fileUrl, title, mimeType })),
});

// Allinea il calendario pubblico allo stato del concerto (evento del calendario "Prove"): in
// cartellone crea o aggiorna la copia, altrimenti la toglie. Restituisce l'evento aggiornato.
export async function sincronizza(s: Sessione, e: EventoApi): Promise<EventoApi> {
  const p = proprieta(e);
  if (statoDi(e, 'prove') === 'in-cartellone') {
    const corpo = { ...campiPubblici(e), extendedProperties: { private: { origine: e.id } } };
    if (p.pubblico) {
      try {
        await aggiornaEventoIn(s, 'concerti', p.pubblico, corpo);
        return e;
      } catch (err) {
        if (!/\((404|410)\)/.test(String(err))) throw err; // copia cancellata a mano: si ricrea
      }
    }
    const copia = await creaEventoIn(s, 'concerti', corpo);
    return aggiornaEventoIn(s, 'prove', e.id, { extendedProperties: { private: { ...p, pubblico: copia.id } } });
  }
  if (p.pubblico) {
    await cancellaEventoIn(s, 'concerti', p.pubblico);
    // Una proprietà omessa resta com'era: si svuota (vuota = nessuna copia)
    return aggiornaEventoIn(s, 'prove', e.id, { extendedProperties: { private: { ...p, pubblico: '' } } });
  }
  return e;
}

// Salva un concerto esistente con i nuovi campi e il nuovo stato, poi allinea la copia pubblica.
// Un concerto di prima (in "Concerti") che esce dal cartellone si sposta nel calendario "Prove"
// con lo stesso id; se resta in cartellone si aggiorna dov'è.
export async function salvaConcerto(s: Sessione, id: string, corpo: object, stato: Stato | undefined): Promise<EventoApi> {
  const { e, calendario } = await leggiConcerto(s, id);
  const nuovo = stato ?? statoDi(e, calendario);
  if (calendario === 'concerti') {
    if (nuovo === 'in-cartellone') return aggiornaEventoIn(s, 'concerti', id, corpo);
    await spostaEvento(s, 'concerti', 'prove', id);
    return aggiornaEventoIn(s, 'prove', id, { ...corpo, extendedProperties: { private: { tipo: 'concerto', stato: nuovo } } });
  }
  const aggiornato = await aggiornaEventoIn(s, 'prove', id, { ...corpo, extendedProperties: { private: { ...proprieta(e), tipo: 'concerto', stato: nuovo } } });
  return sincronizza(s, aggiornato);
}

// Crea un concerto nel calendario "Prove" con il suo stato (e, se in cartellone, la copia pubblica)
export async function creaConcerto(s: Sessione, corpo: object, stato: Stato): Promise<EventoApi> {
  const e = await creaEventoIn(s, 'prove', { ...corpo, extendedProperties: { private: { tipo: 'concerto', stato } } });
  return sincronizza(s, e);
}
