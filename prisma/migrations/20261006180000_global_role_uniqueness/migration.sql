-- Postgres treats NULLs as distinct, so the @@unique on
-- (userId, role, businessId) does not prevent a user holding the same
-- PLATFORM role twice — businessId is NULL for those rows. A partial unique
-- index closes that hole without affecting tenant-scoped assignments.
CREATE UNIQUE INDEX "role_assignment_global_unique"
  ON "RoleAssignment" ("userId", "role")
  WHERE "businessId" IS NULL;

-- A business must not grant the same role to the same user twice either; that
-- one IS covered by the existing unique index, since businessId is non-null
-- there. Nothing to add.

-- Guests must carry contact details: a walk-in with neither a customer account
-- nor a phone/name cannot be contacted if the appointment changes.
ALTER TABLE "Reservation"
  ADD CONSTRAINT "reservation_has_contact"
  CHECK (
    "customerId" IS NOT NULL
    OR "guestName" IS NOT NULL
    OR "guestPhone" IS NOT NULL
  );
