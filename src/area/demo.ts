// Modalità demo (dal 7/10/2026): chi è nel gruppo Demo (coro.amministrazione.demo) apre tutte le aree
// riservate (dall'8/10/2026 anche l'area coristi e le pagine vere del tesoriere, con le cifre nascoste),
// sempre in sola lettura.
// Il middleware fa girare ogni sua richiesta dentro questo contesto: le letture dei dati (coristi,
// assenze, avvisi, registrazioni, foto, quote e cassa: src/area/dati.ts, src/area/tesoreria.ts e gli
// altri) vedono inDemo() e restituiscono nomi inventati, email finte e note vuote; nella tesoreria ogni
// importo si scrive «xxx €» (euro, euroEsatto, valoreVisto). I calcoli tenuti in cache devono usare i dati veri
// (coristiVeri) e nascondere solo all'uscita, altrimenti la cache passerebbe i dati finti agli altri.
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
