// Schema della configurazione di un coro (coro/coro.config.ts).
// La configurazione si valida all'avvio della build: un campo mancante o sbagliato
// ferma la build con un messaggio che dice quale campo correggere.
import { z } from 'astro/zod';
import { CARATTERI, COLORI, PALETTE, VESTI } from './aspetto';

const chiavi = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const persona = z.object({
  nome: z.string(),
  ruolo: z.string(),
});

const luogo = z.object({
  nome: z.string(),
  indirizzo: z.string(),
  cap: z.string(),
  citta: z.string(),
});

// Colori propri al posto di una palette: { primario: '#5a1019', accento: '#dca542', … }, in
// esadecimale; le sfumature si ricavano da questi. Tutti obbligatori tranne "piede" e "barra".
const esadecimale = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const colori = z.object({ ...(Object.fromEntries(Object.keys(COLORI).map((k) => [k, esadecimale])) as Record<keyof typeof COLORI, typeof esadecimale>), piede: esadecimale.optional(), barra: esadecimale.optional() });

export const schemaCoro = z.object({
  nome: z.string(),
  // Tipo di coro, sotto il nome nel marchio: "Coro polifonico misto"
  tipo: z.string(),
  // Sigla di 1–3 lettere per il quadratino del marchio, se non c'è un logo
  sigla: z.string().max(3),
  citta: z.string(),
  associazione: z.string().optional(),
  // Riga nella barra di servizio: "Associato ARCL e Feniarco"
  affiliazioni: z.string().optional(),
  descrizione: z.string(),
  url: z.url(),
  email: z.email(),
  fondazione: z.number().int(),

  sede: luogo.optional(),
  prove: luogo.extend({
    orari: z.string(),
    // Tre riquadri brevi nella pagina "Canta con noi": ["Mer", "Ogni settimana"]
    riquadri: z.array(z.tuple([z.string(), z.string()])).max(4),
  }),

  maestro: z.object({
    nome: z.string(),
    // Frase di presentazione breve, sotto il nome
    presentazione: z.string(),
    anniPodio: z.number().int().optional(),
    foto: z.string(),
  }),

  direttivo: z.array(persona),
  organico: z.array(z.object({ sezione: z.string(), voci: z.number().int() })),
  // Altre formazioni o numeri da mettere in evidenza nella pagina del coro
  numeri: z.array(z.object({ valore: z.string(), testo: z.string() })).max(4),
  associatoA: z.array(z.object({ nome: z.string(), descrizione: z.string(), url: z.url().optional() })),

  stagione: z.object({
    // Etichetta grande in home: "26/27"
    sigla: z.string(),
    presentazione: z.string(),
  }),

  // Area Amministrazione (/admin): accesso con Google per gli account del dominio che fanno parte
  // del gruppo indicato
  amministrazione: z.object({
    dominio: z.string(),
    gruppo: z.string(),
    // Gruppo Demo (dal 7/10/2026): Amministrazione e area del Maestro in sola lettura, con nomi
    // inventati e note nascoste; nell'area del tesoriere solo le anteprime delle sezioni
    demo: z.string().optional(),
  }).optional(),

  // Area coristi (/area): accesso con un account Google qualunque il cui indirizzo fa parte del
  // gruppo indicato (anche come membro esterno)
  coristi: z.object({
    gruppo: z.string(),
    // Chi vede i report su prove e assenze (/maestro, l’area del Maestro): il Maestro e gli amministratori
    direzione: z.string().optional(),
    // Gli amministratori del sito: aprono tutte le aree (coristi, Maestro, tesoriere), senza essere nei loro gruppi
    amministratori: z.string().optional(),
    // Chi scrive gli avvisi della bacheca dell'area coristi: ogni ruolo è un gruppo Google, con la
    // firma che compare sotto l'avviso e la chat WhatsApp dove inoltrarlo
    bacheca: z.array(z.object({
      id: z.string(),
      firma: z.string(),
      gruppo: z.string(),
      chat: z.string().optional(),
      tutti: z.boolean().default(false), // modifica e cancella anche gli avvisi degli altri ruoli
      // Chi è in questo gruppo non ha il ruolo (es. gli amministratori, dentro maestro@ per controllare l'area)
      tranne: z.string().optional(),
    })).default([]),
    // Area del tesoriere (/tesoriere): chi la vede (gruppi Google), la quota mensile dei coristi in
    // euro e i mesi in cui si paga (numeri dei mesi, nell'ordine della stagione)
    tesoreria: z.object({
      gruppi: z.array(z.string()),
      quota: z.number(),
      // Quota base di settembre, quando il tesoriere non la indica per quell'anno (di solito metà
      // quota: settembre ha poche prove; zero se il giugno prima ne ha avute poche anche lui)
      quotaSettembre: z.number().optional(),
      mesi: z.array(z.number().int().min(1).max(12)),
      // Onorari dei maestri, in euro: a prova per il Direttore e per chi lo sostituisce, lezioni di
      // vocalità di gruppo singola e doppia (prospetti "Onorario maestri" e "Spese gestione prove")
      // Codice fiscale dell'associazione, nell'intestazione del rendiconto
      codiceFiscale: z.string().optional(),
      // Conto per i bonifici delle quote, mostrato ai coristi in Bacheca
      iban: z.string().optional(),
      intestatario: z.string().optional(),
      // Sedi delle prove, per dividere gli affitti nel rendiconto: un'uscita della categoria «Affitto
      // sala prove» va alla prima sede con una delle parole nella descrizione
      sedi: z.array(z.object({ nome: z.string(), parole: z.array(z.string()) })).default([]),
      onorari: z.object({
        prova: z.number(),
        sostituto: z.number(),
        vocalitaSingola: z.number(),
        vocalitaDoppia: z.number(),
      }),
    }).optional(),
  }).optional(),

  foto: z.object({
    apertura: z.string(),
    coro: z.string(),
    accesso: z.string(),
    // Una prova del coro, per "Canta con noi"; senza, la foto del coro
    prove: z.string().optional(),
  }),

  link: z.object({
    youtube: z.url().optional(),
    youtubeCanale: z.string().optional(),
    instagram: z.url().optional(),
    facebook: z.url().optional(),
    // Area coristi esterna (per esempio un Google Site, o un'anteprima in public/), usata
    // finché l'area coristi del sito non è pronta: indirizzo completo o percorso "/…"
    areaCoristi: z.string().optional(),
    // Scheda del coro in PDF per gli organizzatori, dentro public/
    schedaPdf: z.string().optional(),
  }),

  calendario: z.object({
    // Indirizzo pubblico iCal del calendario Google "Concerti" (facoltativo)
    ics: z.string().optional(),
    // ID del calendario, per il pulsante "Iscriviti al calendario"
    id: z.string().optional(),
  }),

  aspetto: z.object({
    veste: z.enum(chiavi(VESTI)),
    // Palette del catalogo, usata solo senza colori propri (aspetto.colori)
    palette: z.enum(chiavi(PALETTE)).default('porpora'),
    carattere: z.enum(chiavi(CARATTERI)),
    // Caratteri Google Fonts usati solo dal logo (coro/Logo.astro), come parametro "family":
    // 'Archivo:wdth,wght@125,300;125,900'
    caratteriLogo: z.array(z.string()).optional(),
    colori: colori.optional(),
    // Pannello "Prova la grafica" nel sito vero: veste, palette, colori e caratteri, per chi
    // guarda il sito (la scelta resta nel suo browser e si condivide con un link).
    pannelloProva: z.boolean().default(false),
    // Vesti in prova: generate anche nel sito vero sotto /<veste>/, con un selettore per passare
    // dall'una all'altra. Si svuota quando la scelta è fatta.
    inProva: z
      .array(z.object({ veste: z.enum(chiavi(VESTI)), palette: z.enum(chiavi(PALETTE)), carattere: z.enum(chiavi(CARATTERI)), colori: colori.optional() }))
      .default([]),
  }),

  funzioni: z.object({
    ascolta: z.boolean(),
    cantaConNoi: z.boolean(),
    organizzatori: z.boolean(),
    areaCoristi: z.boolean(),
    // Avviso "Anteprima" in testa all'area coristi del sito vero (l'area c'è comunque se coro.coristi
    // è configurato)
    anteprimaArea: z.boolean().default(false),
  }),
});

export type ConfigCoro = z.infer<typeof schemaCoro>;
