# ZYNETNA — Product & Technical Architecture

> Tunisia's beauty, grooming & wellness marketplace.
> **Book your chair. Book your glow.** · Barber & Beauty · Tunisie
> زينتنا — الحلاقة والتجميل · تونس

---

## 1. Current project assessment

The repository `Ghassen12C/Zynetna` was inspected at session start:

| Check | Result |
|---|---|
| Commits on any branch | **none** (`fatal: ... does not have any commits yet`) |
| Remote branches (`git ls-remote --heads`) | **none** |
| Files on disk | **none** except `.git/` |

**Conclusion:** there is no existing "Kerkina Beauty" codebase in this repository. There is
no legacy architecture to audit, no reusable component, no technical debt and no security
finding to report — because there is no code. The instruction *"reuse existing code only
when it is genuinely high quality"* therefore resolves to: **build Zynetna greenfield**,
which is the better outcome anyway.

Environment verified and available:

- Node 22.22, npm 10.9, pnpm 10.28
- PostgreSQL 16.15 — started, role `zinetna` + databases `zinetna` / `zinetna_test` created
- Docker 29.8
- npm registry reachable

---

## 2. Recommended architecture

A **single modular-monolith deployable** with clean internal domain boundaries. Not
microservices: Zynetna at launch is one product, one team, one database. Domain boundaries
are enforced by module structure (`src/domain/<domain>`) so that any domain can later be
extracted without rewriting callers.

```
┌───────────────────────────────────────────────────────────────┐
│                      Next.js (App Router)                     │
│                                                               │
│  app/(marketing)   app/(customer)   app/(pro)   app/(admin)   │
│  SSR + ISR         client islands   dashboard   dashboard     │
│         │                │              │           │        │
│         └────────────────┴──────┬───────┴───────────┘        │
│                                 │                             │
│   Server Actions  ·  Route Handlers (/api/v1/**)              │
│                                 │                             │
│  ┌──────────────────────────────▼──────────────────────────┐  │
│  │                     APPLICATION LAYER                    │  │
│  │  auth guards · permission checks · tenant resolution     │  │
│  │  Zod request validation · consistent error envelope      │  │
│  └──────────────────────────────┬──────────────────────────┘  │
│  ┌──────────────────────────────▼──────────────────────────┐  │
│  │                       DOMAIN LAYER                       │  │
│  │ identity marketplace scheduling booking business         │  │
│  │ reputation monetization platform                         │  │
│  │ (pure TS: rules, state machines, slot math — testable)   │  │
│  └──────────────────────────────┬──────────────────────────┘  │
│  ┌──────────────────────────────▼──────────────────────────┐  │
│  │                   INFRASTRUCTURE LAYER                   │  │
│  │ Prisma/Postgres · storage driver · notification driver   │  │
│  │ payment driver · map driver · logger · rate limiter      │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

**Key rule:** the domain layer never imports Next.js and never touches a driver directly —
drivers are injected. That is what makes the availability and booking engines unit-testable
without a browser or an HTTP server.

**Every provider is behind an interface** (`StorageDriver`, `NotificationChannel`,
`PaymentProvider`, `MapProvider`) with a real local/dev implementation and a production
implementation. No provider name appears in domain code.

---

## 3. Recommended technology stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15, App Router, TypeScript strict** | One deployable for SSR-SEO public pages *and* the API. Server Components keep customer bundles small on Tunisian mobile data. Runs on Azure App Service / Container Apps. |
| Styling | **Tailwind CSS v4** + CSS custom properties | Design tokens live in CSS vars → theming + RTL + dark mode without a JS runtime. |
| Database | **PostgreSQL 16** | Relational integrity for bookings. Critically: `btree_gist` + **exclusion constraints** give true database-level double-booking prevention. |
| ORM | **Prisma 6** | Typed queries, migrations. Raw SQL where needed (exclusion constraint, advisory locks, analytics aggregates). |
| Validation | **Zod 4** | One schema → server validation + inferred TS types + client form errors. |
| Auth | **Own session auth**: Argon2id + DB-backed sessions in `HttpOnly` cookies | Revocable server-side (a JWT is not). Full control over RBAC and tenant isolation, which is the security core of a multi-tenant marketplace. No third-party dependency on the critical path. |
| Motion | **motion** (Framer Motion) | GPU-friendly transforms, first-class `prefers-reduced-motion`. |
| Images | **sharp** | Server-side re-encode (also neutralises malicious payloads), AVIF/WebP, responsive variants. |
| i18n | Own lightweight dictionary + `[locale]` segment | FR/AR/EN with correct RTL. Avoids a heavy dependency for 3 locales. |
| Tests | **Vitest** | Domain unit tests + integration tests against a real `zinetna_test` database. |
| Storage | `StorageDriver`: local disk (dev) / **Azure Blob** (prod) | Images never in Postgres — only object keys + metadata. |

**Dependency discipline:** no UI kit, no chart library (charts are hand-built SVG — ~2 KB
instead of ~180 KB), no map SDK bundled (loaded only on the map route, behind a provider
interface), no date library (scheduling math uses a small, tested internal module).

---

## 4. Database model

39 tables across 9 domains. Full definition in `prisma/schema.prisma`.

### Identity
`User` · `Session` · `RoleAssignment` · `PasswordResetToken` · `EmailVerificationToken`

Roles are **assignments**, not a column: a user can be a customer *and* own a business
*and* be an employee elsewhere. Permissions derive from role → permission map in code
(`src/domain/identity/permissions.ts`), so authorization is permission-based, not scattered
`if (role === 'ADMIN')` checks.

### Marketplace
`Business` · `BusinessLocation` · `Category` (self-referencing tree) · `BusinessCategory` ·
`Service` · `ServiceCategory` · `MediaAsset` · `BusinessMedia` · `ServiceMedia`

`Business.slug` is unique and indexed → `zynetna.tn/business/<slug>`.
`Business.status` ∈ `DRAFT | PENDING_REVIEW | ACTIVE | SUSPENDED | REJECTED` and
`verification` ∈ `UNVERIFIED | PENDING | VERIFIED | REJECTED` — separate axes, because an
active business need not be verified.

### Scheduling
`StaffMember` · `StaffService` (which professional performs which service) ·
`BusinessHours` · `StaffHours` · `ScheduleException` (holiday / vacation / exceptional open)

Multiple periods per day are rows, not columns — `09:00–13:00` and `14:00–19:00` are two
`BusinessHours` rows for weekday 1. Times stored as **minutes from midnight** (`0..1440`)
in integer columns: no timezone ambiguity for recurring rules.

### Booking
`Reservation` · `ReservationItem` · `ReservationEvent` (append-only audit of transitions)

The double-booking guarantee:

```sql
ALTER TABLE "Reservation" ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist (
    "staffMemberId" WITH =,
    tstzrange("startAt", "endAt") WITH &&
  ) WHERE (status IN ('PENDING','CONFIRMED'));
