-- ════════════════════════════════════════════════════════════════════════════
--  Booking integrity + search indexes
--  These are the guarantees application code cannot bypass: they hold under
--  races, retries, multiple app instances and application bugs alike.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. DOUBLE-BOOKING PREVENTION ───────────────────────────────────────────
-- Postgres itself refuses a second overlapping *active* reservation for the
-- same professional. This is the final arbiter behind the transactional
-- booking path. Cancelled / completed / no-show rows are excluded, so a slot
-- frees up the instant a reservation is cancelled.
ALTER TABLE "Reservation"
  ADD CONSTRAINT "reservation_no_overlap"
  EXCLUDE USING gist (
    "staffMemberId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (status IN ('PENDING', 'CONFIRMED'));

ALTER TABLE "Reservation"
  ADD CONSTRAINT "reservation_time_order" CHECK ("endAt" > "startAt");

-- ── 2. SCHEDULE SANITY ─────────────────────────────────────────────────────
ALTER TABLE "BusinessHours"
  ADD CONSTRAINT "business_hours_valid"
  CHECK ("startMin" >= 0 AND "endMin" <= 1440 AND "endMin" > "startMin");

ALTER TABLE "BusinessHours"
  ADD CONSTRAINT "business_hours_weekday" CHECK ("weekday" BETWEEN 0 AND 6);

ALTER TABLE "StaffHours"
  ADD CONSTRAINT "staff_hours_valid"
  CHECK ("startMin" >= 0 AND "endMin" <= 1440 AND "endMin" > "startMin");

ALTER TABLE "StaffHours"
  ADD CONSTRAINT "staff_hours_weekday" CHECK ("weekday" BETWEEN 0 AND 6);

-- Overlapping working periods on the same weekday are a data error: they would
-- silently double-count availability.
ALTER TABLE "BusinessHours"
  ADD CONSTRAINT "business_hours_no_overlap"
  EXCLUDE USING gist (
    "businessId" WITH =,
    "weekday" WITH =,
    int4range("startMin", "endMin", '[)') WITH &&
  );

ALTER TABLE "StaffHours"
  ADD CONSTRAINT "staff_hours_no_overlap"
  EXCLUDE USING gist (
    "staffMemberId" WITH =,
    "weekday" WITH =,
    int4range("startMin", "endMin", '[)') WITH &&
  );

ALTER TABLE "ScheduleException"
  ADD CONSTRAINT "schedule_exception_window"
  CHECK (
    ("startMin" IS NULL AND "endMin" IS NULL)
    OR ("startMin" >= 0 AND "endMin" <= 1440 AND "endMin" > "startMin")
  );

-- ── 3. SERVICE / PRICING SANITY ────────────────────────────────────────────
ALTER TABLE "Service"
  ADD CONSTRAINT "service_duration_positive" CHECK ("durationMinutes" > 0);

ALTER TABLE "Service"
  ADD CONSTRAINT "service_price_non_negative" CHECK ("priceAmount" >= 0);

ALTER TABLE "Service"
  ADD CONSTRAINT "service_buffers_non_negative"
  CHECK ("bufferMinutes" >= 0 AND "prepMinutes" >= 0);

ALTER TABLE "Business"
  ADD CONSTRAINT "business_slot_granularity"
  CHECK ("slotGranularityMinutes" BETWEEN 5 AND 120);

ALTER TABLE "Business"
  ADD CONSTRAINT "business_advance_window"
  CHECK ("maxAdvanceDays" BETWEEN 1 AND 365 AND "minNoticeMinutes" >= 0);

-- ── 4. REVIEW INTEGRITY ────────────────────────────────────────────────────
ALTER TABLE "Review"
  ADD CONSTRAINT "review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "Business"
  ADD CONSTRAINT "business_rating_range"
  CHECK ("ratingAverage" >= 0 AND "ratingAverage" <= 5 AND "ratingCount" >= 0);

-- ── 5. SUBSCRIPTION SANITY ─────────────────────────────────────────────────
ALTER TABLE "SubscriptionPlan"
  ADD CONSTRAINT "plan_price_non_negative" CHECK ("priceAmount" >= 0);

ALTER TABLE "SubscriptionPlan"
  ADD CONSTRAINT "plan_trial_non_negative"
  CHECK ("trialDays" >= 0 AND "gracePeriodDays" >= 0);

-- Exactly one default plan at a time.
CREATE UNIQUE INDEX "plan_single_default"
  ON "SubscriptionPlan" (("isDefault")) WHERE "isDefault";

-- ── 6. SEARCH INDEXES ──────────────────────────────────────────────────────
-- Trigram indexes power fuzzy name search ("coifeur" still finds "Coiffeur").
CREATE INDEX "business_name_trgm" ON "Business" USING gin ("name" gin_trgm_ops);
CREATE INDEX "service_name_trgm"  ON "Service"  USING gin ("name" gin_trgm_ops);
CREATE INDEX "category_name_trgm" ON "Category" USING gin ("name" gin_trgm_ops);

-- Marketplace listing only ever reads bookable businesses; a partial index
-- keeps it small and hot.
CREATE INDEX "business_live_listing"
  ON "Business" ("ratingAverage" DESC, "publishedAt" DESC)
  WHERE status = 'ACTIVE';

-- Availability lookup: the hottest query in the product.
CREATE INDEX "reservation_active_window"
  ON "Reservation" ("staffMemberId", "startAt", "endAt")
  WHERE status IN ('PENDING', 'CONFIRMED');

-- Unread notification badge.
CREATE INDEX "notification_unread"
  ON "Notification" ("userId", "createdAt" DESC)
  WHERE "readAt" IS NULL;

-- Reminder dispatcher scan.
CREATE INDEX "scheduled_notification_due"
  ON "ScheduledNotification" ("sendAt")
  WHERE status = 'PENDING';
