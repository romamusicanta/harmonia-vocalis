// Registrazioni delle prove: file audio (o video) caricati dai coristi dall'area coristi
// (/area/registrazioni) nella cartella "Registrazioni prove" del Drive condiviso
// (DRIVE_CARTELLA_REGISTRAZIONI), una sottocartella per prova ("AAAA-MM-GG Titolo"). Chi ha
// caricato e il titolo stanno nelle proprietà del file su Drive (appProperties: caricatoDa,
// titolo, evento): niente foglio. Si aggiungono i link "Registrazione:" scritti nelle prove del
// calendario. Si ascoltano nel lettore di Drive (coro@ e maestro@ leggono la cartella); ognuno
// può togliere i file che ha caricato (vanno nel cestino del Drive condiviso).
import { DRIVE_CARTELLA_REGISTRAZIONI } from 'astro:env/server';
import { cartellaIn, cestina, fileIn, leggiFile, linkFile, rispondiCaricamento } from './drive';
import { coristi, eventi, inizioStagione, nomeBreve, oggi, piuGiorni, type Evento } from './dati';
import { normalizza } from './servizio';

export const configurato = () => Boolean(DRIVE_CARTELLA_REGISTRAZIONI);

export interface Traccia {
  id: string;
  titolo: string;
  caricatoDa: string;     // email
  chi: string;            // "Giulia R." (dalla scheda Coristi), o l'email
  sezione?: string;
  link: string;
  dimensione?: number;
  tipo: string;
}
export interface GiornoRegistrato {
  data: string;
  titolo: string;         // della prova
  evento?: string;
  tracce: Traccia[];
  link?: string;          // "Registrazione:" della prova nel calendario
}

const senzaEstensione = (n: string) => n.replace(/\.[a-z0-9]{2,4}$/i, '');
const riga = (e: Evento, k: string) => e.righe.find(([x]) => x === k)?.[1];

// Le prove per cui si può caricare: dagli ultimi 60 giorni a oggi
export const proveRecenti = async () => (await eventi(piuGiorni(oggi(), -60), oggi())).filter((e) => e.tipo === 'prova' && e.inizioMs <= Date.now() + 3 * 3600 * 1000).reverse();

// Le registrazioni della stagione, la prova più recente prima
export async function registrazioni(): Promise<GiornoRegistrato[]> {
  const da = inizioStagione(oggi());
  const [prove, elenco, cartelle] = await Promise.all([
    eventi(da, oggi()).then((x) => x.filter((e) => e.tipo === 'prova')),
    coristi(),
    configurato() ? fileIn(DRIVE_CARTELLA_REGISTRAZIONI!, true) : Promise.resolve([]),
  ]);
  const giorni = new Map<string, GiornoRegistrato>();
  const chiave = (data: string, evento?: string) => `${data}|${evento ?? ''}`;
  for (const e of prove) {
    const link = riga(e, 'Registrazione');
    if (link) giorni.set(chiave(e.data, e.id), { data: e.data, titolo: e.titolo, evento: e.id, tracce: [], link });
  }
  const dentro = await Promise.all(cartelle.filter((c) => /^\d{4}-\d{2}-\d{2}/.test(c.name) && c.name.slice(0, 10) >= da).map(async (c) => ({ c, file: await fileIn(c.id) })));
  for (const { c, file } of dentro) {
    for (const f of file.filter((x) => x.mimeType !== 'application/vnd.google-apps.folder')) {
      const data = c.name.slice(0, 10);
      const evento = f.appProperties?.evento;
      const prova = prove.find((e) => e.id === evento) ?? prove.find((e) => e.data === data);
      const k = chiave(data, prova?.id);
      if (!giorni.has(k)) giorni.set(k, { data, titolo: (prova?.titolo ?? c.name.slice(11)) || 'Prova', evento: prova?.id, tracce: [], link: prova && riga(prova, 'Registrazione') });
      const email = f.appProperties?.caricatoDa ?? '';
      const c2 = elenco.find((x) => x.email === normalizza(email) || (x.emailPersonale && normalizza(x.emailPersonale) === normalizza(email)));
      giorni.get(k)!.tracce.push({
        id: f.id, titolo: f.appProperties?.titolo || senzaEstensione(f.name), caricatoDa: email,
        chi: c2 ? nomeBreve(c2) : email, sezione: c2?.sezione, link: linkFile(f.id), dimensione: f.size ? Number(f.size) : undefined, tipo: f.mimeType,
      });
    }
  }
  return [...giorni.values()].sort((a, b) => b.data.localeCompare(a.data));
}

// Endpoint del caricamento (/area/registrazioni/file): il file va nella cartella della prova
export const rispondiFile = (request: Request, email: string) => rispondiCaricamento(request, async (d) => {
  if (!configurato()) throw new Error('manca la variabile DRIVE_CARTELLA_REGISTRAZIONI sul server');
  if (!/^(audio|video)\//.test(String(d.tipo)) && !/\.(m4a|mp3|wav|aac|ogg|opus|amr|3gp|mp4|mov|webm|flac)$/i.test(d.nome)) throw new Error(`«${d.nome}» non sembra una registrazione audio o video.`);
  const prova = (await proveRecenti()).find((e) => e.id === String(d.evento));
  if (!prova) throw new Error('Scegli la prova a cui si riferisce la registrazione.');
  const cartella = await cartellaIn(DRIVE_CARTELLA_REGISTRAZIONI!, `${prova.data} ${prova.titolo}`);
  const titolo = String(d.titolo ?? '').trim().slice(0, 120);
  return { cartella, nome: d.nome, appProperties: { caricatoDa: email, evento: prova.id, ...(titolo ? { titolo } : {}) } };
});

// Toglie un file caricato da chi lo chiede (nel cestino del Drive condiviso)
export async function togli(id: string, email: string) {
  const f = await leggiFile(id);
  if (!f.parents?.length) throw new Error('registrazione non trovata');
  if (normalizza(f.appProperties?.caricatoDa ?? '') !== normalizza(email)) throw new Error('Puoi togliere solo le registrazioni che hai caricato tu.');
  await cestina(id);
}
