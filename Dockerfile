# syntax=docker/dockerfile:1

# Install dependencies in a dedicated stage so app source changes do not
# invalidate the dependency cache.
FROM node:24.18.0-alpine AS deps
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --loglevel=error

# Build with the same Alpine runtime family used by the final image. Prisma is
# generated here so the production image always contains a matching client.
FROM node:24.18.0-alpine AS builder
WORKDIR /app
ENV DATABASE_URL=file:/app/data/seddleup.db
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev --no-audit --no-fund --loglevel=error

# Runtime image: non-root user, production env, persisted SQLite path, and a
# startup entrypoint that validates config and applies migrations.
FROM node:24.18.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV SEDDLEUP_DOCKER=1
ENV DATABASE_URL=file:/app/data/seddleup.db
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apk add --no-cache openssl \
  && addgroup -S nodejs \
  && adduser -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /app/data \
  && chown -R nextjs:nodejs /app/data \
  && chmod +x /app/docker-entrypoint.sh \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0"]
