# Zynetna in production (Azure)

Live at **https://www.zynetna.tn** since 2026-10-07. This page describes what
actually runs, how to change it, and how to undo a change.

## Architecture

```
            OVH DNS (zynetna.tn)
   www  CNAME → zynetna-web.azurewebsites.net
   @    A     → 20.111.1.9   (App Service scale unit, francecentral)
   asuid / asuid.www  TXT    (App Service domain verification)
                  │
                  ▼
 ┌──────────── resource group kerkennah-rg (France Central) ───────────────┐
 │                                                                        │
 │  App Service plan kerkennah-plan (Linux B1)                            │
 │   └─ zynetna-web  ← container kerkennahacr.azurecr.io/zynetna:<sha>    │
 │        system identity ─┬─ AcrPull on kerkennahacr                     │
 │                         └─ Key Vault Secrets User on zynetna-kv        │
 │        HTTPS only · TLS ≥ 1.2 · FTP off · always on · /api/health      │
 │        managed certificates: zynetna.tn, www.zynetna.tn                │
 │                                                                        │
 │  zynetna-kv (Key Vault, RBAC)   database-url, session-secret,          │
 │                                 job-token, storage-connection-string,  │
 │                                 resend-api-key                         │
 │  kerkennah-db (PostgreSQL 16, B1ms, 7-day backups)                     │
 │   ├─ database zynetna, login zynetna_app (only that database),         │
 │   │  extensions btree_gist · citext · pg_trgm, TLS required            │
 │   └─ ghassen_prod / ghassen_staging, login ghassen_app: GhassenAcademy │
 │      (another project, rg-ghassen), sharing the server since 10-13     │
 │  zynetnamedia (Storage) ├─ container zynetna-media, blob-level read,   │
 │                          │  14-day soft delete                         │
 │                          └─ container zynetna-media-private, no public │
 │                             access (payment screenshots, D17 QR);      │
 │                             the app creates it on first private upload │
 │  id-zynetna-github (managed identity, OIDC from GitHub)                │
 │   ├─ AcrPush on kerkennahacr                                           │
 │   └─ Website Contributor on zynetna-web only                           │
 └────────────────────────────────────────────────────────────────────────┘
   E-mail: Resend (domain zynetna.tn verified), sender noreply@zynetna.tn
```

The previous pilot (`kerkennah-app`, its `kerkennah` database, the
`kerkennahstorage` account and its monitoring) was removed on 2026-10-13. Its
data was test data only; an archive is kept in the private container
`zynetnamedia/archives` (`kerkennah/kerkennah-2026-10-13.dump`).

## Canonical origin

`https://www.zynetna.tn` is the only origin. HTTP is redirected to HTTPS by
App Service (`httpsOnly`); the bare domain answers 308 → `www` from the
middleware (`src/middleware.ts`). `APP_URL=https://www.zynetna.tn` drives
every absolute link (e-mails, QR codes, calendar files). Session cookies are
host-only, `Secure`, `HttpOnly`, `SameSite=Lax`.

## Configuration

App settings on `zynetna-web` (values in **bold** are Key Vault references,
`@Microsoft.KeyVault(VaultName=zynetna-kv;SecretName=…)`, never plain text):

| Setting | Value |
|---|---|
| `APP_URL` | `https://www.zynetna.tn` |
| `DATABASE_URL` | **database-url** (`…/zynetna?sslmode=require&connection_limit=5`) |
| `SESSION_SECRET` | **session-secret** |
| `JOB_TOKEN` | **job-token** |
| `STORAGE_DRIVER` / `AZURE_STORAGE_CONTAINER` | `azure` / `zynetna-media` |
| `AZURE_STORAGE_CONNECTION_STRING` | **storage-connection-string** |
| `EMAIL_DRIVER` / `EMAIL_FROM` | `resend` / `Zynetna <noreply@zynetna.tn>` |
| `RESEND_API_KEY` | **resend-api-key** |
| `WEBSITES_PORT` | `3000` |
| `GOOGLE_CLIENT_ID` | the OAuth client ID (public, not a secret) — optional |
| `GOOGLE_CLIENT_SECRET` | **google-client-secret** — optional, set together with the ID |

`connection_limit=5` keeps the app well inside the B1ms connection budget,
which the database server shares. The first start used `SEED_ON_START=true`
with `ADMIN_*` values to create reference data and the first super admin;
those settings and the `admin-password` secret were removed afterwards.

