// Foto dei concerti (dal 5/10/2026): le caricano tutti i coristi dalla pagina Foto della loro area,
// nella cartella "Foto dei concerti" del Drive condiviso (DRIVE_CARTELLA_FOTO_CONCERTI), una
// sottocartella per concerto ("AAAA-MM-GG Titolo"), con l'account di servizio. Chi ha caricato, il
// concerto e la visibilità stanno nelle proprietà del file su Drive (appProperties: caricatoDa,
// evento, data, visibilita), niente foglio. Visibilità, ognuna comprende quella prima: "coristi" (di
// base: la vedono subito tutti i coristi), "pubblica" (anche i visitatori, nella pagina del concerto),
// "home" (anche nella raccolta "Dai nostri concerti" della home: le più belle, scelte una per una);
// più "nascosta" (solo i redattori). Pubblica e home valgono dopo la pubblicazione:
// scripts/scarica-allegati.mjs le scarica alla build. Le decidono i redattori (Amministrazione → Foto
// dei concerti); ogni corista può togliere le sue.
import { DRIVE_CARTELLA_FOTO_CONCERTI } from 'astro:env/server';
import { CARTELLA, cartellaIn, cestina, fileIn, fileInCartelle, leggiFile, rispondiCaricamento } from './drive';
import { coristiVeri, eventi, nomeBreve, nomeEvento, oggi, personaVista, piuGiorni } from './dati';
import { inDemo } from './demo';
import { archivio } from '../motore/concerti';
import { google, normalizza } from './servizio';
import { dimentica } from './file';

export const configurato = () => Boolean(DRIVE_CARTELLA_FOTO_CONCERTI);
export type Visibilita = 'coristi' | 'pubblica' | 'home' | 'nascosta';
export const VISIBILITA: Visibilita[] = ['nascosta', 'coristi', 'pubblica', 'home'];
// Sul sito pubblico: nella pagina del concerto (e, per home, anche nella home)
export const sulSito = (v: Visibilita) => v === 'pubblica' || v === 'home';

export interface FotoConcerto {
  id: string;
  data: string;            // del concerto
  evento?: string;
  caricatoDa: string;      // email
  chi: string;             // "Giulia R." (dalla scheda Coristi), o l'email
  visibilita: Visibilita;
  caricata: string;        // quando (ISO)
}

// Un concerto a cui si possono legare le foto: uno recente del calendario (id dell'evento) o uno
// dell'archivio del sito pubblico (id "archivio-AAAA-MM-GG")
export interface ConcertoScelta { id: string; data: string; titolo: string }
export interface ConcertoConFoto { data: string; titolo: string; evento?: ConcertoScelta; foto: FotoConcerto[] }

// I concerti per cui si possono caricare foto, il più recente prima: quelli già fatti (anche oggi)
// dell'ultimo anno dal calendario, compresi quelli non pubblici, e tutti quelli dell'archivio del sito
// pubblico con una data precisa (calendario "Concerti"), anche i più vecchi
export async function concertiPerFoto(): Promise<ConcertoScelta[]> {
  const recenti = (await eventi(piuGiorni(oggi(), -400), oggi()).catch(() => []))
    .filter((e) => e.tipo === 'concerto')
    .map((e) => ({ id: e.id, data: e.data, titolo: nomeEvento(e) }));
  const giorni = new Set(recenti.map((c) => c.data));
  const vecchi = archivio
    .filter((c) => !c.dataIncerta && /^\d{4}-\d{2}-\d{2}/.test(c.data) && c.data.slice(0, 10) <= oggi() && !giorni.has(c.data.slice(0, 10)))
    .map((c) => ({ id: `archivio-${c.data.slice(0, 10)}`, data: c.data.slice(0, 10), titolo: [c.autore?.split(/\s+/).at(-1), c.titolo].filter(Boolean).join(' · ') }));
  return [...recenti, ...vecchi].sort((a, b) => b.data.localeCompare(a.data));
}

// Tutte le foto, per concerto, il più recente prima. Senza "tutte", solo quelle che vedono i coristi.
// L'elenco si tiene un minuto (la Bacheca lo chiede a ogni apertura); dopo un cambio si rilegge
let inCache: { elenco: ConcertoConFoto[]; letto: number } | undefined;
const svuota = () => { inCache = undefined; };
export async function fotoDeiConcerti(tutte = false): Promise<ConcertoConFoto[]> {
  if (!configurato()) return [];
  if (!inCache || Date.now() - inCache.letto > 60 * 1000) inCache = { elenco: await leggiFoto(), letto: Date.now() };
  // Modalità demo (src/area/demo.ts): solo le foto già pubbliche, con chi le ha caricate inventato
  if (inDemo()) {
    return (await Promise.all(inCache.elenco.map(async (g) => ({
      ...g,
      foto: await Promise.all(g.foto.filter((f) => sulSito(f.visibilita)).map(async (f) => {
        const p = await personaVista(f.caricatoDa);
        return { ...f, caricatoDa: p.email, chi: p.chi };
      })),
    })))).filter((g) => g.foto.length);
  }
  return tutte ? inCache.elenco : inCache.elenco.map((g) => ({ ...g, foto: g.foto.filter((f) => f.visibilita !== 'nascosta') })).filter((g) => g.foto.length);
}

