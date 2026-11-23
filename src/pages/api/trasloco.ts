// TEMPORANEO (23/11/2026, trasloco sulla VPS di OVH): restituisce cifrate le variabili d'ambiente di
// produzione, che Vercel non mostra, perché la VPS le decifri direttamente nel suo app.env. Cifrate
// con TRASLOCO_KEY (32 byte in esadecimale, solo su Vercel e sulla VPS); senza la chiave giusta
// risponde 404. Da togliere subito dopo il trasloco, insieme a TRASLOCO_KEY.
import type { APIRoute } from 'astro';
import { createCipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const prerender = false;

const NOMI = [
  'CALENDARIO_CONCERTI_ICS', 'CALENDARIO_CONCERTI_ID', 'CALENDARIO_PROVE_ID', 'CORISTI_CLIENT_ID', 'CORISTI_CLIENT_SECRET',
  'DRIVE_CARTELLA_CONCERTI', 'DRIVE_CARTELLA_FOTO', 'DRIVE_CARTELLA_FOTO_CONCERTI', 'DRIVE_CARTELLA_REGISTRAZIONI',
  'DRIVE_CARTELLA_SPARTITI', 'DRIVE_REPOSITORY', 'FOGLIO_CORISTI_ID', 'FOGLIO_TESORERIA_ID', 'GCP_PROJECT_NUMBER',
  'GCP_SERVICE_ACCOUNT_EMAIL', 'GCP_WORKLOAD_IDENTITY_POOL_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'SESSIONE_SEGRETO', 'VAPID_PRIVATE_KEY', 'VAPID_PUBLIC_KEY',
];

export const GET: APIRoute = async ({ request }) => {
  const chiave = process.env.TRASLOCO_KEY ?? '';
  const atteso = createHash('sha256').update(chiave).digest();
  const dato = createHash('sha256').update(request.headers.get('x-trasloco') ?? '').digest();
  if (!/^[0-9a-f]{64}$/.test(chiave) || !timingSafeEqual(atteso, dato)) return new Response('Not found', { status: 404 });
  const iv = randomBytes(16);
  const c = createCipheriv('aes-256-cbc', Buffer.from(chiave, 'hex'), iv);
  const testo = JSON.stringify(Object.fromEntries(NOMI.map((n) => [n, process.env[n] ?? null])));
  const dati = Buffer.concat([c.update(testo, 'utf8'), c.final()]);
  return new Response(`${iv.toString('hex')}\n${dati.toString('base64')}\n`, { headers: { 'cache-control': 'no-store' } });
};
