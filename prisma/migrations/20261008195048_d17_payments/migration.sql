-- D17 payments with a screenshot, confirmed by an admin. Additive only.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_REJECTED';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "planId" TEXT,
ADD COLUMN     "proofKey" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMPTZ(3),
ADD COLUMN     "submittedById" TEXT;
