import { db } from '@/lib/db';
import { rateLimited } from '@/lib/errors';

/**
 * Durable fixed-window rate limiting.
 *
 * Kept in Postgres rather than in process memory so the limit holds across the
 * multiple replicas a production deployment runs — an in-memory counter would
 * let an attacker multiply their allowance by the number of instances.
 */
export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 300 },
  twoFactor: { limit: 10, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 3600 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
  booking: { limit: 20, windowSeconds: 600 },
  mediaUpload: { limit: 40, windowSeconds: 600 },
  review: { limit: 10, windowSeconds: 3600 },
  search: { limit: 120, windowSeconds: 60 },
  contact: { limit: 10, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Consume one unit. Throws AppError('RATE_LIMITED') when the window is spent.
 * `identity` should be a user id when known, else the client IP.
 */
export async function consume(
  name: RateLimitName,
  identity: string,
): Promise<{ remaining: number; resetAt: Date }> {
  const rule = RATE_LIMITS[name];
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const key = `${name}:${identity}:${windowStart.getTime()}`;

  const bucket = await db.rateLimitBucket.upsert({
    where: { key },
    create: { key, count: 1, windowAt: windowStart, expiresAt },
    update: { count: { increment: 1 } },
  });

  if (bucket.count > rule.limit) {
    const seconds = Math.ceil((expiresAt.getTime() - now) / 1000);
    throw seconds > 60
      ? rateLimited('retryInMinutes', { count: Math.ceil(seconds / 60) })
      : rateLimited('retryInSeconds', { count: seconds });
  }

  return { remaining: Math.max(0, rule.limit - bucket.count), resetAt: expiresAt };
}

export async function purgeExpiredBuckets(): Promise<number> {
  const { count } = await db.rateLimitBucket.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
