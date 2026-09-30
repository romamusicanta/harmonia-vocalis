# Coro Harmonia Vocalis — sito pubblico

Sito statico del Coro Harmonia Vocalis (Associazione Culturale Musicale Roma Musicanta), destinato a `romamusicanta.org`.
L'associazione usa Google Workspace for Nonprofits (edizione gratuita) sul dominio `romamusicanta.org`.

Dal 30/09/2026 il sito è **una copia del modello Dimora Choir** (`~/projects/dimorachoir`, prodotto di Mario per vendere siti ai cori): il motore viene dal modello, i dati del coro stanno in `coro/`. Per come funziona il motore vale l'AGENTS.md del modello; qui c'è solo ciò che è proprio di Harmonia Vocalis.

## Comandi verificati

- `npm ci` — dipendenze, versioni bloccate (Node ≥ 22.12)
- `npm run dev:sito` — server di sviluppo del sito su http://localhost:4321 (in `.claude/launch.json` come `sito`). `npm run dev` invece apre la **demo** del modello (pannello di scelta, tutte le vesti): utile per provare il logo e i dati di HV nelle altre vesti, ma l'area di esempio usa foto del Coro Esempio che qui non ci sono.
- `npm run build` — genera il sito statico in `dist/` (è quello che costruisce Vercel, vedi `vercel.json`)
- `git fetch modello && git merge modello/main` — porta dentro correzioni e novità del modello (vedi Workflow)

## Architettura

- **Motore** (`src/`, `package.json`, `astro.config.mjs`…): dal modello, **non modificarlo qui**. Una correzione va fatta nel modello e poi portata con un merge; una modifica fatta qui entra in conflitto al prossimo aggiornamento.
- **Dati del coro** (`coro/`):
  - `coro.config.ts` — dati generali (email, sede, prove, Maestro, direttivo, organico, link), aspetto e funzioni attive. Aspetto: veste **Classica**, palette **porpora**, carattere **EB Garamond** (`garamond`).
  - `Logo.astro` — logo 3 "Diapason orizzontale" in SVG, disegnato con `currentColor` e il punto in `var(--accento)`. Il carattere Archivo largo è in `aspetto.caratteriLogo`.
  - `concerti.ts` — prossimi di riserva e archivio curato a mano, con gli ID dei video YouTube.
  - `video.ts` — ID del canale, video in evidenza, istantanea di riserva con l'autore per il raggruppamento.
  - `testi/*.md` — storia, Maestro, canta con noi, organizzatori, privacy.
  - `immagini/` — foto, con i crediti in `CREDITI.md`.
- **Dati letti in fase di build**:
  - **Video**: feed RSS del canale `@romamusicanta`.
  - **Prossimi concerti**: indirizzo iCal pubblico del calendario Google "Concerti", nella variabile `CALENDARIO_CONCERTI_ICS` (e `CALENDARIO_CONCERTI_ID` per il pulsante "Iscriviti"). Convenzione per gli eventi: titolo = rassegna/evento, luogo = città e sala, prima riga della descrizione = programma, righe successive = note.
  - Se una fonte non risponde, il sito usa i dati di `coro/` e lo scrive a console con `[youtube]` / `[calendario]`.
- **Area coristi**: il sito non la genera ancora, perché l'accesso con Google è da fare nel modello. Il collegamento "Area coristi" porta all'anteprima del mockup (`link.areaCoristi: '/mockup/sito/area.html'`).
- **File propri del coro**: in `.gitattributes` sono marcati `merge=ours`, così un aggiornamento del modello non li sovrascrive. Sono `coro/**`, `AGENTS.md`, `vercel.json`, `.claude/launch.json` e `public/favicon.svg`. Serve una volta per clone: `git config merge.ours.driver true`. `CLAUDE.md` è un collegamento simbolico ad `AGENTS.md`.
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
2. Un problema del motore o delle vesti si corregge in `~/projects/dimorachoir`, poi qui `git fetch modello && git merge modello/main`. Il remote `modello` punta per ora alla cartella locale del modello; il ramo `modello/logo-del-coro` contiene le novità nate per HV (logo del coro, area coristi esterna) finché non entra in `main` del modello.
3. `npm run build` per verificare che la build passi.
4. Controllo visivo con `npm run dev:sito`, anche a larghezza mobile (375px).

## Trappole note

- Pubblicazione: progetto Vercel `harmonia-vocalis` (https://harmonia-vocalis.vercel.app), dal 30/09/2026 con `vercel deploy --prod` dalla cartella locale (il repository non ha remote GitHub). Su Vercel non ci sono ancora le variabili `CALENDARIO_CONCERTI_ICS`/`_ID`: i prossimi concerti vengono da `coro/concerti.ts`.

- Le miniature YouTube del canale esistono solo fino a `sddefault` (640×480): `maxresdefault` restituisce 404.
- Il luogo delle prove è discordante tra italiacori (Via del Frantoio 2) e YouTube (Via di Casal Bruciato 15): da confermare prima della pubblicazione.
- Le foto in `coro/immagini/` vengono dalla scheda italiacori: autori e permessi sono da verificare (`CREDITI.md`).
- La sezione "Baritoni e Bassi" dell'organico nel modello dà due rese sbagliate: "Baritoni e basso" nel modulo di candidatura e "tenori e baritoni e bassi" negli organizzatori. Va corretto nel modello.
- Gli screenshot del pannello browser integrato risultano neri dopo lo scorrimento; per verifiche visive a pagina intera usare Chrome headless (`--screenshot`), che però ha una larghezza minima di circa 500px.
