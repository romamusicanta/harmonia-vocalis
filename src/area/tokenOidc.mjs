// Il token con cui il sito si presenta a Google (dal 23/11/2026, sulla VPS di OVH; prima era il token
// OIDC di Vercel). È un JWT firmato da noi con una chiave RSA che non lascia il server:
// - chiave privata in OIDC_CHIAVE (PEM in base64, una riga) e il suo nome in OIDC_KID;
// - la chiave pubblica (JWKS) è caricata nel provider `web-vps` della federazione delle identità del
//   progetto Google Cloud (pool `vercel`, il nome è rimasto quello di prima), che accetta i token
//   con emittente EMITTENTE e soggetto SOGGETTO e li scambia con l'accesso dell'account di servizio.
// Ci sono due chiavi nel JWKS: quella della VPS e quella del Mac di Mario (per `npm run dev:sito`
// con i dati veri), stesso soggetto. Per revocarne una: togliere la sua chiave dal JWKS del provider.
// File .mjs perché lo usa anche lo script della build (scripts/scarica-allegati.mjs).
import { createPrivateKey, createSign } from 'node:crypto';

export const EMITTENTE = 'https://romamusicanta.org/oidc';
export const SOGGETTO = 'harmonia-vocalis';

/** @param {string} audience il provider della federazione, //iam.googleapis.com/projects/… */
export function tokenOidc(audience) {
  const { OIDC_CHIAVE, OIDC_KID } = process.env;
  if (!OIDC_CHIAVE || !OIDC_KID) throw new Error('mancano OIDC_CHIAVE e OIDC_KID');
  const parte = (/** @type {object} */ o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const ora = Math.floor(Date.now() / 1000);
  const dati = `${parte({ alg: 'RS256', typ: 'JWT', kid: OIDC_KID })}.${parte({ iss: EMITTENTE, sub: SOGGETTO, aud: audience, iat: ora, exp: ora + 600 })}`;
  const chiave = createPrivateKey(Buffer.from(OIDC_CHIAVE, 'base64').toString('utf8'));
  return `${dati}.${createSign('RSA-SHA256').update(dati).sign(chiave, 'base64url')}`;
}

/** Il provider della federazione, dalle variabili GCP_* */
export function audienceGoogle() {
  const { GCP_PROJECT_NUMBER, GCP_WORKLOAD_IDENTITY_POOL_ID, GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID } = process.env;
  return `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`;
}
