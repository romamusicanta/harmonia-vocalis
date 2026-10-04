// Dati strutturati per Google (JSON-LD, schema.org): il coro come organizzazione musicale nella
// home, ogni concerto come evento nella sua pagina. Google li usa per la scheda del coro e per
// mostrare i concerti nei risultati degli eventi. Si controllano con
// https://search.google.com/test/rich-results
import type { Concerto } from './tipi';
import type { coroIn } from './coro';

type Coro = ReturnType<typeof coroIn>;
export type DatiStrutturati = Record<string, unknown>;

// Riferimento al coro, uguale in tutte le pagine: Google lo collega alla scheda completa della home
const idCoro = (coro: Coro) => `${coro.url}/#coro`;

function nomiAlternativi(coro: Coro) {
  const breve = coro.nome.replace(/^Coro\s+/, '');
  return [...new Set([breve, breve.replace(/\s+/g, ''), coro.sigla])];
}

export function datiCoro(coro: Coro, lingua: 'it' | 'en', immagine?: string): DatiStrutturati[] {
  const indirizzo = (l: { nome?: string; indirizzo: string; cap?: string; citta: string }) => ({
    '@type': 'PostalAddress',
    streetAddress: l.indirizzo,
    postalCode: l.cap,
    addressLocality: l.citta,
    addressCountry: 'IT',
  });
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'MusicGroup',
      '@id': idCoro(coro),
      name: coro.nome,
      // Le forme con cui la gente cerca il coro, anche tutto attaccato come il dominio harmoniavocalis.com
      alternateName: nomiAlternativi(coro),
      description: coro.descrizione,
      url: coro.url,
      logo: `${coro.url}/icone/icona-512.png`,
      image: immagine,
      email: coro.email,
      foundingDate: String(coro.fondazione),
      genre: lingua === 'en' ? ['Choral music', 'Sacred music'] : ['Musica corale', 'Musica sacra'],
      foundingLocation: { '@type': 'Place', name: coro.citta },
      address: indirizzo(coro.sede),
      parentOrganization: { '@type': 'Organization', name: coro.associazione },
      member: { '@type': 'OrganizationRole', roleName: lingua === 'en' ? 'Conductor' : 'Direttore', member: { '@type': 'Person', name: coro.maestro.nome } },
      sameAs: [coro.link.youtube, ...coro.associatoA.map((a) => a.url).filter((u) => u.includes('italiacori'))].filter(Boolean),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      // Nome del sito mostrato da Google sopra il risultato al posto dell'indirizzo
      name: coro.nome.replace(/^Coro\s+/, ''),
      alternateName: [coro.nome, ...nomiAlternativi(coro)].filter((n) => n !== coro.nome.replace(/^Coro\s+/, '')),
      url: coro.url,
      inLanguage: ['it', 'en'],
      publisher: { '@id': idCoro(coro) },
    },
  ];
}

// Scarto dell'ora di Roma in quel giorno ("+01:00" d'inverno, "+02:00" con l'ora legale)
function scartoRoma(data: string) {
  const nome = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${data.slice(0, 10)}T12:00:00Z`))
    .find((p) => p.type === 'timeZoneName')?.value;
  return nome?.replace('GMT', '') || '+01:00';
}

export function datiConcerto(
  c: Concerto,
  opzioni: { coro: Coro; url: string; titolo: string; descrizione: string; immagine?: string; direttore?: string },
): DatiStrutturati {
  const { coro, url } = opzioni;
  const conOra = c.data.length > 10;
  const inizio = conOra ? `${c.data.slice(0, 16)}:00${scartoRoma(c.data)}` : c.data.slice(0, 10);
  const programma = c.programma?.length ? c.programma : [{ autore: c.autore, opera: c.titolo }];
  const gratuito = c.ingresso && /libero|gratuit|free/i.test(c.ingresso);
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: opzioni.titolo,
    description: opzioni.descrizione,
    url,
    image: opzioni.immagine ? [opzioni.immagine] : undefined,
    startDate: inizio,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: c.sala ?? c.luogo ?? c.indirizzo,
      address: c.indirizzo ?? ([c.sala, c.luogo].filter(Boolean).join(', ') || undefined),
    },
    performer: [
      { '@type': 'MusicGroup', '@id': idCoro(coro), name: coro.nome, url: coro.url },
      { '@type': 'Person', name: opzioni.direttore ?? coro.maestro.nome },
    ],
    organizer: c.organizza ? { '@type': 'Organization', name: c.organizza } : { '@id': idCoro(coro) },
    workPerformed: programma.map((b) => ({
      '@type': 'MusicComposition',
      name: b.opera,
      composer: b.autore ? { '@type': 'Person', name: b.autore.replace(/\s*\(.*\)$/, '') } : undefined,
    })),
    // Il prezzo si scrive solo quando l'ingresso è libero: negli altri casi il testo è libero e non si indovina
    offers: gratuito ? { '@type': 'Offer', price: 0, priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url } : undefined,
  };
}