```

Postgres itself refuses a second overlapping active reservation for the same professional.
This cannot be bypassed by a race, a retry, a second app instance, or a bug in application
code.

### Reputation
`Review` · `ReviewResponse` · `ReviewMedia` · `Favorite` · `ContentReport`

`Review` has a unique index on `reservationId` → one review per completed reservation, and
is only insertable when that reservation is `COMPLETED` (enforced in domain + DB check).

### Monetization
`SubscriptionPlan` · `Subscription` · `SubscriptionEvent` · `Payment` · `Invoice`

### Platform
`AuditLog` · `PlatformSetting` · `FeatureFlag` · `Notification` ·
`NotificationPreference` · `ScheduledNotification` · `RateLimitBucket` ·
`Governorate` · `City`

### Indexing strategy
Composite indexes on the real query shapes, not on every column:
`(status, verification)` for marketplace listing · `(businessId, startAt)` for the pro
calendar · `(staffMemberId, startAt, status)` for availability · `(customerId, startAt)`
for the customer dashboard · GiST on `location` point for proximity · trigram on
`Business.name` + `Service.name` for search.

---

## 5. Domain architecture

```
src/domain/
  identity/      roles, permissions, password policy, session rules
  marketplace/   business lifecycle, slugs, category tree, service rules
  scheduling/    time math, hours resolution, slot generation  ← pure, heavily tested
  booking/       reservation state machine, policy enforcement, conflict handling
  business/      staff, customers, gallery, profile completeness
  reputation/    review eligibility, moderation
  monetization/  plan resolution, trial, lifecycle, grace period
  platform/      audit, settings, feature flags, analytics queries
