# Coro Harmonia Vocalis — sito pubblico

Sito statico del Coro Harmonia Vocalis (Associazione Culturale Musicale Roma Musicanta), destinato a `romamusicanta.org`.
L'associazione usa Google Workspace for Nonprofits (edizione gratuita) sul dominio `romamusicanta.org`.

Il sito è nato il 30/09/2026 come copia del modello Dimora Choir (`~/projects/dimorachoir`, prodotto di Mario per vendere siti ai cori), ma **da allora è indipendente**: il modello resta solo una vetrina e non si portano più aggiornamenti da lì. Il motore (`src/`) si modifica direttamente qui; i dati del coro stanno in `coro/`.

## Comandi verificati

- `npm ci` — dipendenze, versioni bloccate (Node ≥ 22.12)
- `npm run dev:sito` — server di sviluppo del sito su http://localhost:4321 (in `.claude/launch.json` come `sito`). `npm run dev` invece apre la **demo** del modello (pannello di scelta, tutte le vesti): utile per provare il logo e i dati di HV nelle altre vesti, ma l'area di esempio usa foto del Coro Esempio che qui non ci sono.
- `npm run build` — genera il sito statico in `dist/` (è quello che costruisce Vercel, vedi `vercel.json`)

## Architettura

- **Motore** (`src/`, `package.json`, `astro.config.mjs`…): venuto dal modello, ora si corregge e si estende qui. Contiene ancora le vesti che HV non usa (`src/vesti/` oltre a `stagione`, che è anche la base di tutte le altre) e la demo (`src/demo/`, `npm run dev`).
- **Dati del coro** (`coro/`):
  - `coro.config.ts` — dati generali (email, sede, prove, Maestro, direttivo, organico, link), aspetto e funzioni attive. Aspetto (dal 1/10/2026): veste **Stagione**, carattere **Manrope**, colori propri scelti da Mario in `aspetto.colori` (principale blu notte `#0f1b23`, testo quasi nero `#16181f`, accento giallo `#f2b41b`, fondo `#f5f4f0`, schede bianche, barra in alto e piè di pagina `#0f1b23` come il principale): è l'unica palette del sito, le palette del catalogo (`src/motore/aspetto.ts`, `src/stile/palette.css`) restano solo per la demo e `aspetto.palette` si usa solo senza colori propri. La veste Classica è stata eliminata; i vecchi indirizzi `/stagione/…` delle prove reindirizzano alla radice (`vercel.json`). Nei pulsanti chiari (accento, bianchi, con bordo) la scritta ha il colore del testo. Con `aspetto.pannelloProva: true` compare in basso a destra il pannello "Prova la grafica" (`src/componenti/PannelloProva.astro` e `PannelloProvaIniziale.astro`): i sette colori (principale, accento, fondo, schede, testo, piè di pagina, barra in alto, gli ultimi due facoltativi; le sfumature si ricavano in `src/stile/palette.css`, palette `personalizzata`) partono da quelli del sito e si cambiano uno per uno, più i caratteri; con più vesti in `aspetto.inProva` (pagine sotto `/<veste>/`, `noindex`) anche la scelta della veste. La scelta resta nel browser di chi guarda (localStorage `hv-prova`, con un'impronta della grafica del sito: se `aspetto` cambia, le scelte salvate prima vengono ignorate) e si condivide con "Copia il link" (`?palette=personalizzata&carattere=…&colori=…`); per renderla del sito va riportata in `aspetto.colori`. La favicon (`public/favicon.svg`) è il diapason del logo nei colori del sito: va aggiornata a mano se cambiano.
  - `Logo.astro` — logo 3 "Diapason orizzontale" in SVG, disegnato con `currentColor` e il punto in `var(--accento)`. Il carattere Archivo largo è in `aspetto.caratteriLogo`.
  - `concerti.ts` — archivio storico curato a mano (con gli ID dei video YouTube) e prossimi di riserva, usati solo se il calendario non c'è o non risponde.
  - `video.ts` — ID del canale, video in evidenza, istantanea di riserva con l'autore per il raggruppamento.
  - `testi/*.md` — storia, Maestro, canta con noi, organizzatori, privacy.
  - `immagini/` — foto, con i crediti in `CREDITI.md`.
