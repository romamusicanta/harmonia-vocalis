# Coro Harmonia Vocalis — sito pubblico

Sito statico del Coro Harmonia Vocalis (Associazione Culturale Musicale Roma Musicanta), pubblicato su https://romamusicanta.org (dal 1/10/2026).
L'associazione usa Google Workspace for Nonprofits (edizione gratuita) sul dominio `romamusicanta.org`.

Il sito è nato il 30/09/2026 come copia del modello Dimora Choir (`~/projects/dimorachoir`, prodotto di Mario per vendere siti ai cori), ma **da allora è indipendente**: il modello resta solo una vetrina e non si portano più aggiornamenti da lì. Il motore (`src/`) si modifica direttamente qui; i dati del coro stanno in `coro/`.

## Comandi verificati

- `npm ci` — dipendenze, versioni bloccate (Node ≥ 22.12)
- `npm run dev:sito` — server di sviluppo del sito su http://localhost:4321 (in `.claude/launch.json` come `sito`). `npm run dev` invece apre la **demo** del modello (pannello di scelta, tutte le vesti): utile per provare il logo e i dati di HV nelle altre vesti, ma l'area di esempio usa foto del Coro Esempio che qui non ci sono.
- `npm run build` — genera il sito statico in `dist/` (è quello che costruisce Vercel, vedi `vercel.json`); prima lancia `npm run allegati`, che scarica da Drive le immagini allegate agli eventi del calendario (vedi sotto)
- `vercel env pull .env.local --environment=development --yes` — token OIDC di sviluppo (dura qualche ora) e variabili `GCP_*`, per scaricare gli allegati anche in locale
- `gws` (CLI di Google Workspace, globale) — Drive e Calendar dell'associazione con l'account mario.danna@romamusicanta.org; la sua configurazione è in `~/.config/gws-romamusicanta`, indicata da `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` in `.claude/settings.local.json`

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
  - **Concerti**: indirizzo iCal pubblico del calendario Google "Concerti", nella variabile `CALENDARIO_CONCERTI_ICS` (e `CALENDARIO_CONCERTI_ID` per il pulsante "Iscriviti"). Gli eventi futuri sono "in programma"; quelli passati entrano da soli nell'archivio, accanto a quello storico di `coro/concerti.ts` (a parità di giorno vale il file). Convenzione per gli eventi, descritta per esteso in testa a `src/motore/concerti.ts`: titolo = rassegna/evento; luogo = "città, sala" oppure un indirizzo scelto da Google Maps; "Tutto il giorno" = orario da definire; descrizione = prima riga "Autore · Opera" (altre opere sulle righe seguenti), poi righe `Organizza:`, `Ingresso:`, `Organico:`, `Brani:`, `Foto:` (file in `coro/immagini`, per le schede orizzontali), `Locandina:` (file in `coro/immagini`: la locandina ufficiale, mostrata intera nella pagina del concerto al posto di quella generata), `Video:` (ID YouTube), `Evidenza:`; ogni altra etichetta è un interprete (`Soprano: Maria Rossi`, `Solisti: (soprano, contralto…)` = da annunciare). Le immagini **allegate** all'evento con la graffetta (file del Drive condiviso) valgono come locandina se hanno "locandina" nel nome, altrimenti come foto; le righe `Locandina:`/`Foto:` hanno la precedenza. Righe senza etichetta, foto inesistenti ed eventi annullati sono scartati con un avviso `[calendario]`.
  - **Concerti passati nel calendario** (dal 2/10/2026): i concerti di cui c'è la locandina sono eventi passati del calendario, con tutti i dati e la locandina allegata (dal 3/3/2024 al 6/6/2026); `coro/concerti.ts` tiene solo i più vecchi e quelli senza locandina. Se il calendario non risponde, quei concerti mancano dall'archivio fino alla build successiva. Quando il direttore non è il Maestro, l'evento ha la riga `Direttore: …` e la pagina mostra il Maestro come "Maestro del coro".
  - **Pagine dei concerti**: ogni concerto con una data precisa, in programma o passato, ha la sua pagina `/concerti/<data>-<titolo>`; le schede di home e "Altri concerti" e i titoli dell'archivio portano lì. Per un concerto passato niente "Aggiungi al calendario", la registrazione è la sua (`Video:`).
  - **Allegati da Drive**: `scripts/scarica-allegati.mjs`, prima della build, li scarica in `coro/immagini/drive/<id>.<ext>` (ignorata da git); solo JPEG, PNG, WebP e AVIF. Nessuna chiave: la build si presenta a Google con il suo token OIDC (`VERCEL_OIDC_TOKEN`), che la federazione delle identità (pool e provider `vercel` del progetto Google Cloud `harmonia-vocalis-510406`, solo per il progetto Vercel harmonia-vocalis) scambia con un accesso temporaneo dell'account di servizio `sito-harmonia-vocalis`, lettore della sola cartella `Concerti` del Drive condiviso "Harmonia Vocalis". Le variabili `GCP_*` sono su Vercel in produzione, anteprima e sviluppo. Senza credenziali o se Drive non risponde: avviso `[drive]` e la build prosegue.
  - Se una fonte non risponde, il sito usa i dati di `coro/` e lo scrive a console con `[youtube]` / `[calendario]`.
