import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { runDueReminders } from '@/server/services/notifications';

/**
 * Appointment reminders. Runs frequently (every 10–15 minutes); each dispatch
 * flips the row to SENT, so a reminder is delivered exactly once.
 */
async function main() {
  const result = await runDueReminders();
  logger.info('reminder job complete', result);
}

main()
  .catch((error) => {
    logger.error('reminder job failed', { error: (error as Error).message });
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
