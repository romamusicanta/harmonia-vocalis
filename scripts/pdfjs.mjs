// Prima della build e del server di sviluppo: copia in public/pdfjs i file che PDF.js carica da sé
// mentre apre un PDF nel visore dell'app (src/area/VisoreFile.astro): i moduli WebAssembly che
// decodificano le scansioni JBIG2 e JPEG 2000 (senza, le pagine di quegli spartiti restano bianche:
// «JBig2 failed to initialize»), le CMap, i caratteri standard e i profili ICC. Vengono dal pacchetto
// pdfjs-dist, così restano della sua stessa versione; public/pdfjs è ignorata da git.
import { cpSync, rmSync } from 'node:fs';

const da = 'node_modules/pdfjs-dist';
const a = 'public/pdfjs';
rmSync(a, { recursive: true, force: true });
for (const cartella of ['wasm', 'cmaps', 'standard_fonts', 'iccs']) cpSync(`${da}/${cartella}`, `${a}/${cartella}`, { recursive: true });
console.log('[pdfjs] file di PDF.js copiati in public/pdfjs');
