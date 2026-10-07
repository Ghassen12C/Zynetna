-- Team invitations.
--
-- An owner invites an email; the person accepts with their own account. The
-- token is stored hashed so a leaked row cannot be redeemed.

CREATE TABLE "StaffInvitation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "staffMemberId" TEXT,
    "email" CITEXT NOT NULL,
    "role" "RoleName" NOT NULL DEFAULT 'BUSINESS_EMPLOYEE',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "acceptedById" TEXT,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffInvitation_tokenHash_key" ON "StaffInvitation"("tokenHash");
CREATE INDEX "StaffInvitation_businessId_idx" ON "StaffInvitation"("businessId");
CREATE INDEX "StaffInvitation_email_idx" ON "StaffInvitation"("email");

ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_staffMemberId_fkey"
    FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_acceptedById_fkey"
    FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Only one invitation may be outstanding for an address at a business. A
-- partial index rather than a plain unique one, so the same person can be
-- re-invited after a previous invitation was accepted or revoked.
CREATE UNIQUE INDEX "staff_invitation_one_pending"
    ON "StaffInvitation" ("businessId", "email")
    WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;

-- An invitation is either outstanding or finished, never both.
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "staff_invitation_single_outcome"
    CHECK ("acceptedAt" IS NULL OR "revokedAt" IS NULL);

-- An accepted invitation records who accepted it.
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "staff_invitation_accepted_by"
    CHECK (("acceptedAt" IS NULL) = ("acceptedById" IS NULL));
