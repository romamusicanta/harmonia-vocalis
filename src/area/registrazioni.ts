// Registrazioni delle prove: file audio (o video) caricati dai redattori dal modulo di Modifica
// della prova (Amministrazione) nella cartella "Registrazioni prove" del Drive condiviso
// (DRIVE_CARTELLA_REGISTRAZIONI), una sottocartella per prova ("AAAA-MM-GG Titolo"). I coristi le
// ascoltano nella pagina Registrazioni della loro area, sotto ogni prova della stagione. Chi ha
// caricato e il titolo stanno nelle proprietà del file su Drive (appProperties: caricatoDa,
// titolo, evento): niente foglio. Si aggiungono i link "Registrazione:" scritti nelle prove del
// calendario. Si ascoltano dal sito (src/area/file.ts); i redattori le tolgono (cestino del Drive condiviso).
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

// Le prove già fatte della stagione, la più recente prima, ognuna con le sue registrazioni (pagina
// Prove dell'area coristi). In fondo le registrazioni la cui prova non è più nel calendario.
export async function proveFatte(): Promise<{ prova?: Evento; giorno?: GiornoRegistrato }[]> {
  const [giorni, prove] = await Promise.all([registrazioni(), eventi(inizioStagione(oggi()), oggi())]);
  const fatte = prove.filter((e) => e.tipo === 'prova' && e.inizioMs <= Date.now()).reverse();
  const conProva = fatte.map((prova) => ({ prova, giorno: giorni.find((g) => g.evento === prova.id) }));
  const orfani = giorni.filter((g) => !fatte.some((e) => e.id === g.evento)).map((giorno) => ({ giorno }));
  return [...conProva, ...orfani];
}

// ——— Dai redattori, nel modulo di Modifica della prova (Amministrazione) ———

// Il messaggio per il gruppo WhatsApp dei coristi con le registrazioni di una prova: i link dei file
// (si ascoltano o si scaricano dal sito) e quello della prova nella pagina Registrazioni. Con nuove,
// dopo un caricamento ("Nuove registrazioni…"); senza, tutte quelle della prova
export function registrazioniPerWhatsapp(prova: { id: string; data: string; titolo: string }, tracce: Pick<Traccia, 'id' | 'titolo'>[], quando: string, sito: string, nuove = true) {
  const titolo = /^prova( settimanale)?$/i.test(prova.titolo) ? 'prova' : prova.titolo.toLowerCase();
  const file = tracce.map((t) => `${t.titolo}: ${sito}/area/file/${t.id}`);
  return [
    `*${nuove ? (tracce.length === 1 ? 'Nuova registrazione' : 'Nuove registrazioni') : (tracce.length === 1 ? 'Registrazione' : 'Registrazioni')} della ${titolo} di ${quando}*`,
    `Da ascoltare o scaricare:\n${file.join('\n')}`,
    `Tutte le registrazioni della prova: ${sito}/area/registrazioni#p-${prova.id}`,
  ].join('\n\n');
}

// I file registrati di una prova: nella cartella della sua data, quelli legati a quella prova
export async function fileDellaProva(e: Pick<Evento, 'id' | 'data'>): Promise<Traccia[]> {
  if (!configurato()) return [];
  const elenco = await coristi().catch(() => []);
  const cartelle = (await fileIn(DRIVE_CARTELLA_REGISTRAZIONI!, true)).filter((c) => c.name.startsWith(e.data));
  const file = (await Promise.all(cartelle.map((c) => fileIn(c.id)))).flat().filter((f) => f.mimeType !== 'application/vnd.google-apps.folder' && (!f.appProperties?.evento || f.appProperties.evento === e.id));
  return file.map((f) => {
    const email = f.appProperties?.caricatoDa ?? '';
    const c = elenco.find((x) => x.email === normalizza(email));
    return { id: f.id, titolo: f.appProperties?.titolo || senzaEstensione(f.name), caricatoDa: email, chi: c ? nomeBreve(c) : email, sezione: c?.sezione, link: linkFile(f.id), dimensione: f.size ? Number(f.size) : undefined, tipo: f.mimeType };
  });
}

// Caricamento dai redattori (/admin/prove/registrazione): qualunque prova già fatta
export const rispondiFileRedattore = (request: Request, email: string) => rispondiCaricamento(request, async (d) => {
  if (!configurato()) throw new Error('manca la variabile DRIVE_CARTELLA_REGISTRAZIONI sul server');
  if (!/^(audio|video)\//.test(String(d.tipo)) && !/\.(m4a|mp3|wav|aac|ogg|opus|amr|3gp|mp4|mov|webm|flac)$/i.test(d.nome)) throw new Error(`«${d.nome}» non sembra una registrazione audio o video.`);
  const prova = (await eventi(piuGiorni(oggi(), -400), oggi())).find((e) => e.tipo === 'prova' && e.id === String(d.evento));
  if (!prova) throw new Error('Prova non trovata nel calendario (le registrazioni si caricano per le prove già fatte).');
  const cartella = await cartellaIn(DRIVE_CARTELLA_REGISTRAZIONI!, `${prova.data} ${prova.titolo}`);
  const titolo = String(d.titolo ?? '').trim().slice(0, 120);
  return { cartella, nome: d.nome, appProperties: { caricatoDa: email, evento: prova.id, ...(titolo ? { titolo } : {}) } };
});

// I redattori tolgono qualunque registrazione (purché stia nella cartella Registrazioni prove)
export async function togliComeRedattore(id: string) {
  const f = await leggiFile(id);
  const cartella = f.parents?.[0] && (await leggiFile(f.parents[0]));
  if (!cartella?.parents?.includes(DRIVE_CARTELLA_REGISTRAZIONI!)) throw new Error('Non è una registrazione delle prove.');
  await cestina(id);
}
