// Nel browser: riduce un'immagine prima di inviarla (lato lungo al massimo 2400 px, JPEG), così
// la richiesta resta sotto il limite di 4,5 MB delle funzioni Vercel. Il sito poi ricava da qui
// tutte le misure che gli servono. Le immagini già piccole passano così come sono.
export async function riduci(file: File, lato = 2400, qualita = 0.88): Promise<File> {
  const img = await createImageBitmap(file);
  const scala = Math.min(1, lato / Math.max(img.width, img.height));
  if (scala === 1 && file.size < 1_500_000 && file.type === 'image/jpeg') return file;
  const tela = document.createElement('canvas');
  tela.width = Math.round(img.width * scala);
  tela.height = Math.round(img.height * scala);
  const ctx = tela.getContext('2d')!;
  // Fondo bianco per i PNG trasparenti, che in JPEG diventerebbero neri
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, tela.width, tela.height);
  ctx.drawImage(img, 0, 0, tela.width, tela.height);
  const blob = await new Promise<Blob>((ok, ko) => tela.toBlob((b) => (b ? ok(b) : ko(new Error('immagine non leggibile'))), 'image/jpeg', qualita));
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}
