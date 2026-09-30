# Coro Harmonia Vocalis — sito pubblico

Sito statico del Coro Harmonia Vocalis (Associazione Culturale Musicale Roma Musicanta), destinato a `romamusicanta.org`.
L'associazione usa Google Workspace for Nonprofits (edizione gratuita) sul dominio `romamusicanta.org`.

## Comandi verificati

- `npm install` — dipendenze (Node ≥ 22.12)
- `npm run dev` — server di sviluppo su http://localhost:4321 (in `.claude/launch.json` come `sito`)
- `npm run build` — genera il sito statico in `dist/`
- `npm run preview` — serve `dist/` in locale
- `npm run aggiorna-video` — rigenera `src/data/video.json` dal feed YouTube

## Architettura

Astro 7, output statico, nessun framework client. I contenuti che cambiano stanno in servizi Google e vengono letti **in fase di build**:

- **Video** — `src/lib/youtube.ts` legge il feed RSS pubblico del canale `@romamusicanta` (ultimi 15 video, nessuna chiave API). Se il feed non risponde usa l'istantanea `src/data/video.json`.
- **Prossimi concerti** — `src/lib/concerti.ts` legge l'indirizzo iCal pubblico del calendario Google "Concerti" (variabile `CALENDARIO_CONCERTI_ICS`). Senza variabile, o se il calendario non risponde, usa `prossimiConcerti` in `src/data/concerti.ts`. Convenzione per gli eventi: titolo = rassegna/evento, luogo = città e sala, prima riga della descrizione = programma, righe successive = note.
- **Archivio programmi** — curato a mano in `src/data/concerti.ts` (`archivio`), con gli ID dei video YouTube.
- **Dati del coro** — `src/config.ts` (email, prove, direttivo, organico, link, Area coristi).
- **Area coristi** — è un Google Site riservato al dominio, esterno a questo progetto: il sito ha solo il link.

Pagine in `src/pages/`: home, il-coro, il-maestro, concerti, ascolta, canta-con-noi, contatti. Layout unico `src/layouts/Base.astro`, stili globali e token colore in `src/styles/global.css` (tema chiaro/scuro con `prefers-color-scheme`).

**Mockup** (`public/mockup/`, HTML statico servito così com'è, fuori da Astro): le tre direzioni visive iniziali, le proposte di logo (`logo/`) e il **mockup completo nella direzione scelta, "C · Stagione", con il logo 3 "Diapason orizzontale" e la palette "Porpora di Roma" su avorio** in `sito/` (pagine pubbliche + area coristi, CSS/JS condivisi in `sito/stile.css` e `sito/stile.js`; i colori sono tutti variabili in `:root` di `stile.css`, anche quelli del logo; `sito/palette.html` è la home con il selettore delle palette alternative). Nel mockup l'area coristi è aperta a tutti con dati di esempio e un avviso; i commenti `<!-- Dati: … -->` indicano da quale servizio Google arriverà ogni blocco. È il riferimento per portare grafica e funzioni nelle pagine Astro.

Essendo statico, il sito si aggiorna solo quando viene ricostruito: in produzione serve una ricostruzione periodica (es. giornaliera, tramite deploy hook dell'hosting) perché compaiano nuovi concerti e video.

## Convenzioni

- Codice, nomi e testi in italiano (variabili comprese: `concerti`, `prossimo`, `luogo`…).
- I dati incerti sono marcati con commento `DA VERIFICARE`: non presentarli come certi e non inventarne di nuovi (date, luoghi, biografie).
- Video incorporati solo tramite `VideoLite` (miniatura + `youtube-nocookie.com` al clic), per non caricare cookie di terze parti.
- Niente elenchi nominativi dei coristi nel sito pubblico (privacy): solo direttivo e Maestro.
- Commit: repo nuovo, italiano discorsivo.

## Workflow

1. Aggiornare dati in `src/config.ts` / `src/data/concerti.ts`, oppure direttamente nel calendario Google e su YouTube.
2. `npm run build` per verificare che la build passi.
3. Controllo visivo con `npm run dev`, anche a larghezza mobile (375px).

## Trappole note

- La build fa richieste di rete (YouTube, calendario): se falliscono non si rompe, ma usa i dati di riserva e lo scrive a console con `[youtube]` / `[calendario]`.
- Le miniature YouTube del canale esistono solo fino a `sddefault` (640×480): `maxresdefault` restituisce 404.
- Il luogo delle prove è discordante tra italiacori (Via del Frantoio 2) e YouTube (Via di Casal Bruciato 15): da confermare prima della pubblicazione.
- Gli screenshot del pannello browser integrato risultano neri dopo lo scorrimento; per verifiche visive a pagina intera usare Chrome headless (`--screenshot`), che però ha una larghezza minima di circa 500px.
