import { XMLParser } from 'fast-xml-parser';
import { site } from '../config';
import riserva from '../data/video.json';

export type Video = { id: string; titolo: string; pubblicato: string };

// Il feed RSS pubblico del canale restituisce gli ultimi 15 video, senza chiave API.
// Se la rete non risponde durante la build si usa l'istantanea in src/data/video.json
// (rigenerabile con `npm run aggiorna-video`).
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${site.link.youtubeChannelId}`;

let cache: Promise<Video[]> | undefined;

export function getVideo(): Promise<Video[]> {
  cache ??= caricaFeed().catch((err) => {
    console.warn(`[youtube] feed non disponibile, uso l'istantanea locale: ${err}`);
    return riserva as Video[];
  });
  return cache;
}

export async function caricaFeed(): Promise<Video[]> {
  const res = await fetch(FEED, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = new XMLParser().parse(await res.text());
  const voci = [xml.feed?.entry ?? []].flat();
  const video = voci.map((e: any) => ({
    id: String(e['yt:videoId']),
    titolo: String(e.title),
    pubblicato: String(e.published),
  }));
  if (video.length === 0) throw new Error('feed vuoto');
  return video;
}

export const miniatura = (id: string, qualita: 'hq' | 'maxres' = 'hq') =>
  `https://i.ytimg.com/vi/${id}/${qualita}default.jpg`;
