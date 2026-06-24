# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/content-importers/package.json packages/content-importers/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/japanese/package.json packages/japanese/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/srs/package.json packages/srs/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci

FROM deps AS builder
COPY . .
RUN npm run db:generate
RUN npm run build --workspace @kanji-srs/api

FROM deps AS migrator
COPY . .
RUN npm run db:generate
ENV NODE_ENV=production
CMD ["npm", "run", "db:migrate:deploy"]

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3001
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/content-importers/package.json packages/content-importers/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/japanese/package.json packages/japanese/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/srs/package.json packages/srs/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/apps/api/dist ./dist
RUN rm -rf node_modules/@kanji-srs \
  && mkdir -p node_modules/@kanji-srs/db node_modules/@kanji-srs/japanese node_modules/@kanji-srs/shared node_modules/@kanji-srs/srs \
  && printf '%s\n' '{"name":"@kanji-srs/db","main":"../../../dist/packages/db/src/index.js"}' > node_modules/@kanji-srs/db/package.json \
  && printf '%s\n' '{"name":"@kanji-srs/japanese","main":"../../../dist/packages/japanese/src/index.js"}' > node_modules/@kanji-srs/japanese/package.json \
  && printf '%s\n' '{"name":"@kanji-srs/shared","main":"../../../dist/packages/shared/src/index.js"}' > node_modules/@kanji-srs/shared/package.json \
  && printf '%s\n' '{"name":"@kanji-srs/srs","main":"../../../dist/packages/srs/src/index.js"}' > node_modules/@kanji-srs/srs/package.json \
  && chown -R node:node /app
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3001/health').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/apps/api/src/main.js"]