- **Area coristi**: l'accesso con Google è ancora da fare. Intanto il sito genera un'**anteprima** sotto `/area` (`funzioni.anteprimaArea: true`), con la grafica e i colori del sito, i dati di esempio di `src/demo/area.ts`, un avviso "Anteprima" e pagine `noindex`; il collegamento "Area coristi" porta lì. I vecchi indirizzi del mockup (`/mockup/sito/area*.html`) reindirizzano alle pagine corrispondenti di `/area`.
- `CLAUDE.md` è un collegamento simbolico ad `AGENTS.md`.
- **Mockup**: le direzioni visive iniziali, le proposte di logo e il mockup completo "C · Stagione" stavano in `public/mockup/`. Eliminati il 1/10/2026 perché superati: si recuperano dalla storia di git (`git show 7bb332d:public/mockup/…`); gli indirizzi `/mockup/…` reindirizzano alla home, quelli dell'area all'area del sito (`vercel.json`).

Essendo statico, il sito si aggiorna solo quando viene ricostruito: per questo ogni notte l'azione GitHub `.github/workflows/ricostruzione-notturna.yml` (3:30 ora di Roma, 4:30 con l'ora legale; anche a mano da Actions → Run workflow) chiama il deploy hook di Vercel, salvato nel secret `VERCEL_DEPLOY_HOOK` del repository, perché compaiano nuovi concerti e video.

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

- Dominio: `romamusicanta.org` (registrato su Squarespace Domains, ex Google Domains, gestibile dalla console di Workspace; scade il 21/09/2027) punta a Vercel con due record A su `@` e un CNAME su `www`; `www` e `harmonia-vocalis.vercel.app` reindirizzano a `https://romamusicanta.org` (il secondo con una regola `has: host` in `vercel.json`). Nei DNS ci sono anche MX, SPF, DKIM di Workspace e un DMARC `p=none`: non toccarli. `site` in `astro.config.mjs` dà il canonical delle pagine e la sitemap (`@astrojs/sitemap`, senza `/area` e le vesti in prova); `public/robots.txt` la indica. `harmoniavocalis.it` era libero il 1/10/2026: se registrato, va fatto reindirizzare a romamusicanta.org.
- Pubblicazione: progetto Vercel `harmonia-vocalis`, collegato dal 1/10/2026 al repository pubblico https://github.com/romamusicanta/harmonia-vocalis (organizzazione GitHub `romamusicanta`, contatto admin@, verifica in due passaggi obbligatoria): ogni push su `main` va in produzione da solo, gli altri rami diventano anteprime. `vercel deploy --prod` dalla cartella locale funziona ancora, ma non serve più. Dal 1/10/2026 su Vercel ci sono le variabili `CALENDARIO_CONCERTI_ICS`/`_ID` (produzione e anteprima) del calendario pubblico "Concerti" di mario.danna@romamusicanta.org, condiviso con "Fare modifiche e gestire opzioni di condivisione" con il gruppo `admin@` (creato il 1/10/2026 insieme a `info@`) e con francesco.cardillo@: da allora i prossimi concerti vengono da lì e quelli di `coro/concerti.ts` restano di riserva. Nella descrizione degli eventi non serve la riga `Direttore:` per il Maestro: la pagina del concerto lo mostra già.
- Drive condiviso "Harmonia Vocalis" (dal 2/10/2026): `Concerti/<stagione>/<AAAA-MM-GG Luogo – Opera>/` (locandina, foto, registrazioni), `Spartiti/` (per opera, solo per i coristi: niente di pubblico per i diritti degli editori), `Associazione/`. Progetto Google Cloud `harmonia-vocalis-510406` (org romamusicanta.org): client OAuth desktop per `gws` (consenso Interno), account di servizio e federazione per la build. L'organizzazione vieta le chiavi degli account di servizio (`iam.managed.disableServiceAccountKeyCreation`): per questo la federazione OIDC.
- Due immagini identiche byte per byte (per esempio la stessa locandina in `coro/immagini` e su Drive) Astro le pubblica una volta sola, con il nome della prima.

- Le miniature YouTube del canale esistono solo fino a `sddefault` (640×480): `maxresdefault` restituisce 404.
- Il luogo delle prove è discordante tra italiacori (Via del Frantoio 2) e YouTube (Via di Casal Bruciato 15): da confermare prima della pubblicazione.
- Le foto in `coro/immagini/` vengono dalla scheda italiacori: autori e permessi sono da verificare (`CREDITI.md`).
- La sezione "Baritoni e Bassi" dell'organico dà due rese sbagliate: "Baritoni e basso" nel modulo di candidatura e "tenori e baritoni e bassi" negli organizzatori. Da correggere nel motore.
- Gli screenshot del pannello browser integrato risultano neri dopo lo scorrimento; per verifiche visive a pagina intera usare Chrome headless (`--screenshot`), che però ha una larghezza minima di circa 500px.
