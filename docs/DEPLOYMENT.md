# Deploying Zynetna to Azure

## Target architecture

```
Azure Front Door ──▶ Container Apps (Next.js standalone, 2+ replicas)
                         ├── PostgreSQL Flexible Server   data
                         ├── Blob Storage (+ CDN)         media
                         ├── Key Vault                    secrets, via managed identity
                         ├── Application Insights         traces, metrics, latency
                         └── Container Apps Job (cron)    subscriptions, reminders
```

## 1. Database

PostgreSQL Flexible Server, version 16 or later.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- required: exclusion constraints
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- required: fuzzy search
CREATE EXTENSION IF NOT EXISTS citext;      -- required: case-insensitive email
```

`btree_gist` is not optional. The double-booking guarantee is an exclusion
constraint, and the schema will not apply without it.

Enable **Allow Azure services** or place the server on the Container Apps
VNet. Require SSL and append `?sslmode=require` to `DATABASE_URL`.

## 2. Storage

Create a Blob container (default name `zynetna-media`) with **blob**-level
public read — objects are public images, the container listing is not.

```
STORAGE_DRIVER=azure
AZURE_STORAGE_CONNECTION_STRING=<from Key Vault>
AZURE_STORAGE_CONTAINER=zynetna-media
```

Install `@azure/storage-blob` in the production image; the driver refuses to
start without it rather than silently dropping uploads.

Put CDN in front of the container. Objects are content-addressed, so they are
served `immutable` with a one-year max-age.

## 3. Secrets

Every secret lives in Key Vault and is referenced by the Container App through
a managed identity. Nothing is baked into the image.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | with `?sslmode=require` |
| `SESSION_SECRET` | `openssl rand -base64 48`; rotating it signs everyone out |
| `JOB_TOKEN` | bearer token for the job endpoints |
| `AZURE_STORAGE_CONNECTION_STRING` | |
| `APP_URL` | the public origin, e.g. `https://zynetna.tn` |

`src/lib/env.ts` validates all of these at boot. A missing or placeholder
secret stops the process — it never degrades into an insecure default.

## 4. Container App

```bash
az containerapp create \
  --name zynetna \
  --resource-group zynetna-rg \
  --environment zynetna-env \
  --image <registry>.azurecr.io/zynetna:<sha> \
  --target-port 3000 \
  --ingress external \
  --min-replicas 2 \
  --max-replicas 10 \
  --cpu 1 --memory 2Gi \
  --user-assigned <identity-id>
```

Two replicas minimum: rate limiting and session revocation are already
cross-replica safe, and a single replica makes every deployment a brief outage.

Probes:

- **Liveness / readiness:** `GET /api/health`, which checks the database and
  the storage driver and returns 503 when either is down, so a container with a
  broken dependency is taken out of rotation instead of serving errors.

## 5. Scheduled jobs

Two Container Apps Jobs, both idempotent and safe to retry:

| Job | Schedule | Purpose |
|---|---|---|
| `subscriptions` | `0 3 * * *` | advance trial → grace → expired, expire stale pending reservations, complete past appointments, purge sessions and rate-limit buckets |
| `reminders` | `*/10 * * * *` | dispatch due appointment reminders |

Run them as commands:

```bash
npm run job:subscriptions
npm run job:reminders
```

…or over HTTP, for a scheduler without shell access:

```bash
curl -X POST https://zynetna.tn/api/v1/jobs/subscriptions \
  -H "Authorization: Bearer $JOB_TOKEN"
```

The endpoint compares the token in constant time and returns **404** — not 401
— on failure, so its existence is not discoverable.

## 6. Migrations

Migrations run in the deployment pipeline **before** the new revision takes
traffic, so the schema is never behind the code that expects it.

```bash
npx prisma migrate deploy
```

Forward-only. To revert, write a new migration; never edit an applied one.

## 7. Observability

- **Application Insights** via the `APPLICATIONINSIGHTS_CONNECTION_STRING`
  environment variable, which the Container Apps runtime picks up.
- Logs are structured JSON in production (`src/lib/logger.ts`), with password,
  token and cookie fields redacted before anything is written.
- Watch: `/api/health` failures, 409 `SLOT_UNAVAILABLE` rate (a sudden rise
  means contention or a client bug), job completion, p95 latency on
  `/api/v1/availability` and `POST /api/v1/reservations`.

## 8. Custom domain and TLS

```bash
az containerapp hostname add --hostname zynetna.tn --name zynetna -g zynetna-rg
az containerapp ssl upload --certificate-file zynetna.pfx --name zynetna -g zynetna-rg
```

`Strict-Transport-Security` is already sent from `next.config.ts`, along with
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and a
`Permissions-Policy` that grants geolocation only to our own origin.

## 9. Before going live

- [ ] `SESSION_SECRET` generated fresh; not the placeholder
- [ ] `btree_gist`, `pg_trgm` and `citext` installed
- [ ] `STORAGE_DRIVER=azure` and `@azure/storage-blob` present in the image
- [ ] Database backups enabled, with point-in-time restore
- [ ] Both scheduled jobs created and observed to succeed once
- [ ] `/api/health` returns `{"status":"ok"}` from the public domain
- [ ] A real booking placed end to end against production
- [ ] Seed data **not** applied to the production database
