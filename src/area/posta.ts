// Email spedite dal sito (dal 7/10/2026: i codici di accesso, src/area/codice.ts, e l'avviso di un
// accesso all'Amministrazione). Le manda l'account coro.coristi.mittenteCodici (sito@), a cui
// l'account di servizio scrive con la delega a livello di dominio (console di Workspace → Sicurezza →
// Controlli API → Delega a livello di dominio, solo l'ambito gmail.send). Niente chiavi: l'account di
// servizio firma la richiesta con signJwt (ruolo «Creatore token account di servizio» su se stesso),
// presentandosi con la stessa federazione OIDC del resto del sito (src/area/servizio.ts).
import { GCP_SERVICE_ACCOUNT_EMAIL } from 'astro:env/server';
import { coro } from '../motore/coro';
import { tokenFederato } from './servizio';

export const postaConfigurata = () => Boolean(coro.coristi?.mittenteCodici && GCP_SERVICE_ACCOUNT_EMAIL);

let inCache: { token: string; scade: number } | undefined;

// Il token per spedire a nome del mittente (dura un'ora)
async function tokenPosta() {
  if (inCache && Date.now() < inCache.scade) return inCache.token;
  const ora = Math.floor(Date.now() / 1000);
  const firma = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT_EMAIL}:signJwt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenFederato()}` },
    body: JSON.stringify({
      payload: JSON.stringify({
        iss: GCP_SERVICE_ACCOUNT_EMAIL,
        sub: coro.coristi!.mittenteCodici,
        scope: 'https://www.googleapis.com/auth/gmail.send',
        aud: 'https://oauth2.googleapis.com/token',
        iat: ora,
        exp: ora + 3600,
      }),
    }),
  });
  if (!firma.ok) throw new Error(`firma della richiesta rifiutata (${firma.status}): ${(await firma.text()).slice(0, 200)}`);
  const { signedJwt } = await firma.json();
  const t = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signedJwt }),
  });
  if (!t.ok) throw new Error(`delega per la posta rifiutata (${t.status}): ${(await t.text()).slice(0, 200)}`);
  const { access_token } = await t.json();
  inCache = { token: access_token, scade: Date.now() + 55 * 60 * 1000 };
  return access_token as string;
}

const intestazione = (testo: string) => `=?UTF-8?B?${Buffer.from(testo, 'utf8').toString('base64')}?=`;

// Un'email di solo testo
export async function spedisci(a: string, oggetto: string, testo: string) {
  const messaggio = [
    `From: ${intestazione(coro.nome)} <${coro.coristi!.mittenteCodici}>`,
    `To: ${a}`,
    `Subject: ${intestazione(oggetto)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(testo, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n'),
  ].join('\r\n');
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenPosta()}` },
    body: JSON.stringify({ raw: Buffer.from(messaggio, 'utf8').toString('base64url') }),
  });
  if (!r.ok) throw new Error(`Gmail non ha spedito l’email (${r.status}): ${(await r.text()).slice(0, 200)}`);
}
