import { PrismaClient } from '@prisma/client';
import { env, isProd } from './env';

/**
 * One client per process. Next.js dev reloads modules, so the instance is
 * parked on globalThis to avoid exhausting the connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['warn', 'error'] : ['warn', 'error'],
    datasources: { db: { url: env.DATABASE_URL } },
  });

if (!isProd) globalForPrisma.prisma = db;

/**
 * Error codes we act on by name rather than by string matching.
 *
 * Prisma does not surface the raw SQLSTATE for a conflict inside an
 * interactive transaction: it collapses serialization failures, deadlocks and
 * exclusion-constraint violations into P2034 ("write conflict or deadlock").
 * Both layers are listed, because the same situation can arrive either way
 * depending on where in the transaction it is detected.
 */
export const PG = {
  UNIQUE_VIOLATION: '23505',
  EXCLUSION_VIOLATION: '23P01',
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK_DETECTED: '40P01',
} as const;

export const PRISMA = {
  UNIQUE_VIOLATION: 'P2002',
  /** Transaction failed due to a write conflict or a deadlock. */
  WRITE_CONFLICT: 'P2034',
  /** Raw query failed; carries the SQLSTATE in meta.code. */
  RAW_QUERY_FAILED: 'P2010',
} as const;

function errorCodes(error: unknown): string[] {
  const e = error as { code?: string; meta?: { code?: string } };
  return [e?.code, e?.meta?.code].filter((c): c is string => typeof c === 'string');
}

/**
 * True when the database refused the write because something else holds the
 * slot — whichever layer reported it.
 */
export function isSlotConflict(error: unknown): boolean {
  const codes = errorCodes(error);
  const conflictCodes = new Set<string>([
    PG.EXCLUSION_VIOLATION,
    PG.SERIALIZATION_FAILURE,
    PG.DEADLOCK_DETECTED,
    PRISMA.WRITE_CONFLICT,
  ]);
  if (codes.some((c) => conflictCodes.has(c))) return true;

  const message = (error as { message?: string })?.message;
  return typeof message === 'string' && message.includes('reservation_no_overlap');
}

/**
 * True when the failure is a transient serialization conflict that is worth
 * retrying, as opposed to a settled "this slot is taken".
 */
export function isRetryableConflict(error: unknown): boolean {
  const codes = errorCodes(error);
  return codes.some((c) =>
    c === PRISMA.WRITE_CONFLICT || c === PG.SERIALIZATION_FAILURE || c === PG.DEADLOCK_DETECTED,
  );
}