// Le ultime foto caricate che vedono i coristi (Bacheca), la più recente prima
export const ultimeFoto = async (quante = 6) =>
  (await fotoDeiConcerti()).flatMap((g) => g.foto.map((f) => ({ ...f, titolo: g.titolo }))).sort((a, b) => b.caricata.localeCompare(a.caricata)).slice(0, quante);

// Tutte le foto da Drive, anche nascoste, per concerto
async function leggiFoto(): Promise<ConcertoConFoto[]> {
  const [cartelle, elenco, concerti] = await Promise.all([fileIn(DRIVE_CARTELLA_FOTO_CONCERTI!, true), coristiVeri().catch(() => []), concertiPerFoto().catch(() => [] as ConcertoScelta[])]);
  const scelte = cartelle.filter((c) => /^\d{4}-\d{2}-\d{2}/.test(c.name));
  const perCartella = await fileInCartelle(scelte.map((c) => c.id));
  const dentro = scelte.map((c) => ({ c, file: perCartella.get(c.id) ?? [] }));
  const perConcerto = new Map<string, ConcertoConFoto>();
  for (const { c, file } of dentro) {
    for (const f of file.filter((x) => x.mimeType !== CARTELLA && x.mimeType.startsWith('image/'))) {
      const p = f.appProperties ?? {};
      const visibilita = (VISIBILITA.find((v) => v === p.visibilita) ?? 'coristi') as Visibilita;
      const data = p.data ?? c.name.slice(0, 10);
      const evento = concerti.find((e) => e.id === p.evento) ?? concerti.find((e) => e.data === data);
      const k = `${data}|${evento?.id ?? c.name}`;
      if (!perConcerto.has(k)) perConcerto.set(k, { data, titolo: evento?.titolo ?? (c.name.slice(11) || 'Concerto'), evento, foto: [] });
      const email = p.caricatoDa ?? '';
      const cc = elenco.find((x) => x.email === normalizza(email) || (x.emailPersonale && normalizza(x.emailPersonale) === normalizza(email)));
      perConcerto.get(k)!.foto.push({ id: f.id, data, evento: evento?.id, caricatoDa: email, chi: cc ? nomeBreve(cc) : email, visibilita, caricata: f.createdTime });
    }
  }
  return [...perConcerto.values()].sort((a, b) => b.data.localeCompare(a.data));
}

// Caricamento da un corista (/area/foto/carica): solo immagini, per un concerto già fatto
export const rispondiFotoCorista = (request: Request, email: string) => rispondiCaricamento(request, async (d) => {
  if (!configurato()) throw new Error('manca la variabile DRIVE_CARTELLA_FOTO_CONCERTI sul server');
  // Il tipo, o almeno l'estensione: alcuni browser non dicono il tipo delle foto HEIC dell'iPhone
  if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(String(d.tipo)) && !/\.(jpe?g|png|webp|avif|heic|heif)$/i.test(d.nome)) throw new Error(`«${d.nome}» non è una foto (JPEG, PNG, WebP, HEIC).`);
  // Senza tipo, dall'estensione: su Drive la foto deve risultare un'immagine
  if (!/^image\//.test(String(d.tipo))) {
    const est = d.nome.toLowerCase().match(/\.([a-z]+)$/)?.[1] ?? '';
    d.tipo = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', heic: 'image/heic', heif: 'image/heif' }[est] ?? 'image/jpeg';
  }
  const concerto = (await concertiPerFoto()).find((e) => e.id === String(d.evento));
  if (!concerto) throw new Error('Concerto non trovato: si caricano le foto dei concerti già fatti.');
  const cartella = await cartellaIn(DRIVE_CARTELLA_FOTO_CONCERTI!, `${concerto.data} ${concerto.titolo}`.slice(0, 120));
  return { cartella, nome: d.nome, appProperties: { caricatoDa: email, evento: concerto.id, data: concerto.data, visibilita: 'coristi' } };
}, async () => svuota());

// La foto deve stare in una sottocartella della cartella Foto dei concerti
async function controlla(id: string) {
  const f = await leggiFile(id);
  const cartella = f.parents?.[0] && (await leggiFile(f.parents[0]));
  if (!cartella?.parents?.includes(DRIVE_CARTELLA_FOTO_CONCERTI!)) throw new Error('Non è una foto dei concerti.');
  return f;
}

// Un corista toglie una sua foto, ma non se è già sul sito pubblico (Sito o Home: lì decidono i redattori);
// i redattori qualunque (cestino del Drive condiviso, si recupera per 30 giorni)
export async function togliFoto(id: string, email: string, redattore = false) {
  const f = await controlla(id);
  if (!redattore && normalizza(f.appProperties?.caricatoDa ?? '') !== normalizza(email)) throw new Error('Puoi togliere solo le foto che hai caricato tu.');
  if (!redattore && sulSito((f.appProperties?.visibilita ?? 'coristi') as Visibilita)) throw new Error('Questa foto è sul sito pubblico: per toglierla scrivi ai redattori.');
  await cestina(id);
  dimentica(id);
  svuota();
}

// I redattori decidono chi la vede
export async function cambiaVisibilita(id: string, visibilita: Visibilita, email: string) {
  if (!VISIBILITA.includes(visibilita)) throw new Error('Visibilità non valida.');
  await controlla(id);
  await google(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id`, {
    method: 'PATCH',
    body: JSON.stringify({ appProperties: { visibilita, decisaDa: email } }),
  });
  dimentica(id);
  svuota();
}
