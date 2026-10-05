// Icone delle app installabili (PWA, src/pages/app/[app].webmanifest.ts): il diapason del logo, con
// colori diversi per il sito e per ogni area riservata, così sul telefono si distinguono. Si lancia a
// mano (`npm run icone`) quando cambiano i colori del sito, e scrive in public/icone:
// icona[-<area>]-192/512.png (angoli arrotondati), icona-maschera[-<area>]-192/512.png (fondo pieno,
// disegno nella zona sicura, per Android) e apple-touch-icon[-<area>].png (180 px, per iPhone).
import sharp from 'sharp';

const blu = '#0f1b23';
const giallo = '#f2b41b';
const chiaro = '#f5f4f0';

// fondo, diapason, punto
const app = {
  sito: [blu, '#fff', giallo],
  coristi: [giallo, blu, '#fff'],
  maestro: [chiaro, blu, giallo],
  admin: [blu, giallo, '#fff'],
  tesoriere: ['#fff', blu, giallo],
};

// Il diapason di public/favicon.svg, in un riquadro di 64
const diapason = (tratto, punto) =>
  `<g fill="none" stroke="${tratto}" stroke-width="5.5"><path d="M7 21H25a11 11 0 0 1 0 22H7"/><path d="M36 32H46"/></g><circle cx="51.5" cy="32" r="5.5" fill="${punto}"/>`;

const svg = ([fondo, tratto, punto], { arrotondata = false, scala = 1 } = {}) => {
  const s = scala, d = (64 - 64 * s) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" ${arrotondata ? 'rx="12"' : ''} fill="${fondo}"/><g transform="translate(${d} ${d}) scale(${s})">${diapason(tratto, punto)}</g></svg>`);
};

const scrivi = (sorgente, lato, file) => sharp(sorgente, { density: 72 * (lato / 64) * 2 }).resize(lato, lato).png().toFile(`public/icone/${file}`);

for (const [nome, colori] of Object.entries(app)) {
  const suff = nome === 'sito' ? '' : `-${nome}`;
  for (const lato of [192, 512]) {
    await scrivi(svg(colori, { arrotondata: true }), lato, `icona${suff}-${lato}.png`);
    await scrivi(svg(colori, { scala: 0.72 }), lato, `icona-maschera${suff}-${lato}.png`);
  }
  await scrivi(svg(colori, { scala: 0.86 }), 180, `apple-touch-icon${suff}.png`);
}
console.log('Icone scritte in public/icone');
