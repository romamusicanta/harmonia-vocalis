# Dimora Choir

Prodotto di Mario D'Anna: un **modello di sito per cori** da cui generare e vendere siti a cori diversi. Fa parte della famiglia "Dimora" (DimoraSuite, Dimora Tools). Nasce dalla generalizzazione del sito del Coro Harmonia Vocalis (`~/projects/harmonia-vocalis`), che ne è il riferimento per funzioni e grafica e diventerà il primo sito generato dal modello.

Stato (30/09/2026): **passi 1 e 2 dell'ordine di lavoro fatti**: modello Astro con il coro di fantasia, pannello di scelta della demo e cinque vesti pronte (A · Palco al buio, B · Il segno, C · Stagione, D · Classica, E · Calda). Le decisioni sotto vengono dalla sessione di progettazione nel repository harmonia-vocalis.

## Comandi verificati

- `npm install` — dipendenze, versioni bloccate (Node ≥ 22.12)
- `npm run dev` — server di sviluppo **in modalità demo** (`DEMO=1`) su http://localhost:4321 (in `.claude/launch.json` come `demo`, con porta automatica)
- `npm run build:demo` — build della demo in `dist/` (pannello, area coristi di esempio, vesti alternative)
- `npm run build` — build del sito di un coro, senza demo

## Modello di business (deciso)

- **Un sito separato per ogni coro**, NON multitenant (a differenza di DimoraSuite). Ogni coro riceve la propria copia, sul proprio account GitHub, e può avere specificità proprie.
- Il coro è responsabile di hosting, dominio/DNS, account dei servizi. Può usare piani gratuiti (Vercel Hobby, Netlify, Cloudflare Pages) perché l'account è intestato a lui, associazione no-profit.
- Dopo la vendita Mario interviene **solo per correggere bug**. Da chiarire nel contratto: gli aggiornamenti (nuove versioni di Astro, servizi esterni che cambiano) non sono bug; i bug nelle parti personalizzate di un sito si correggono solo su quel sito.
- Il marchio compare nei siti dei cori solo come firma discreta nel piè di pagina ("Realizzato con Dimora Choir").
- Domini liberi al 30/09/2026: `dimorachoir.com`, `dimorachoir.it`, `dimoracoro.it` (da registrare).

## Architettura

Astro 7, output statico, nessun framework client. I dati che cambiano si leggono **in fase di build**: prossimi concerti dal calendario Google "Concerti" (iCal pubblico), video dal feed RSS di YouTube; se mancano o non rispondono si usano i dati locali di `coro/` e la build lo scrive a console con `[calendario]` / `[youtube]`. Serve una ricostruzione periodica (deploy hook + cron).

**Separazione "motore" / "coro"**: tutto ciò che distingue un coro sta in `coro/`, il resto è motore comune.

- `coro/coro.config.ts` — dati del coro, aspetto (`veste`, `palette`, `carattere`) e funzioni attive (`ascolta`, `cantaConNoi`, `organizzatori`, `areaCoristi`). Validato all'avvio della build con lo schema zod in `src/motore/schema.ts`: un campo sbagliato ferma la build dicendo quale.
- `coro/concerti.ts` (prossimi di riserva + archivio curato a mano), `coro/video.ts` (ID del canale, video in evidenza, elenco di riserva con autore per il raggruppamento), `coro/testi/*.md` (testi lunghi: frontmatter YAML + corpo Markdown, letti con `testo(nome)`), `coro/immagini/` (foto, indicate per nome di file; `Foto.astro` ridimensiona le foto vere e lascia passare gli SVG).
- `src/motore/` — accesso ai dati (`coro.ts`, `concerti.ts`, `video.ts`, `testi.ts`), indirizzi (`url.ts`), menu (`navigazione.ts`), catalogo di vesti/palette/caratteri (`aspetto.ts`), JS lato browser comune (`interazioni.ts`).
- `src/stile/` — palette (`data-palette` su `<html>`) e set di caratteri (`data-carattere`), comuni a tutte le vesti. Variabili: `--primario` (scuro, testo bianco sopra), `--primario-2/-3/-chiaro`, `--accento` (chiaro), `--accento-chiaro`, `--fondo`, `--testo`, `--tenue`, `--linea`, `--f-titoli`, `--f-testo`, `--peso-titoli`.
- `src/vesti/<veste>/` — una cartella per veste. **Stagione è la base**: il suo `stile.css` e le sue classi sono il vocabolario comune, e le **pagine** in `src/pages/[...veste]/` usano quelle classi. Ogni altra veste carica `stagione/stile.css` e sopra il proprio `stile.css` (con `?url`, così una pagina carica solo le sue vesti), e può ridefinire i componenti dei punti chiave (Testata, Piede, TestataArea, PiedeArea, Home, SchedaConcerto) con un file omonimo; quelli che mancano vengono da Stagione. Il registro `src/vesti/index.ts` si costruisce da solo con `import.meta.glob`: una veste è pronta quando la sua cartella ha `stile.css`.
- Ogni pagina esporta `getStaticPaths = percorsiVesti` e costruisce i link con `link(veste, '/percorso')`. Il sito di un coro ha una sola veste, servita dalla radice; nella demo ogni altra veste pronta ha una copia delle pagine sotto `/<veste>/`, così il pannello cambia veste restando sulla stessa pagina.
- **Modalità demo** (`DEMO=1`): pannello di scelta (`src/demo/Pannello.astro`; palette e carattere scelti restano in localStorage e si possono condividere con `?palette=…&carattere=…`), tutti i caratteri caricati, area coristi aperta con i dati di esempio di `src/demo/area.ts`, moduli e download finti (`form[data-finto]`, `data-finto-avviso`), video finti (ID `demo-…`, miniatura locale, al clic un avviso). Senza demo l'area coristi per ora **non viene generata** (l'accesso Google è da fare) e i moduli sono nascosti (manca il servizio di invio).
- Il coro di fantasia della demo vive nel `coro/` del modello stesso. Le sue foto sono di Unsplash (licenza libera, crediti in `coro/immagini/CREDITI.md`) e ritraggono altri cori, non quello inventato: niente volti riconoscibili per le persone inventate (la foto del Maestro è di spalle).