```

Each domain exports **pure functions and types**. Example: `scheduling/slots.ts` takes
hours, exceptions, existing reservations, service duration and policy, and returns slots. It
does no I/O, so double-booking and availability edge cases are tested in milliseconds.

---

## 6. User roles

| Role | Scope | Can |
|---|---|---|
| `CUSTOMER` | self | search, book, cancel/reschedule own, review completed, favorite |
| `BUSINESS_OWNER` | **one business (tenant)** | everything about that business |
| `BUSINESS_EMPLOYEE` | one business, narrowed | own calendar, assigned reservations, own profile |
| `SUPER_ADMIN` | platform | everything, incl. moderation and settings |

Authorization is **permission-based**. `can(actor, 'business.service.write', { businessId })`
resolves the actor's assignments, maps them to permissions, and checks tenant scope in one
place. **Tenant isolation is enforced server-side in the data access layer**: every
business-scoped query goes through a helper that injects the `businessId` the actor is
authorized for. A business owner cannot read another business's reservations, customers,
staff, services, media, analytics or settings — there is no code path that would allow it,
and there are tests asserting exactly that.

---

## 7. Booking architecture

```
Business → Service → Professional → Date → Slot → Confirm
```

**Availability (server-authoritative).** `GET /api/v1/availability` computes:

1. Resolve the day's working windows: `StaffHours` if defined, else `BusinessHours`.
2. Subtract `ScheduleException` (holiday, vacation, break, exceptional closure); apply
   exceptional opening hours when present.
3. Keep only staff linked to the service via `StaffService`.
4. Subtract existing `PENDING`/`CONFIRMED` reservations, inflated by the service's buffer.
5. Walk the remaining windows in `slotGranularity` steps, keeping starts where
   `prep + duration + buffer` fits entirely inside one window.
6. Drop slots violating `minNoticeMinutes`, beyond `maxAdvanceDays`, or in the past.

The frontend renders what the server returns. It never computes availability.

**Booking (transactional).** `POST /api/v1/reservations`:

```
BEGIN; SERIALIZABLE
  pg_advisory_xact_lock(hash(staffMemberId, day))   -- serialise same-day contenders
  re-verify business ACTIVE + subscription entitled
  re-verify staff performs service
  re-verify slot still inside a working window
  re-verify no overlap
  INSERT Reservation                                -- exclusion constraint = final arbiter
  INSERT ReservationEvent(CREATED)
COMMIT;
```

A conflict — whether caught by the re-check, the advisory lock ordering, or the exclusion
constraint (`23P01`) — returns **HTTP 409** with code `SLOT_UNAVAILABLE`. The UI shows
*"This time slot is no longer available. Please choose another time."* and refetches
availability. Customer B is rejected, always.

**State machine** (`booking/stateMachine.ts`) — illegal transitions are impossible:

```
PENDING   → CONFIRMED | CANCELLED_BY_CUSTOMER | CANCELLED_BY_BUSINESS | RESCHEDULED | EXPIRED
CONFIRMED → COMPLETED | CANCELLED_BY_CUSTOMER | CANCELLED_BY_BUSINESS | RESCHEDULED | NO_SHOW
others    → terminal
```

Every transition writes a `ReservationEvent` (actor, from, to, reason, timestamp).

**Policies** per business, surfaced in the UI *before* confirmation: cancellation window,
minimum notice, maximum advance, rescheduling allowed, no-show handling, auto-confirm.

---

## 8. Subscription architecture

Nothing is hard-coded. `SubscriptionPlan` rows are data:

```
{ code: 'pro-monthly', name, priceAmount: 30.00, currency: 'TND',
  interval: 'MONTH', trialDays: 60, gracePeriodDays: 7, features: {...} }
