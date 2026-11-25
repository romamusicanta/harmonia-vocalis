// La notifica push ai redattori per le assenze (dal 25/11/2026, richiesta di Mario): ogni assenza nuova
// o ritirata, per una prova, un concerto o un periodo, sia del corista dall'area coristi
// (src/pages/area/assenze.ts) sia dei redattori da Assenze dei coristi (src/pages/admin/assenze/cambia.ts).
// Arriva a tutti i redattori con le notifiche accese tranne chi ha fatto il cambio (inviaRedattori in
// src/area/notifiche.ts): anche l'assenza di un redattore la ricevono gli altri. I cambi della sola nota no.
import { nomeEvento, type Evento, type SchedaCorista } from './dati';
import { giornoEsteso } from '../admin/prove';
import { inviaRedattori } from './notifiche';

// "mercoledì 2 dicembre · Prova, 20:00" / "sabato 12 dicembre · Concerto Mozart · Requiem"
const evento = (e: Evento) => `${giornoEsteso(e.data)} · ${e.tipo === 'concerto' ? `Concerto ${nomeEvento(e)}` : nomeEvento(e)}${e.inizio ? `, ${e.inizio}` : ''}`;
const breve = (data: string) => data.split('-').reverse().slice(0, 2).join('/');
const quanti = (n: number) => (n === 1 ? 'una tra prove e concerti' : `${n} tra prove e concerti`);
const elencati = (elenco: Evento[]) => (elenco.length <= 3 ? `: ${elenco.map(evento).join('; ')}` : '');

type Cambio =
  | { tipo: 'segnata' | 'ritirata'; evento: Evento }
  | { tipo: 'periodo-segnato' | 'periodo-ritirato'; dal: string; al: string; eventi: Evento[] };

// c: il corista dell'assenza; da: chi ha fatto il cambio (email e nome), che non riceve la notifica.
// Non aspetta l'invio e non fallisce mai.
export function avvisaRedattori(c: SchedaCorista, cambio: Cambio, nota: string, da: { email: string; nome?: string }) {
  const chi = `${c.nome} ${c.cognome}${c.sezione ? ` (${c.sezione})` : ''}`;
  const daRedattore = da.email.toLowerCase() !== c.email.toLowerCase();
  const firma = daRedattore ? `\nSegnata da ${da.nome || da.email}` : '';
  const conNota = (testo: string) => `${testo}${nota ? `\nNota: ${nota}` : ''}${firma.replace('Segnata', cambio.tipo.includes('ritirat') ? 'Tolta' : 'Segnata')}`;
  const link = 'evento' in cambio ? `/admin/assenze?${new URLSearchParams({ evento: cambio.evento.id })}` : '/admin/assenze';
  const notifica =
    cambio.tipo === 'segnata' ? { titolo: `Assenza: ${chi}`, testo: conNota(`Non ci sarà: ${evento(cambio.evento)}.`) }
    : cambio.tipo === 'ritirata' ? { titolo: `Assenza ritirata: ${chi}`, testo: conNota(`Ci sarà: ${evento(cambio.evento)}.`) }
    : cambio.tipo === 'periodo-segnato' ? { titolo: `Assenza per un periodo: ${chi}`, testo: conNota(`Sarà via dal ${breve(cambio.dal)} al ${breve(cambio.al)}, ${quanti(cambio.eventi.length)}${elencati(cambio.eventi)}.`) }
    : { titolo: `Assenze ritirate: ${chi}`, testo: conNota(`Ci sarà di nuovo tra il ${breve(cambio.dal)} e il ${breve(cambio.al)}, ${quanti(cambio.eventi.length)}${elencati(cambio.eventi)}.`) };
  void inviaRedattori({ ...notifica, link }, da.email);
}
