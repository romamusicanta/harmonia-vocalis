// Modalità demo (dal 7/10/2026): chi è nel gruppo Demo (coro.amministrazione.demo) apre tutte le aree
// riservate (dall'8/10/2026 anche l'area coristi e le pagine vere del tesoriere, con le cifre nascoste),
// sempre in sola lettura.
// Il middleware fa girare ogni sua richiesta dentro questo contesto: le letture dei dati (coristi,
// assenze, avvisi, registrazioni, foto, quote e cassa: src/area/dati.ts, src/area/tesoreria.ts e gli
// altri) vedono inDemo() e restituiscono nomi inventati, email finte e note vuote; nella tesoreria ogni
// importo si scrive «xxx €» (euro, euroEsatto, valoreVisto). Dall'8/10/2026 anche: codice fiscale nelle
// stampe (intestazioneStampa), nomi dei maestri sostituti, avvisi della bacheca (avvisiDiEsempio), note
// delle convocazioni, note e link delle prove e concerti non ancora pubblici (eventoApiPerDemo, eventi()
// di src/area/dati.ts), file riservati (src/area/file.ts: solo le foto già pubbliche). Regola: arriva al
// browser solo ciò che è già sul sito pubblico, più la struttura (date, conteggi, stati); ogni nuova
// lettura di dati personali o di testi liberi va resa demo allo stesso modo.
// I calcoli tenuti in cache devono usare i dati veri (coristiVeri, eventiVeri) e nascondere solo
// all'uscita, altrimenti la cache passerebbe i dati finti agli altri.
import { AsyncLocalStorage } from 'node:async_hooks';

const contesto = new AsyncLocalStorage<boolean>();

export const inDemo = () => contesto.getStore() === true;
export const conDemo = <T>(demo: boolean | undefined, f: () => T): T => (demo ? contesto.run(true, f) : f());

export const MESSAGGIO_DEMO = 'Questa è una demo: puoi guardare tutto, ma le modifiche non vengono salvate.';

// Nomi inventati: a ogni corista (in un ordine mescolato, non alfabetico) una coppia diversa, finché
// bastano (37 × 41 coppie, numeri primi tra loro). Nomi scelti diversi da quelli dei coristi del 7/10/2026,
// perché nessuno pensi di riconoscersi
const NOMI = ['Alice', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Giulia', 'Gabriele', 'Marta', 'Nicola', 'Noemi', 'Riccardo', 'Sara', 'Tommaso', 'Valeria', 'Ottavio', 'Chiara', 'Davide', 'Federica', 'Giorgio', 'Ilaria', 'Lorenzo', 'Martina', 'Pietro', 'Roberta', 'Stefano', 'Teresa', 'Vittorio', 'Beatrice', 'Edoardo', 'Emma', 'Filippo', 'Irene', 'Matteo', 'Silvia', 'Ugo', 'Ludovica'];
const COGNOMI = ['Bianchi', 'Colombo', 'Ferrari', 'Esposito', 'Romano', 'Greco', 'Marino', 'Galli', 'Conti', 'Costa', 'Fontana', 'Moretti', 'Barbieri', 'Lombardi', 'Rinaldi', 'Caruso', 'Ferri', 'Leone', 'Longo', 'Gentile', 'Martini', 'Villa', 'Mariani', 'Serra', 'Bassi', 'Testa', 'Monti', 'Fabbri', 'Ricci', 'Valentini', 'Ruggiero', 'Sala', 'Neri', 'Vitale', 'Coppola', 'Marchi', 'Grassi', 'Parisi', 'Silvestri', 'Benedetti', 'Orlando'];

const mescola = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');

export interface Finto { nome: string; cognome: string; email: string }

// Dalle email vere (dell'associazione e personali) alla persona inventata
export function fintiPer(persone: { email: string; emailPersonale?: string }[]) {
  const ordine = [...persone].sort((a, b) => mescola(a.email) - mescola(b.email) || a.email.localeCompare(b.email));
  const mappa = new Map<string, Finto>();
  ordine.forEach((p, i) => {
    const nome = NOMI[i % NOMI.length];
    const cognome = COGNOMI[i % COGNOMI.length];
    const f = { nome, cognome, email: `${slug(nome)}.${slug(cognome)}@esempio.it` };
    mappa.set(p.email.toLowerCase(), f);
    if (p.emailPersonale) mappa.set(p.emailPersonale.toLowerCase(), f);
  });
  return mappa;
}

export const EMAIL_REDAZIONE = 'redazione@esempio.it';

// ——— Calendari (dall'8/10/2026) ———
// I concerti non ancora pubblici (nel calendario "Prove" con stato Da confermare o Confermato, anche
// passati) sono dati interni: in demo restano data, orario e stato, ma titolo, luogo, programma e
// allegati sono generici. Delle prove restano solo le righe Sezioni, Repertorio e Brani: note, cosa
// portare e link alle registrazioni (scritti liberamente dai redattori) non si mostrano.
export const CONCERTO_RISERVATO = { titolo: 'Concerto in preparazione', luogo: 'Luogo da definire', programma: 'Programma da definire' };
export const RIGHE_PROVA_VISIBILI = ['Sezioni', 'Repertorio', 'Brani'];

const nonPubblico = (p?: Record<string, string>) => p?.tipo === 'concerto' && p.stato !== 'in-cartellone';

// Un evento come lo dà l'API di Google Calendar (letture dell'Amministrazione, src/admin/calendari.ts);
// daProve: viene dal calendario "Prove"
export function eventoApiPerDemo<E extends { summary?: string; location?: string; description?: string; attachments?: unknown[]; extendedProperties?: { private?: Record<string, string> } }>(e: E, daProve: boolean): E {
  if (!daProve || !e || typeof e !== 'object') return e;
  if (nonPubblico(e.extendedProperties?.private)) {
    return { ...e, summary: CONCERTO_RISERVATO.titolo, location: CONCERTO_RISERVATO.luogo, description: CONCERTO_RISERVATO.programma, attachments: undefined };
  }
  if (e.extendedProperties?.private?.tipo === 'concerto') return e;
  const righe = (e.description ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').split('\n')
    .filter((r) => RIGHE_PROVA_VISIBILI.some((x) => new RegExp(`^\\s*${x}\\s*:`, 'i').test(r)));
  return { ...e, description: righe.join('\n') };
}

// ——— Bacheca (dall'8/10/2026) ———
// Gli avvisi veri sono testi liberi (nomi, numeri di telefono, fatti personali): in demo al loro posto
// questi, con le firme dei ruoli e le date vicine a oggi
export function avvisiDiEsempio(oggi: string) {
  const giorni = (n: number) => new Date(Date.parse(`${oggi}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  return [
    { id: 'demo-1', pubblicato: giorni(-1), firma: 'maestro', titolo: 'Ripasso per la prossima prova', testo: 'Per mercoledì ripassate a casa le parti del primo movimento, con le tracce della vostra sezione nel Repertorio. Grazie a tutti!', finoAl: giorni(10) },
    { id: 'demo-2', pubblicato: giorni(-4), firma: 'tesoriere', titolo: 'Quote del mese', testo: 'Ricordo a chi non l’ha ancora fatto di versare la quota del mese, con un bonifico o alla prossima prova.', finoAl: giorni(20) },
    { id: 'demo-3', pubblicato: giorni(-9), firma: 'presidente', titolo: 'Benvenuti nel nuovo sito', testo: 'Da oggi prove, concerti, spartiti e registrazioni sono tutti qui. Per qualsiasi problema scrivete agli amministratori del sito.', finoAl: undefined },
  ];
}