```

Launch offer — **first 2 months free, then 30 TND/month** — is `trialDays: 60` plus a
`platform.subscription.*` setting group the Super Admin can edit. Future `basic`,
`premium`, `featured`, `enterprise` plans are new rows, no code change. `features` is a
JSON entitlement map read through `entitlements.ts`, which is how future featured/sponsored
placement will be gated.

Lifecycle: `TRIALING → ACTIVE → PAST_DUE → GRACE → EXPIRED → CANCELLED`, advanced by an
idempotent job (`/api/v1/jobs/subscriptions`, also runnable as a CLI) that emits
`SubscriptionEvent`s and trial-ending / expiry notifications. **An expired subscription
removes the business from marketplace listing and blocks new bookings** — existing
reservations are honoured. Real consequence, not a badge.

Payments: `PaymentProvider` interface + a `ManualPaymentProvider` that records an
admin-confirmed bank/cash payment. No fake card form, no fake success screen. A Tunisian
PSP (ClicToPay / Paymee / Flouci) drops in as one more implementation.

---

## 9. Media architecture

```
client → POST /api/v1/media (multipart)
         ├─ authz + per-actor rate limit
         ├─ size cap (8 MB) + extension + declared MIME
         ├─ magic-byte sniff (real content type, not the header)
         ├─ sharp decode  ← re-encode strips EXIF/ICC and any embedded payload
         ├─ dimension sanity (reject decompression bombs)
         ├─ variants: thumb 320 · card 640 · full 1280 · AVIF + WebP
         ├─ StorageDriver.put(key, buffer)      local disk | Azure Blob
         └─ INSERT MediaAsset (key, variants, dimensions, bytes, checksum, blurhash)
```

`MediaAsset` is generic; `BusinessMedia` attaches it with a `role`
(`LOGO | COVER | EXTERIOR | INTERIOR | PORTFOLIO | TEAM | GALLERY`) and a `position` for
drag-reorder; `ServiceMedia` attaches it to a service. **Only keys and metadata in
Postgres** — never binaries. `StorageDriver` has `put`/`delete`/`url`/`signedUploadUrl`, so
moving to Azure Blob + CDN is a config change (`STORAGE_DRIVER=azure`).

---

## 10. Design system

Driven by the supplied **Zynetna brand guide**, not invented. Tokens live in
`src/styles/tokens.css` and are consumed by Tailwind v4's `@theme`, so brand values exist
in exactly one place.

**Mark — "the medina arch" (Option 1, primary).** The doorway of a Tunisian salon: a half
circle on two straight jambs, built on one 50-unit radius. The counter is a single letter
read two ways — Latin **Z**, and Arabic **ز** once the dot sits above it. That bilingual
reading is the reason this lockup is chosen as primary over *Scissor Y* and *The Mirror*
(both kept documented as alternates in `docs/BRAND.md`): it is the only one that speaks
French and Arabic at once, and the only one with a complete icon/avatar system.

Shipped as `src/components/brand/` React SVG — no raster asset, no image request. Scales to
the 24 px floor, inherits `currentColor`, and renders in reversed / one-colour / on-gold.
Clear space is enforced by the component's own padding = one jamb width.

**Colour.**

| Token | Hex | Role |
|---|---|---|
| `--z-medina` | `#0E3B66` | the mark, headings, buttons |
| `--z-chaux`  | `#F5F1E8` | page ground, knockouts |
| `--z-jasmin` | `#E0A94E` | rules, highlights, badges |
| `--z-encre`  | `#0A1C2E` | body text, one-colour print |
| `--z-slate`  | `#44566B` | captions, muted text |

Per the guide, **Jasmin carries graphics, never small text on light grounds** — captions
resolve to Encre or `#44566B`. This is encoded as a lint-able rule: there is no
`text-jasmin` utility at caption sizes in the token set, so the mistake is hard to make.
Semantic tokens (`--z-bg`, `--z-fg`, `--z-accent`, `--z-danger`, …) map onto these, and are
redefined for dark mode so no component hard-codes a hex.

**Type.** **Epilogue** for Latin & French, **Tajawal** for Arabic — self-hosted, subset,
`font-display: swap`, so there is no third-party font request. Body is 17 px / weight 500
as specified. The Arabic face switches automatically with `dir="rtl"` via
`:lang(ar)`, so Arabic is set in a real Arabic design rather than a Latin fallback.

**Scale.** 4 px spacing base. Radii `6/10/16/24/999`. Three shadow levels. One elevation
language.

