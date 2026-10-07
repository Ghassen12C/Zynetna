#!/bin/sh
# Container entrypoint.
#
# 1. Apply pending database migrations. `migrate deploy` only runs migrations
#    that are not yet recorded, never resets, and is a no-op when the schema is
#    current, so it is safe on every start. If it fails, the container exits
#    and the platform keeps the previous revision serving instead of booting
#    code against a schema it does not match.
# 2. With SEED_ON_START=true, add the production reference data and the first
#    admin (idempotent; see prisma/seed-production.ts). Remove the variable and
#    the ADMIN_* secrets once the first start has succeeded.
# 3. Hand the process over to the Next.js server.
set -e

node /app/migrator/node_modules/prisma/build/index.js migrate deploy --schema /app/prisma/schema.prisma

if [ "$SEED_ON_START" = "true" ]; then
  node /app/dist/seed-production.mjs
fi

exec node /app/server.js
