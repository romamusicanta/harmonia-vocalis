// Video del canale YouTube: feed RSS pubblico (ultimi 15 video, nessuna chiave API) letto in fase
// di build. Senza canale configurato, o se il feed non risponde, si usa l'elenco in coro/video.ts.
// Dall'elenco di coro/video.ts si prendono comunque autore e sottotitolo dei video noti.
import { XMLParser } from 'fast-xml-parser';
import type { Video } from './tipi';
import { canaleId, inEvidenza, video as videoCoro } from '../../coro/video';
import { immagine } from './coro';

let cache: Promise<Video[]> | undefined;

export function elencoVideo(): Promise<Video[]> {
  cache ??= (canaleId ? caricaFeed(canaleId) : Promise.resolve(videoCoro))
    .catch((err) => {
      console.warn(`[youtube] feed non disponibile, uso l'elenco locale: ${err}`);
      return videoCoro;
    })
    .then((v) => [...v].sort((a, b) => b.pubblicato.localeCompare(a.pubblicato)));
  return cache;
}

export async function videoInEvidenza() {
  const tutti = await elencoVideo();
  return tutti.find((v) => v.id === inEvidenza) ?? tutti[0];
}

async function caricaFeed(canale: string): Promise<Video[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${canale}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = new XMLParser().parse(await res.text());
  const voci = [xml.feed?.entry ?? []].flat();
  if (voci.length === 0) throw new Error('feed vuoto');
  return voci.map((e: Record<string, unknown>) => {
    const id = String(e['yt:videoId']);
    const noto = videoCoro.find((v) => v.id === id);
    return { titolo: String(e.title), ...noto, id, pubblicato: String(e.published).slice(0, 10) };
  });
}

// Miniatura: file locale se indicato (demo), altrimenti quella di YouTube.
// Le miniature esistono solo fino a sddefault: maxresdefault restituisce 404.
export const miniatura = (v: Pick<Video, 'id' | 'miniatura'>) =>
  v.miniatura ? immagine(v.miniatura).src : `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;

// Video finti della demo: non si possono riprodurre
export const eFinto = (v: Pick<Video, 'id'>) => v.id.startsWith('demo-');

// "W. A. Mozart · Requiem K 626"
export const titoloCompleto = (v: Video) => [v.autore && v.autore !== 'Il coro' ? v.autore.split(' ').at(-1) : undefined, v.titolo].filter(Boolean).join(' · ');

export const trovaVideo = async (id?: string) => (id ? (await elencoVideo()).find((v) => v.id === id) : undefined);
