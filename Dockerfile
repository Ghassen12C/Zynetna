# ─────────────────────────────────────────────────────────────────────────────
#  Zynetna — production image
#  Multi-stage: deps → build → runtime. The runtime stage carries no compiler,
#  no dev dependencies and no source, and runs as a non-root user.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS deps
WORKDIR /app
# sharp needs these to resolve its platform binary on musl.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci


FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# These are build-time placeholders: the real values are injected at runtime.
# The schema validator must pass for the build to emit pages.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV SESSION_SECRET="build-time-placeholder-secret-at-least-32-chars"
RUN npx prisma generate && npm run build
# The production seed, compiled to one file so the runtime image needs neither
# tsx nor the TypeScript sources.
RUN npx esbuild prisma/seed-production.ts --bundle --platform=node --format=esm \
      --conditions=react-server --external:@prisma/client --external:@node-rs/argon2 \
      --outfile=dist/seed-production.mjs


# The Prisma CLI with its full dependency tree, isolated from the app's
# node_modules, so `migrate deploy` can run inside the runtime image.
FROM node:22-alpine AS migrator
WORKDIR /migrator
RUN apk add --no-cache libc6-compat
COPY package.json /tmp/app-package.json
RUN echo '{"private":true}' > package.json \
 && npm install --omit=dev --no-audit --no-fund \
      "prisma@$(node -p "require('/tmp/app-package.json').devDependencies.prisma")"


FROM node:22-alpine AS runtime
WORKDIR /app
# The commit this image was built from, reported by /api/health.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Run unprivileged.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# The schema and migrations, the generated client, the migration CLI and the
# compiled production seed: everything scripts/start.sh runs before the server.
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=migrator --chown=nextjs:nodejs /migrator/node_modules ./migrator/node_modules
COPY --from=build --chown=nextjs:nodejs /app/dist ./dist
COPY --chown=nextjs:nodejs scripts/start.sh ./start.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["/bin/sh", "/app/start.sh"]
