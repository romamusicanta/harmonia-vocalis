// Rigenera src/data/video.json, l'istantanea dei video usata se il feed YouTube non risponde in build.
import { writeFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';

const CANALE = 'UC0gvYeL7mHpCwht3qjS5vag';
const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CANALE}`);
if (!res.ok) throw new Error(`Feed YouTube: HTTP ${res.status}`);
const xml = new XMLParser().parse(await res.text());
const video = [xml.feed.entry].flat().map((e) => ({
  id: String(e['yt:videoId']),
  titolo: String(e.title),
  pubblicato: String(e.published),
}));
await writeFile(new URL('../src/data/video.json', import.meta.url), JSON.stringify(video, null, 2) + '\n');
console.log(`Salvati ${video.length} video.`);