Da fare (proposto, non ancora iniziato): aggiornamento delle copie dei cori con un remote git `modello` + merge, tag di versione e file `VERSIONE` in ogni sito; **generatore** `npm run nuovo-coro` che fa qualche domanda, scrive `coro/` e spegne le funzioni non attive; **guida di consegna** per il coro (account, dominio, calendario, fogli, ricostruzione giornaliera).

## Demo di vendita (primo obiettivo)

- Il modello stesso in **modalità demo**, NON un altro mockup in HTML statico. Usa un **coro di fantasia** ("Coro Esempio") con dati inventati ma realistici, mai i dati di Harmonia Vocalis.
- Mostra tutte le funzioni di Harmonia Vocalis: pagine pubbliche + area coristi dimostrativa + pagine di amministrazione.
- Ha un **pannello di scelta** (sul modello di `public/mockup/sito/prova.js` in harmonia-vocalis) con tre selettori: **veste grafica**, **palette**, **carattere**.
- **Almeno 5 vesti grafiche** che cambiano la struttura, non solo i colori: testata, home, schede concerto, piè di pagina, ritmo e spazi. Stessi dati e pagine per tutte; ogni veste ha i propri componenti nei punti chiave e 3–4 abbinamenti palette/carattere consigliati. Punti di partenza:
  - C · Stagione: già completa in harmonia-vocalis `public/mockup/sito/`, con palette "Porpora di Roma" e Manrope;
  - A · Palco al buio e B · Il segno: in harmonia-vocalis `public/mockup/`;
  - da creare: una **classica/elegante** (serif, centrata, musica sacra e antica) e una **calda/fotografica** (foto grandi, angoli morbidi, cori amatoriali, parrocchiali, giovanili).
- Ordine di lavoro concordato:
  1. modello con coro di fantasia e veste C + pannello;
  2. le altre 4 vesti;
  3. amministrazione dei contenuti pubblici;
  4. Harmonia Vocalis generato dal modello.

## Servizi Google: due configurazioni, stesso codice (deciso)

Google Workspace **non è un requisito**, così anche un coro che non ha nulla può comprare il prodotto. Scartata la variante senza Google (database proprio da consegnare al coro).

- **Base, Gmail gratuito del coro**:
  - accesso all'area coristi con "Accedi con Google" (qualsiasi account) + **elenco di indirizzi autorizzati** in un foglio;
  - il sito accede a Drive e Fogli con **OAuth dell'account del coro** (refresh token): attenzione a pubblicare l'app OAuth, altrimenti i token scadono dopo 7 giorni;
  - gli account di servizio non possono caricare su un Drive personale;
  - spazio: 15 GB, eventualmente Google One 100 GB (circa 2 €/mese);
  - email sul dominio tramite il registrar (casella o inoltro), avvisi con Google Gruppi o Brevo/Resend;
  - rischio: account personale, serve una procedura di passaggio delle credenziali tra direttivi.
- **Consigliata, Workspace**:
  - gratuito per le associazioni idonee (Workspace for Nonprofits, verifica Goodstack). Si può partire da Business Starter (6,80 €/utente/mese) e poi chiedere la conversione, solo se acquistato direttamente da Google;
  - accesso per dominio, **account di servizio + Drive condivisi**;
  - servono solo 1–3 account (direttivo/segreteria): i coristi possono entrare con account personali ed elenco.
