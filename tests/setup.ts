import { PrismaClient } from '@prisma/client';

/**
 * Integration tests run against a real PostgreSQL database — the same engine,
 * the same constraints. The exclusion constraint that prevents double booking
 * cannot be exercised against a mock, so it is not mocked.
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://zynetna:zynetna_dev@127.0.0.1:5432/zynetna_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;
// NODE_ENV is typed readonly; vitest.config.ts already sets it for the run.
process.env.SESSION_SECRET ??= 'test-session-secret-at-least-32-characters-long';
process.env.JOB_TOKEN ??= 'test-job-token-value';
process.env.STORAGE_DRIVER ??= 'local';
process.env.STORAGE_LOCAL_DIR ??= './storage-test';

export const testDb = new PrismaClient({
  datasources: { db: { url: TEST_DATABASE_URL } },
});

/** Wipe every table between suites, children first. */
export async function resetDatabase() {
  await testDb.$transaction([
    testDb.scheduledNotification.deleteMany(),
    testDb.notification.deleteMany(),
    testDb.notificationPreference.deleteMany(),
    testDb.reviewMedia.deleteMany(),
    testDb.reviewResponse.deleteMany(),
    testDb.contentReport.deleteMany(),
    testDb.review.deleteMany(),
    testDb.reservationEvent.deleteMany(),
    testDb.reservationItem.deleteMany(),
    testDb.reservation.deleteMany(),
    testDb.favorite.deleteMany(),
    // Before the staff rows and businesses they point at, so the reset does
    // not depend on cascade ordering.
    testDb.staffInvitation.deleteMany(),
    testDb.staffService.deleteMany(),
    testDb.staffHours.deleteMany(),
    testDb.scheduleException.deleteMany(),
    testDb.staffMember.deleteMany(),
    testDb.servicePackageItem.deleteMany(),
    testDb.serviceMedia.deleteMany(),
    testDb.service.deleteMany(),
    testDb.businessHours.deleteMany(),
    testDb.businessMedia.deleteMany(),
    testDb.businessCategory.deleteMany(),
    testDb.businessLocation.deleteMany(),
    testDb.payment.deleteMany(),
    testDb.subscriptionEvent.deleteMany(),
    testDb.subscription.deleteMany(),
    testDb.roleAssignment.deleteMany(),
    testDb.business.deleteMany(),
    testDb.subscriptionPlan.deleteMany(),
    testDb.mediaAsset.deleteMany(),
    testDb.oAuthAccount.deleteMany(),
    testDb.loginChallenge.deleteMany(),
    testDb.recoveryCode.deleteMany(),
    testDb.session.deleteMany(),
    testDb.auditLog.deleteMany(),
    testDb.user.deleteMany(),
    testDb.category.deleteMany(),
    testDb.city.deleteMany(),
    testDb.governorate.deleteMany(),
    testDb.platformSetting.deleteMany(),
    testDb.featureFlag.deleteMany(),
    testDb.rateLimitBucket.deleteMany(),
  ]);
}

/** A complete, bookable business with hours, one service and one professional. */
export async function makeBusiness(options: {
  slug: string;
  ownerEmail: string;
  serviceMinutes?: number;
  bufferMinutes?: number;
  autoConfirm?: boolean;
}) {
  const owner = await testDb.user.create({
    data: {
      email: options.ownerEmail,
      passwordHash: 'x',
      firstName: 'Owner',
      lastName: options.slug,
    },
  });

  const business = await testDb.business.create({
    data: {
      ownerId: owner.id,
      slug: options.slug,
      name: options.slug,
      status: 'ACTIVE',
      autoConfirm: options.autoConfirm ?? true,
      minNoticeMinutes: 0,
      maxAdvanceDays: 365,
      slotGranularityMinutes: 30,
      roleGrants: { create: { userId: owner.id, role: 'BUSINESS_OWNER' } },
      hours: {
        create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          startMin: 9 * 60,
          endMin: 19 * 60,
        })),
      },
    },
  });

  const service = await testDb.service.create({
    data: {
      businessId: business.id,
      name: 'Coupe',
      priceAmount: 20,
      durationMinutes: options.serviceMinutes ?? 30,
      bufferMinutes: options.bufferMinutes ?? 0,
    },
  });

  const staff = await testDb.staffMember.create({
    data: { businessId: business.id, displayName: 'Pro', isBookable: true },
  });

  await testDb.staffService.create({
    data: { staffMemberId: staff.id, serviceId: service.id },
  });

  return { owner, business, service, staff };
}

export async function makeCustomer(email: string) {
  return testDb.user.create({
    data: {
      email,
      passwordHash: 'x',
      firstName: 'Client',
      lastName: email.split('@')[0] ?? 'Test',
      roles: { create: { role: 'CUSTOMER' } },
    },
  });
}

/** A future weekday instant at a given local hour, well inside opening hours. */
export function futureSlot(daysAhead: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  // Business hours are 09:00–19:00 local; Tunisia is UTC+1 all year.
  date.setUTCHours(hour - 1, minute, 0, 0);
  return date;
}
