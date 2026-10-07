import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storage } from '@/server/providers/storage';
import { isProd } from '@/lib/env';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Readiness probe. Reports the dependencies a request actually needs, so a
 * container with a broken database is taken out of rotation rather than
 * serving errors.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (error) {
    // The endpoint is public: the raw driver message can name hosts and
    // users, so production reports only that the check failed and logs the rest.
    logger.error('health check: database unreachable', { error: (error as Error).message });
    checks.database = { ok: false, ...(isProd ? {} : { detail: (error as Error).message }) };
  }

  checks.storage = { ok: true, detail: storage.name };

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      // The commit the running image was built from, so a deploy can confirm
      // the new release is the one answering.
      version: process.env.APP_VERSION ?? 'dev',
      checks,
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