- Contenuti **pubblici** (testi, foto, concerti, archivio): **CMS basato su git** (es. Keystatic, integrato con Astro; oppure Sveltia/Decap), nessun database. Non adatto a file grandi.
- Contenuti **riservati** (spartiti, registrazioni delle prove, presenze, avvisi, convocazioni): Drive e Fogli del coro, caricati dalle pagine di amministrazione del sito, così i file appartengono all'account del coro.

## Privacy

Il coro è titolare dei dati, tenuti sui propri account. Mario vi accede solo occasionalmente per le correzioni: prevedere una clausola nel contratto e un'informativa privacy di esempio da consegnare. Nel sito pubblico niente elenchi nominativi dei coristi, solo direttivo e Maestro (convenzione ereditata da harmonia-vocalis).

## Convenzioni

- Codice, nomi e testi in italiano, come harmonia-vocalis.
- Commit: repository nuovo, italiano discorsivo.
- Video incorporati solo con miniatura + `youtube-nocookie.com` al clic (componente `src/componenti/Video.astro`, nato da `VideoLite` di harmonia-vocalis).
- Icone solo con `<Icona nome="…" />` (catalogo in `src/componenti/Icona.astro`), mai SVG incollati nelle pagine.
- Nessun dato del coro scritto nelle pagine o nelle vesti: tutto passa da `coro/`. Nei blocchi di dati un commento `{/* Dati: … */}` dice da quale fonte arrivano.
- Dipendenze a versione esatta (niente `^`), perché ogni coro ha la sua copia e deve restare riproducibile.
- La firma "Realizzato con Dimora Choir" è testo semplice finché il dominio non è registrato.

## Pubblicazione della demo

- Repository privato `mdanna/dimorachoir` su GitHub, collegato al progetto Vercel `dimorachoir` (account mdanna): ogni push su `main` ripubblica.
- Indirizzo da condividere: https://dimorachoir.vercel.app (pubblico). `vercel.json` fa costruire la demo (`npm run build:demo`).

## Workflow

1. Modifiche al motore o alle vesti: `npm run dev` e controllo delle pagine toccate, anche a 375px e con più palette/caratteri dal pannello.
2. `npm run build:demo` e `npm run build`: devono passare entrambe (la seconda verifica che senza demo non restino pagine o bottoni finti).
3. Una nuova veste: aggiungerla con nome, descrizione e abbinamenti a `VESTI` in `src/motore/aspetto.ts`, poi creare `src/vesti/<veste>/stile.css` e i componenti che cambiano. Controllarla con tutte le palette e tutti i caratteri, e anche nelle pagine comuni e nell'area coristi, che prendono l'aspetto solo dal CSS.

## Trappole note

- Le pagine comuni hanno ancora parecchi stili in linea (colori `var(--primario)`, `background:var(--fondo)`, dimensioni dei titoli…): le vesti A, B, D, E li correggono con selettori `[style*="…"]` e `!important`. **Da fare**: spostare quegli stili in classi nelle pagine e aggiornare i CSS delle vesti; finché non è fatto, cambiare uno stile in linea può rompere una veste. Lo stesso vale per il diapason (`.diap`) fisso nella locandina di `concerti/[slug].astro`.
- Il registro delle vesti carica i componenti di tutte le cartelle: un errore in una veste ferma la build di tutte.

- Nei componenti Astro un commento HTML `<!-- … -->` dentro un'espressione `{cond && (…)}` rompe la compilazione: dentro le espressioni usare `{/* … */}`.
- **Le date della demo invecchiano**: i concerti di `coro/concerti.ts` e i dati di `src/demo/area.ts` (ancorati a `OGGI = '2026-09-30'`) sono fissi, mentre `prossimiConcerti()` filtra sulla data vera. Ricostruita dopo il 18/10/2026 la demo perde il Requiem e la convocazione; dopo marzo 2027 non ha più concerti in programma. Prima di usarla per vendere, spostare le date (o renderle relative alla data di build).
- Senza demo l'area coristi non viene generata: i link verso `/area` passano dalla costante `AREA_CORISTI` di `src/motore/coro.ts`, non da `coro.funzioni.areaCoristi`.
- Il server di sviluppo usa `PORT` se assegnata (pannello browser, porta automatica), altrimenti 4321: la 4321 è spesso occupata dal server di harmonia-vocalis.

- Le miniature YouTube esistono solo fino a `sddefault`: `maxresdefault` restituisce 404.
- Gli screenshot del pannello browser integrato risultano neri dopo lo scorrimento. Per le pagine intere usare Chrome headless (`--screenshot`), che però ha una larghezza minima di circa 500px.
