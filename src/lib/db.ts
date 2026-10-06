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

/** Postgres error codes we act on by name rather than by string matching. */
export const PG = {
  UNIQUE_VIOLATION: 'P2002',
  EXCLUSION_VIOLATION: '23P01',
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK_DETECTED: '40P01',
} as const;

/** True when the error is Postgres refusing an overlapping reservation. */
export function isSlotConflict(error: unknown): boolean {
  const e = error as { code?: string; meta?: { code?: string }; message?: string };
  const code = e?.code ?? e?.meta?.code;
  return (
    code === PG.EXCLUSION_VIOLATION ||
    code === PG.SERIALIZATION_FAILURE ||
    code === PG.DEADLOCK_DETECTED ||
    (typeof e?.message === 'string' && e.message.includes('reservation_no_overlap'))
  );
}
