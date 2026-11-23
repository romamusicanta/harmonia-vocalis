# syntax=docker/dockerfile:1
# Immagine del sito per la VPS web di OVH (Strasburgo): la builda deploy-app sulla VPS a ogni push su
# main, ogni notte e a ogni «Pubblica ora» dell'Amministrazione (vedi deploy/ e AGENTS.md, "Hosting").
#
# La build ha bisogno dei segreti: legge da Google calendario, Drive e fogli e traduce con Claude.
# deploy-app passa app.env come segreto di BuildKit (id app.env): si legge solo durante il RUN della
# build e non resta in nessuno strato dell'immagine. Nell'immagine restano le pagine costruite, le
# foto scaricate da Drive (pubbliche) e la cartella coro/, che il server rilegge (concerti.ics).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Le traduzioni inglesi già fatte (src/motore/inglese.ts) e le immagini ottimizzate da Astro restano
# tra una build e l'altra in una cache di BuildKit, come la cache di build di Vercel
RUN --mount=type=secret,id=app.env,required=true \
    --mount=type=cache,id=harmonia-vocalis-hv,target=/app/node_modules/.cache/hv \
    --mount=type=cache,id=harmonia-vocalis-astro,target=/app/node_modules/.astro \
    sh -c 'set -a && . /run/secrets/app.env && set +a && npm run build && mkdir -p /app/traduzioni && cp -a node_modules/.cache/hv/. /app/traduzioni/' \
 && npm prune --omit=dev --no-audit --no-fund

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/traduzioni ./node_modules/.cache/hv
COPY --from=build /app/dist ./dist
COPY --from=build /app/coro ./coro
USER node
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