- **Dati letti in fase di build**:
  - **Video**: feed RSS del canale `@romamusicanta`.
  - **Concerti**: indirizzo iCal pubblico del calendario Google "Concerti", nella variabile `CALENDARIO_CONCERTI_ICS` (e `CALENDARIO_CONCERTI_ID` per il pulsante "Iscriviti"). Gli eventi futuri sono "in programma"; quelli passati entrano da soli nell'archivio, accanto a quello storico di `coro/concerti.ts` (a parità di giorno vale il file). Convenzione per gli eventi, descritta per esteso in testa a `src/motore/concerti.ts`: titolo = rassegna/evento; luogo = "città, sala" oppure un indirizzo scelto da Google Maps; "Tutto il giorno" = orario da definire; descrizione = prima riga "Autore · Opera" (altre opere sulle righe seguenti), poi righe `Organizza:`, `Ingresso:`, `Organico:`, `Brani:`, `Foto:` (file in `coro/immagini`), `Video:` (ID YouTube), `Evidenza:`; ogni altra etichetta è un interprete (`Soprano: Maria Rossi`, `Solisti: (soprano, contralto…)` = da annunciare). Righe senza etichetta, foto inesistenti ed eventi annullati sono scartati con un avviso `[calendario]`.
  - Se una fonte non risponde, il sito usa i dati di `coro/` e lo scrive a console con `[youtube]` / `[calendario]`.
- **Area coristi**: il sito non la genera ancora, perché l'accesso con Google è da fare. Il collegamento "Area coristi" porta all'anteprima del mockup (`link.areaCoristi: '/mockup/sito/area.html'`).
- `CLAUDE.md` è un collegamento simbolico ad `AGENTS.md`.
- **Mockup** (`public/mockup/`, HTML statico servito così com'è):
  - le tre direzioni visive iniziali;
  - le proposte di logo (`logo/`);
  - il mockup completo in direzione "C · Stagione" (`sito/`), da cui sono stati presi i dati. Resta online per l'anteprima dell'area coristi.

  `sito/prova.js` ha il pannello "Colori e caratteri" nascosto (`PANNELLO_VISIBILE = false`).

Essendo statico, il sito si aggiorna solo quando viene ricostruito: in produzione serve una ricostruzione periodica (es. giornaliera, tramite deploy hook dell'hosting) perché compaiano nuovi concerti e video.

## Convenzioni

- Codice, nomi e testi in italiano.
- I dati incerti sono marcati con commento `DA VERIFICARE`: non presentarli come certi e non inventarne di nuovi (date, luoghi, biografie).
- Niente elenchi nominativi dei coristi nel sito pubblico (privacy): solo direttivo e Maestro.
- Commit: italiano discorsivo.

## Workflow

1. Aggiornare i dati in `coro/`, oppure direttamente nel calendario Google e su YouTube.
2. Motore e veste Stagione si modificano qui, in `src/`. Il modello `~/projects/dimorachoir` non si tocca da qui e non se ne portano aggiornamenti.
3. `npm run build` per verificare che la build passi. Per provare il calendario senza quello vero: servire un file `.ics` in locale (`python3 -m http.server`) e lanciare la build con `CALENDARIO_CONCERTI_ICS=http://localhost:<porta>/file.ics`.
4. Controllo visivo con `npm run dev:sito`, anche a larghezza mobile (375px).

## Trappole note

- Pubblicazione: progetto Vercel `harmonia-vocalis` (https://harmonia-vocalis.vercel.app), dal 30/09/2026 con `vercel deploy --prod` dalla cartella locale (il repository non ha remote GitHub). Su Vercel non ci sono ancora le variabili `CALENDARIO_CONCERTI_ICS`/`_ID`: i prossimi concerti vengono da `coro/concerti.ts`.

- Le miniature YouTube del canale esistono solo fino a `sddefault` (640×480): `maxresdefault` restituisce 404.
- Il luogo delle prove è discordante tra italiacori (Via del Frantoio 2) e YouTube (Via di Casal Bruciato 15): da confermare prima della pubblicazione.
- Le foto in `coro/immagini/` vengono dalla scheda italiacori: autori e permessi sono da verificare (`CREDITI.md`).
- La sezione "Baritoni e Bassi" dell'organico dà due rese sbagliate: "Baritoni e basso" nel modulo di candidatura e "tenori e baritoni e bassi" negli organizzatori. Da correggere nel motore.
- Gli screenshot del pannello browser integrato risultano neri dopo lo scorrimento; per verifiche visive a pagina intera usare Chrome headless (`--screenshot`), che però ha una larghezza minima di circa 500px.
