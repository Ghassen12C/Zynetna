import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storage } from '@/server/providers/storage';

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
    checks.database = { ok: false, detail: (error as Error).message };
  }

  checks.storage = { ok: true, detail: storage.name };

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { status: ok ? 'ok' : 'degraded', checks, time: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