**Primitives** (`src/components/ui`): Button (5 variants × 3 sizes, loading + disabled),
Input, Select, Textarea, Checkbox, Radio, Switch, Chip, Card, Badge, Avatar, Modal, Sheet
(mobile bottom-sheet), Toast, Tabs, Table, Pagination, Skeleton, EmptyState, ErrorState,
Rating, PriceTag, DayPicker, SlotPicker, ImageUploader, Gallery, Chart (SVG).

**Motion.** Durations `120/200/320 ms`, easing `cubic-bezier(.22,1,.36,1)`. Transform and
opacity only — never layout properties. All of it behind `prefers-reduced-motion: reduce`,
which is a real switch in the code, not a comment.

**Accessibility.** Semantic HTML first. Visible focus rings. AA contrast verified on every
token pair in use. Keyboard-complete modals, sheets, tabs and slot picker. Labelled form
controls with `aria-describedby` errors. Live regions for toasts and availability changes.

---

## 11. Page structure

```
/[locale]
  /                              landing — avatar, search, categories, featured
  /search                        results + filters + map toggle
  /map                           map-first discovery
  /category/[slug]               SEO category landing
  /business/[slug]               public profile  ← the digital storefront
  /business/[slug]/book          booking flow
  /reservations/[reference]      confirmation / manage
  /account                       upcoming · history · favorites · reviews · notifications · profile
  /pro                           commercial pitch — 2 months free, then 30 TND
  /pro/onboarding/[step]         11-step wizard
  /pro/dashboard                 overview · calendar · reservations · services · team
                                 customers · profile · gallery · reviews · analytics
                                 subscription · settings
  /pro/preview                   "how customers see my business"
  /admin                         dashboard · users · businesses · reservations · categories
                                 reviews · reports · subscriptions · payments · analytics
                                 audit · settings · flags
  /login  /register  /register/pro  /forgot-password  /reset-password
```

```
/api/v1/{auth,users,businesses,services,professionals,availability,reservations,
         reviews,favorites,media,notifications,subscriptions,payments,admin,analytics}
/api/health
/sitemap.xml  /robots.txt
```

**SEO.** Business and category pages are server-rendered with per-page metadata, Open
Graph, canonical URLs, `LocalBusiness` + `Service` + `AggregateRating` + `BreadcrumbList`
JSON-LD, `hreflang` for fr/ar/en, and a generated sitemap. Slugs are human-readable.

---

## 12. Implementation roadmap

| Phase | Content | State |
|---|---|---|
| 1 | Architecture, DB, auth, RBAC, tenant isolation, design system, layout | this session |
| 2 | Landing, search, filters, categories, business profile, gallery, services | this session |
| 3 | Pro registration, onboarding, profile, media, services, staff, schedule | this session |
| 4 | Availability, slots, booking, confirmation, cancel, reschedule, conflicts | this session |
| 5 | Customer / professional / super-admin dashboards | this session |
| 6 | Reviews, favorites, notifications, analytics | this session |
| 7 | Trial, 30 TND plan, subscription lifecycle, payment abstraction | this session |
| 8 | Tunisian avatar, motion, micro-interactions, polish | this session |
| 9 | Tests, security, SEO, performance, Azure, CI/CD, observability | this session |

Later, deliberately **not** built now but architected for: online payments via a Tunisian
PSP, WhatsApp notifications, featured/sponsored placement, promo codes, loyalty, gift
cards, multi-location businesses, PWA, native app, AI recommendations. The booking engine
stays deterministic — AI will never be on its critical path.

---

## 13. Production architecture (Azure)

```
Azure Front Door ──▶ Container Apps (Next.js, 2+ replicas, autoscale)
                         ├── Azure Database for PostgreSQL Flexible Server
                         ├── Azure Blob Storage (+ CDN) — media
                         ├── Azure Key Vault — secrets via managed identity
                         ├── Application Insights — traces, metrics, latency
                         └── Container Apps Job (cron) — subscriptions, reminders
```

CI/CD: `install → lint → typecheck → test → build → migrate → deploy`, with
dev / staging / production environments. `/api/health` reports database and storage
readiness for probes. Structured JSON logging with a request id; secrets are read from the
environment only, and never reach the client bundle.
