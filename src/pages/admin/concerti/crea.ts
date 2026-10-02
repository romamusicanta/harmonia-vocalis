// Crea un concerto dal modulo /admin/concerti/nuovo: cartella su Drive con locandina e copertina,
// evento nel calendario "Concerti" scritto secondo la convenzione di src/motore/concerti.ts.
import type { APIRoute } from 'astro';
import { caricaFile, cartellaConcerto, creaEvento, eventiDelGiorno } from '../../../admin/operazioni';

export const prerender = false;

// Etichette che il sito legge come dati, non come interpreti
const riservate = ['organizza', 'ingresso', 'organico', 'brani', 'foto', 'locandina', 'video', 'evidenza'];
const pulisci = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const tutti = (f: FormData, nome: string) => f.getAll(nome).map(pulisci);
const json = (corpo: object, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

// "2026-10-04" → "2026-27" (la stagione va da settembre ad agosto, come sul sito)
function stagione(data: string) {
  const anno = Number(data.slice(0, 4));
  const inizio = Number(data.slice(5, 7)) >= 9 ? anno : anno - 1;
  return `${inizio}-${String(inizio + 1).slice(2)}`;
}

// Data e ora locali di Roma più due ore, sempre come ora locale (il fuso lo dice timeZone)
function piuDueOre(data: string, ora: string) {
  const d = new Date(`${data}T${ora}:00Z`);
  d.setUTCHours(d.getUTCHours() + 2);
  return d.toISOString().slice(0, 19);
}

const giornoDopo = (data: string) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const s = locals.sessione!;
  try {
    const f = await request.formData();
    const data = pulisci(f.get('data'));
    const ora = pulisci(f.get('ora'));
    const citta = pulisci(f.get('citta'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return json({ ok: false, errore: 'manca la data' }, 400);
    if (ora && !/^\d{2}:\d{2}$/.test(ora)) return json({ ok: false, errore: 'ora non valida' }, 400);
    if (!citta) return json({ ok: false, errore: 'manca la città' }, 400);

    const autori = tutti(f, 'autore');
    const opere = tutti(f, 'opera').map((opera, i) => ({ autore: autori[i], opera })).filter((o) => o.opera);
    if (!opere.length) return json({ ok: false, errore: "manca l'opera" }, 400);
    if (opere.some((o) => /:/.test(o.opera) && !o.autore)) return json({ ok: false, errore: 'un’opera senza autore non può contenere i due punti' }, 400);

    // Video: l'indirizzo di YouTube o il solo ID
    const indirizzoVideo = pulisci(f.get('video'));
    const video = indirizzoVideo.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/)?.[1] ?? (/^[\w-]{11}$/.test(indirizzoVideo) ? indirizzoVideo : '');
    if (indirizzoVideo && !video) return json({ ok: false, errore: 'indirizzo del video non riconosciuto' }, 400);

    // Un concerto già in calendario quel giorno: si crea solo con la conferma
    if (!f.get('conferma')) {
      const [gia] = await eventiDelGiorno(s, data);
      if (gia) return json({ ok: false, giaPresente: gia.summary ?? 'senza titolo' });
    }

    const nomi = tutti(f, 'nome');
    const interpreti = tutti(f, 'ruolo').map((ruolo, i) => ({ ruolo, nome: nomi[i] })).filter((x) => x.ruolo || x.nome);
    for (const x of interpreti) {
      if (!x.ruolo) return json({ ok: false, errore: `manca il ruolo di ${x.nome}` }, 400);
      if (riservate.includes(x.ruolo.toLowerCase()) || !/^[\p{L}' ]{2,30}$/u.test(x.ruolo)) return json({ ok: false, errore: `"${x.ruolo}" non va bene come ruolo` }, 400);
    }

    // Descrizione secondo la convenzione: opere, poi organico e brani (dell'ultima), poi le etichette
    const righe = [
      ...opere.map((o) => (o.autore ? `${o.autore} · ${o.opera}` : o.opera)),
      ...[['Organico', pulisci(f.get('organico'))], ['Brani', pulisci(f.get('brani'))], ['Evidenza', pulisci(f.get('evidenza'))], ['Organizza', pulisci(f.get('organizza'))], ['Ingresso', pulisci(f.get('ingresso'))], ['Video', video]]
        .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
      ...interpreti.map((x) => `${x.ruolo}: ${x.nome}`.trim()),
    ];
    const sala = pulisci(f.get('sala'));
    const luogo = [citta, sala, pulisci(f.get('indirizzo'))].filter(Boolean).join(', ');
    const titolo = pulisci(f.get('rassegna')) || opere[0].opera;

    // Cartella su Drive e immagini
    const nomeCartella = `${data} ${citta.replace(/\s*\([A-Z]{2}\)$/, '')} – ${opere[0].opera}`.replace(/[\/\\]/g, '-');
    const cartella = await cartellaConcerto(s, stagione(data), nomeCartella);
    const allegati = [];
    for (const campo of ['locandina', 'copertina']) {
      const file = f.get(campo);
      if (!(file instanceof File) || !file.size) continue;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return json({ ok: false, errore: `${campo}: solo immagini JPEG, PNG o WebP` }, 400);
      const caricato = await caricaFile(s, file, `${campo}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`, cartella);
      allegati.push({ fileUrl: caricato.webViewLink, title: caricato.name, mimeType: file.type });
    }

    const evento = await creaEvento(s, {
      summary: titolo,
      location: luogo,
      description: righe.join('\n'),
      start: ora ? { dateTime: `${data}T${ora}:00`, timeZone: 'Europe/Rome' } : { date: data },
      end: ora ? { dateTime: piuDueOre(data, ora), timeZone: 'Europe/Rome' } : { date: giornoDopo(data) },
      attachments: allegati,
    });
    return json({ ok: true, evento: evento.htmlLink, cartella: `https://drive.google.com/drive/folders/${cartella}` });
  } catch (e) {
    return json({ ok: false, errore: (e as Error).message }, 500);
  }
};
