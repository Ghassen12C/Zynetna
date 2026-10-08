-- Packs: a service can bundle other services of the same business.
-- Additive only: new nullable/defaulted columns and a new table.

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "isPackage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxAdvanceDays" INTEGER,
ADD COLUMN     "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ServicePackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServicePackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicePackageItem_serviceId_idx" ON "ServicePackageItem"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePackageItem_packageId_serviceId_key" ON "ServicePackageItem"("packageId", "serviceId");

-- AddForeignKey
ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
