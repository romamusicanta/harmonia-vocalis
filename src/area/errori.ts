// Errori di Google e della rete in parole semplici, per le pagine e per le risposte degli
// endpoint: chi usa il sito vede cosa è successo e cosa fare, il testo tecnico resta come dettaglio
// (componente src/area/Errore.astro).
export interface Spiegazione { testo: string; dettaglio?: string }

export function spiega(e: unknown): Spiegazione {
  const tecnico = e instanceof Error ? e.message : String(e ?? '');
  const codice = Number(tecnico.match(/\((\d{3})\)/)?.[1] ?? tecnico.match(/\b(4\d\d|5\d\d)\b/)?.[1]);
  const dettaglio = tecnico || undefined;
  if (codice === 401 || /invalid authentication|invalid_grant|token/i.test(tecnico)) return { testo: 'L’accesso a Google è scaduto: esci e rientra, poi riprova.', dettaglio };
  if (codice === 403) return { testo: 'Google non dà il permesso per questa operazione. Se succede ancora, scrivi a admin@romamusicanta.org.', dettaglio };
  if (codice === 404) return { testo: 'Su Google non c’è più: forse è stato cancellato. Ricarica la pagina.', dettaglio };
  if (codice === 429 || codice >= 500) return { testo: 'Google in questo momento non risponde: riprova tra un minuto.', dettaglio };
  if (/fetch failed|network|ECONN|ETIMEDOUT|ENOTFOUND/i.test(tecnico)) return { testo: 'Il sito non riesce a raggiungere Google: riprova tra poco.', dettaglio };
  // Messaggi già scritti per le persone (dalle funzioni del sito) restano come sono
  if (tecnico && !/^Google \(/.test(tecnico)) return { testo: tecnico };
  return { testo: 'Qualcosa non ha funzionato con Google: riprova tra poco.', dettaglio };
}

// Solo il testo, per le risposte JSON degli endpoint
export const spiegaTesto = (e: unknown) => spiega(e).testo;
