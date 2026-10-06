import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { safeEqual } from '@/server/auth/hash';
import { runSubscriptionLifecycle } from '@/server/services/subscriptions';
import { runDueReminders } from '@/server/services/notifications';
import { purgeExpiredSessions } from '@/server/auth/session';
import { purgeExpiredBuckets } from '@/server/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * HTTP entry point for the scheduled jobs, so a platform scheduler (Azure
 * Container Apps Job, a cron container, or an external pinger) can drive them
 * without shell access.
 *
 * Authenticated with a shared token compared in constant time. Without a valid
 * token the endpoint is indistinguishable from a missing route.
 */
const JOBS = {
  subscriptions: async () => runSubscriptionLifecycle(),
  reminders: async () => runDueReminders(),
  cleanup: async () => ({
    sessions: await purgeExpiredSessions(),
    buckets: await purgeExpiredBuckets(),
  }),
} as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!provided || !safeEqual(provided, env.JOB_TOKEN)) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, { status: 404 });
  }

  const { name } = await context.params;
  const job = JOBS[name as keyof typeof JOBS];
  if (!job) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, { status: 404 });
  }

  try {
    const result = await job();
    logger.info('job executed via http', { job: name });
    return NextResponse.json({ job: name, result });
  } catch (error) {
    logger.error('job failed via http', { job: name, error: (error as Error).message });
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Job failed.' } },
      { status: 500 },
    );
  }
}
