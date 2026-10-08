import { NextResponse } from 'next/server';
import { touchSession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/ping — "this person is still here". Sent by the idle watcher
 * while someone is actively using a page that makes no requests (typing a
 * long form, reading the agenda), so their session is not ended under them.
 * Who: anyone; it only refreshes the caller's own session, and answers 401
 * when there is none (already expired, revoked, or signed out elsewhere).
 */
export async function POST() {
  return new NextResponse(null, { status: (await touchSession()) ? 204 : 401 });
}
