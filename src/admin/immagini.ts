// Nel browser: riduce un'immagine prima di inviarla (lato lungo al massimo 2400 px, JPEG), così
// la richiesta resta sotto il limite di 4,5 MB delle funzioni Vercel. Il sito poi ricava da qui
// tutte le misure che gli servono. Le immagini già piccole passano così come sono.
// La foto si legge prima con createImageBitmap e, se non riesce, con un <img> (Safari legge così le
// foto HEIC dell'iPhone); ogni tentativo ha un tempo massimo, perché con alcuni formati certi browser
// non rispondono né con l'immagine né con un errore e il caricamento resterebbe fermo per sempre.
const ATTESA = 12_000;

function entro<T>(p: Promise<T>, ms = ATTESA): Promise<T> {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error('immagine non leggibile in tempo')), ms);
    p.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); ko(e); });
  });
}

function conImg(file: File): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error('immagine non leggibile'));
    img.src = url;
  });
}

async function leggi(file: File): Promise<{ disegno: CanvasImageSource; larghezza: number; altezza: number }> {
  try {
    const b = await entro(createImageBitmap(file));
    return { disegno: b, larghezza: b.width, altezza: b.height };
  } catch {
    const i = await entro(conImg(file));
    return { disegno: i, larghezza: i.naturalWidth, altezza: i.naturalHeight };
  }
}

export async function riduci(file: File, lato = 2400, qualita = 0.88): Promise<File> {
  const { disegno, larghezza, altezza } = await leggi(file);
  if (!larghezza || !altezza) throw new Error('immagine non leggibile');
  const scala = Math.min(1, lato / Math.max(larghezza, altezza));
  if (scala === 1 && file.size < 1_500_000 && file.type === 'image/jpeg') return file;
  const tela = document.createElement('canvas');
  tela.width = Math.round(larghezza * scala);
  tela.height = Math.round(altezza * scala);
  const ctx = tela.getContext('2d')!;
  // Fondo bianco per i PNG trasparenti, che in JPEG diventerebbero neri
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, tela.width, tela.height);
  ctx.drawImage(disegno, 0, 0, tela.width, tela.height);
  const blob = await entro(new Promise<Blob>((ok, ko) => tela.toBlob((b) => (b ? ok(b) : ko(new Error('immagine non leggibile'))), 'image/jpeg', qualita)));
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}
