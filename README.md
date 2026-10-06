<div align="center">

# ZYNETNA

**Réserve ta chaise. Réserve ton éclat.**
Barber & Beauty · Tunisie — زينتنا · الحلاقة والتجميل · تونس

Tunisia's marketplace for discovering and booking beauty, grooming and wellness
services. Customers find and book in seconds; professionals get a complete
digital storefront and a real business-management system.

</div>

---

## What this is

Three experiences on one platform:

| | |
|---|---|
| **Customers** | Search by service, category, city or location · filter by price, rating, availability · browse a business's full profile · book a specific professional at a specific time · cancel, reschedule and review |
| **Professionals** | A public page that works like a mini-site · online booking 24/7 · services with prices, durations and photos · team with per-person service assignment · opening hours with split days, holidays and vacations · calendar, customers, revenue and analytics |
| **Platform owner** | Approvals, verification and suspension · user and role administration · category tree · review and report moderation · subscriptions, payments, MRR, conversion and churn · audit log · settings and feature flags |

**Commercial model:** two months free, then **30 TND/month**. Those numbers are
rows in `SubscriptionPlan`, editable from the admin — not constants in the code.

---

## The part that matters

A booking platform is only as good as its guarantee that two customers cannot
hold the same chair at the same time. Zynetna enforces that in **PostgreSQL
itself**, not in application code:

```sql
ALTER TABLE "Reservation"
  ADD CONSTRAINT "reservation_no_overlap"
  EXCLUDE USING gist (
    "staffMemberId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (status IN ('PENDING', 'CONFIRMED'));
```

Three layers sit in front of it: an availability engine that only offers
legitimate slots, a `SERIALIZABLE` transaction with an advisory lock per
professional-day, and a re-check inside that transaction. A conflict at any
layer becomes **HTTP 409 `SLOT_UNAVAILABLE`** with an actionable message.

There is a test for exactly this: six customers book the same slot
simultaneously, one wins, five receive the clean rejection.

---

## Running it

**Requirements:** Node 22+, PostgreSQL 16+ (with `btree_gist`, `pg_trgm`,
`citext`).

```bash
npm install
cp .env.example .env            # then set SESSION_SECRET and DATABASE_URL
createdb zynetna

npx prisma migrate deploy       # schema + integrity constraints
npm run db:seed                 # Tunisian demo data
npm run db:seed:media           # generated images, via the real upload pipeline

npm run dev                     # http://localhost:3000
```

### Demo accounts

Password for all: `Zynetna2026!`

| Role | Email |
|---|---|
| Super admin | `admin@zynetna.tn` |
| Professional | `owner1@zynetna.tn` … `owner10@zynetna.tn` |
| Customer | `mariem.bouzid@example.tn` |

### Commands

```bash
npm run dev              # development server
npm run build            # production build
npm run lint             # eslint, zero warnings tolerated
npm run typecheck        # tsc --noEmit
npm test                 # 82 tests (needs the zynetna_test database)

npm run db:migrate       # create a migration
npm run db:seed          # reseed demo data
npm run job:subscriptions   # lifecycle sweep — idempotent, safe to retry
npm run job:reminders       # dispatch due appointment reminders
```

---

## Architecture

Full detail in **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

A modular monolith with clean domain boundaries — one deployable, one database,
boundaries enforced by module structure so any domain can be extracted later
without rewriting its callers.

```
src/
  app/          routes: (public) (auth) (app) (pro) (admin) api
  components/   brand · ui · layout · business · booking · pro · admin · charts
  domain/       pure business logic — no I/O, no framework, heavily tested
    identity/     roles, permissions, password policy
    scheduling/   timezone math, interval algebra, availability engine
    booking/      reservation state machine, policies, references
    monetization/ subscription lifecycle, plan entitlements
  server/       guards, services, providers, actions — the only layer with I/O
  lib/          env, db, errors, logger, validation
  i18n/         fr · ar · en with correct RTL
```

**The domain layer never imports Next.js and never touches a driver.** That is
what makes the availability engine testable in milliseconds and the booking
rules provable.

### Deliberate decisions

- **No charting library.** Two chart types, hand-built as SVG: ~2 KB instead of
  ~180 KB, server-rendered, no hydration.
- **No UI kit.** The design system comes from the brand guide; a kit would have
  been fought, not used.
- **Database sessions, not JWT.** A marketplace needs real revocation:
  suspending a user or changing a password must take effect immediately.
- **Images re-encoded, never passed through.** `sharp` decodes and re-encodes
  every upload, which strips EXIF and neutralises polyglot payloads — the stored
  bytes are ones we produced.
- **`timestamptz` everywhere.** Recurring wall-clock rules resolve through a
  two-pass offset calculation, so opening hours survive DST boundaries.

---

## Security

| Concern | How |
|---|---|
| Passwords | Argon2id (19 MiB, t=2, p=1). Wrong email and wrong password take the same time. |
| Sessions | Opaque tokens, SHA-256 at rest, `HttpOnly` + `SameSite=Lax`, server-revocable |
| Authorization | Permission-based, never scattered role checks |
| Tenant isolation | Centralised in `server/auth/guard.ts`; the tenant comes from the actor's own role assignments, never from the request |
| Rate limiting | Durable in Postgres, so limits hold across replicas |
| Uploads | Magic-byte sniffing, size and dimension caps, full re-encode |
| Secrets | `server-only` on the env module makes a client-bundle leak a build error |
| Audit | Every consequential action recorded with actor, target and metadata |

---

## Deployment

Targets **Azure**: Container Apps, PostgreSQL Flexible Server, Blob Storage,
Key Vault, Application Insights. See
**[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**.

```bash
docker build -t zynetna .
docker run -p 3000:3000 --env-file .env zynetna
```

`GET /api/health` reports database and storage readiness for probes.

CI runs lint → typecheck → test → build on every push, with a real PostgreSQL
service container. Deployment is manual or tag-triggered, applies migrations
before the new revision takes traffic, and verifies health afterwards.

---

## Built but deliberately not finished

Architected for, not implemented: online payments through a Tunisian PSP
(`PaymentProvider` interface, `ManualPaymentProvider` in place), WhatsApp
notifications (`NotificationChannel`), map providers (`MapProvider`), featured
and sponsored placement, promo codes, loyalty, gift cards, multi-location.

The booking engine stays deterministic. AI will not be on its critical path.