GitHub, environment **production**: secrets `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `JOB_TOKEN`; variables
`AZURE_REGISTRY=kerkennahacr`, `AZURE_RESOURCE_GROUP=kerkennah-rg`,
`AZURE_WEBAPP=zynetna-web`, `APP_URL=https://www.zynetna.tn`. The OIDC trust
subject is `repo:Ghassen12C@114819201/Zynetna@1407400429:environment:production`
(GitHub's ID-based format).

## Google sign-in ("Continuer avec Google")

Off until both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set; the
button only appears then. In Google Cloud Console: an OAuth consent screen
(external, scopes `openid`, `email`, `profile`), then an OAuth client of type
*Web application* with the authorised redirect URI
`https://www.zynetna.tn/api/auth/google/callback`. The secret goes into Key
Vault as `google-client-secret`; the app setting references it. Rotate it in
Google Cloud, update the Key Vault secret, restart the app.

## D17 payments

Nothing to configure in Azure. After deploying, in **Admin → Paramètres →
Paiement D17**:
1. Upload the screenshot of the D17 "Paiement commerçant" screen, cropped to the QR.
2. Enter the recipient name.
3. Tick "Proposer le paiement par D17".

Professionals then see "Payer avec D17" on their Abonnement page. Payments to check
appear at the top of **Admin → Abonnements**. The QR and the screenshots live in the
private container `zynetna-media-private`. The app creates it using the existing
storage connection string; it is an addition, and the public `zynetna-media` container
is not changed.

## Deploying

Actions → **Deploy** → Run workflow (or push a `v*` tag). The workflow:

1. signs in to Azure with OIDC (no stored Azure password);
2. builds the image once and pushes `zynetna:<sha>` and `zynetna:latest`;
3. points `zynetna-web` at `zynetna:<sha>` and restarts it;
4. waits until `/api/health` reports `status: ok` **and** `version: <sha>`.

On start the container (`scripts/start.sh`) runs `prisma migrate deploy`
from inside Azure, so the database never accepts connections from GitHub. A
failed migration stops the container and App Service keeps serving the
previous one.

**Rollback**: run Deploy with `image_tag` = an earlier commit SHA. It skips
the build and re-points the app at that image. Migrations only go forward:
roll back code, never schema; write a new migration to undo a schema change.

## Scheduled jobs

`.github/workflows/jobs.yml` calls `POST /api/v1/jobs/<name>` with the job
token: `reminders` every 15 minutes, `subscriptions` daily 02:17 UTC,
`cleanup` daily 03:41 UTC. Every job is idempotent. Run one by hand from the
Actions tab.

## Operating

```bash
RG=kerkennah-rg; APP=zynetna-web
curl -s https://www.zynetna.tn/api/health          # status + running version
az webapp log tail -g $RG -n $APP                  # live container logs
az webapp restart -g $RG -n $APP
```

Backups: the database has 7-day point-in-time restore (restore creates a new
server; then point `database-url` at it). Images: 14-day blob soft delete.

The production seed (`npm run db:seed:prod`) is idempotent and never deletes.
The development seed (`npm run db:seed`) wipes every table and refuses to run
against anything but a local database.

## Shared database server

`kerkennah-db` also hosts GhassenAcademy (`ghassen_prod`, `ghassen_staging`,
login `ghassen_app`, apps in `rg-ghassen`) since 2026-10-13. One B1ms server
stays within the Azure free offer, which covers only one, and costs half of two.

- **Isolation:** each database accepts only its own login. `zynetna` lists
  `kerkennah` and `zynetna_app`, the two `ghassen_*` databases only
  `ghassen_app`. Neither app can open the other's database.
- **Connection budget:** the server allows about 50 connections in total.
  Zynetna uses `connection_limit=5` in its `database-url`, GhassenAcademy
  5 (prod) + 2 (staging) through `DATABASE_POOL_SIZE`. Raise any of them only
  with the total in mind.
- **Shared CPU:** the server is burstable, so a long, heavy peak on one site
  can slow the other. Watch *kerkennah-db → Metrics → CPU credits remaining*.
  The fix is a bigger SKU (B2s, a restart of a few minutes) or moving one
  project to its own server with `pg_dump`/`pg_restore`.
- **Restores:** a point-in-time restore creates a new server with every
  database. To recover only one project, `pg_dump` its database from the
  restored server, then delete the restored server.
- **Admin password:** the `kerkennah` admin login is used by no app (each
  connects with its own role). Rotated on 2026-10-13; it lives only in the
  owner's password manager. Reset it with
  `az postgres flexible-server update -g kerkennah-rg -n kerkennah-db --admin-password …`.

## Archives

The private container `archives` in `zynetnamedia` (no public access, separate
from the media containers) keeps database exports that are no longer live:

| Blob | Holds |
|---|---|
| `kerkennah/kerkennah-2026-10-13.dump` | the old pilot's test database (`pg_restore` format) |
