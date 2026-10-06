import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { runSubscriptionLifecycle } from '@/server/services/subscriptions';
import { purgeExpiredSessions } from '@/server/auth/session';
import { purgeExpiredBuckets } from '@/server/rateLimit';

/**
 * Nightly maintenance.
 *
 * Idempotent by construction: it resolves each subscription's effective state
 * from the clock and writes only when it differs, so running it twice in a row
 * changes nothing the second time. Safe to retry after a failure.
 */
async function main() {
  const startedAt = Date.now();

  const lifecycle = await runSubscriptionLifecycle();
  const sessions = await purgeExpiredSessions();
  const buckets = await purgeExpiredBuckets();

  // Reservations nobody ever confirmed, long past their start time, are dead
  // weight on the calendar and on availability.
  const { count: expiredPending } = await db.reservation.updateMany({
    where: { status: 'PENDING', startAt: { lt: new Date(Date.now() - 86_400_000) } },
    data: { status: 'EXPIRED' },
  });

  // Confirmed appointments whose time has passed are marked completed, so a
  // customer can review them and the business's revenue is counted.
  const { count: autoCompleted } = await db.reservation.updateMany({
    where: {
      status: 'CONFIRMED',
      endAt: { lt: new Date(Date.now() - 12 * 3_600_000) },
    },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  logger.info('subscription job complete', {
    ...lifecycle,
    sessionsPurged: sessions,
    bucketsPurged: buckets,
    expiredPending,
    autoCompleted,
    durationMs: Date.now() - startedAt,
  });
}

main()
  .catch((error) => {
    logger.error('subscription job failed', { error: (error as Error).message });
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
