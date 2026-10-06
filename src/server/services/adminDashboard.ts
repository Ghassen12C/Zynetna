import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { resolveStatus, isEntitled, intervalDaysFor } from '@/domain/monetization/lifecycle';

/**
 * Platform analytics for the Super Admin.
 *
 * These are the numbers the platform owner needs to run the marketplace:
 * growth, revenue, conversion and churn — not decorative counters.
 */
export async function platformOverview() {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  const d7 = new Date(now.getTime() - 7 * 86_400_000);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    totalUsers, newUsers30, activeUsers30,
    totalBusinesses, activeBusinesses, pendingBusinesses, suspendedBusinesses,
    totalReservations, todayReservations, weekReservations, monthReservations,
    cancelledReservations, completedRevenue,
    subscriptions, payments30,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: d30 } } }),
    db.user.count({ where: { lastLoginAt: { gte: d30 } } }),
    db.business.count(),
    db.business.count({ where: { status: 'ACTIVE' } }),
    db.business.count({ where: { status: 'PENDING_REVIEW' } }),
    db.business.count({ where: { status: 'SUSPENDED' } }),
    db.reservation.count(),
    db.reservation.count({ where: { startAt: { gte: dayStart } , status: { in: ['PENDING','CONFIRMED','COMPLETED'] } } }),
    db.reservation.count({ where: { createdAt: { gte: d7 } } }),
    db.reservation.count({ where: { createdAt: { gte: monthStart } } }),
    db.reservation.count({
      where: {
        createdAt: { gte: d30 },
        status: { in: ['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_BUSINESS', 'NO_SHOW'] },
      },
    }),
    db.reservation.aggregate({
      where: { status: 'COMPLETED', startAt: { gte: monthStart } },
      _sum: { totalAmount: true },
    }),
    db.subscription.findMany({
      select: {
        status: true, trialEndAt: true, currentEndAt: true, graceEndAt: true,
        plan: { select: { trialDays: true, gracePeriodDays: true, interval: true, priceAmount: true } },
      },
    }),
    db.payment.aggregate({
      where: { status: 'SUCCEEDED', paidAt: { gte: d30 } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  // Effective subscription states, resolved rather than read raw — a row that
  // has lapsed but not yet been swept must not be counted as active.
  const states = subscriptions.map((s) =>
    resolveStatus(s, {
      trialDays: s.plan.trialDays,
      gracePeriodDays: s.plan.gracePeriodDays,
      intervalDays: intervalDaysFor(s.plan.interval),
    }, now),
  );
  const countOf = (status: string) => states.filter((s) => s === status).length;

  const trialing = countOf('TRIALING');
  const active = countOf('ACTIVE');
  const expired = countOf('EXPIRED');
  const cancelled = countOf('CANCELLED');
  const entitled = states.filter(isEntitled).length;

  // Monthly recurring revenue from paying subscriptions only.
  const mrr = subscriptions.reduce((sum, s, i) => {
    if (states[i] !== 'ACTIVE') return sum;
    const monthly =
      s.plan.interval === 'YEAR'
        ? Number(s.plan.priceAmount) / 12
        : Number(s.plan.priceAmount);
    return sum + monthly;
  }, 0);

  const everPaid = active + expired + cancelled;
  const conversionRate = everPaid + trialing > 0
    ? Math.round((active / (active + trialing + expired)) * 100)
    : 0;
  const churnRate = everPaid > 0 ? Math.round(((expired + cancelled) / everPaid) * 100) : 0;

  return {
    users: { total: totalUsers, new30: newUsers30, active30: activeUsers30 },
    businesses: {
      total: totalBusinesses,
      active: activeBusinesses,
      pending: pendingBusinesses,
      suspended: suspendedBusinesses,
    },
    reservations: {
      total: totalReservations,
      today: todayReservations,
      week: weekReservations,
      month: monthReservations,
      cancelled30: cancelledReservations,
      gmvMonth: Number(completedRevenue._sum.totalAmount ?? 0),
    },
    subscriptions: {
      trialing, active, expired, cancelled, entitled,
      mrr: Math.round(mrr * 100) / 100,
      conversionRate,
      churnRate,
      revenue30: Number(payments30._sum.amount ?? 0),
      payments30: payments30._count,
    },
  };
}

/** Daily signups and bookings, for the platform growth chart. */
export async function platformTrend(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);

  const [users, reservations] = await Promise.all([
    db.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
      FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1
    `,
    db.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
      FROM "Reservation" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1
    `,
  ]);

  const key = (d: Date) => d.toISOString().slice(0, 10);
  return {
    users: users.map((r) => ({ day: key(r.day), count: Number(r.count) })),
    reservations: reservations.map((r) => ({ day: key(r.day), count: Number(r.count) })),
  };
}

/** Where the marketplace is actually active. */
export async function geographicDistribution() {
  const rows = await db.$queryRaw<{ city: string; governorate: string; businesses: bigint; reservations: bigint }[]>`
    SELECT c.name AS city,
           g.name AS governorate,
           count(DISTINCT b.id) AS businesses,
           count(r.id) AS reservations
    FROM "City" c
    JOIN "Governorate" g ON g.id = c."governorateId"
    JOIN "BusinessLocation" l ON l."cityId" = c.id
    JOIN "Business" b ON b.id = l."businessId" AND b.status = 'ACTIVE'
    LEFT JOIN "Reservation" r ON r."businessId" = b.id
    GROUP BY 1, 2
    ORDER BY 4 DESC, 3 DESC
    LIMIT 20
  `;
  return rows.map((r) => ({
    city: r.city,
    governorate: r.governorate,
    businesses: Number(r.businesses),
    reservations: Number(r.reservations),
  }));
}

export async function popularCategories() {
  const rows = await db.$queryRaw<{ name: string; businesses: bigint; reservations: bigint }[]>`
    SELECT cat.name,
           count(DISTINCT b.id) AS businesses,
           count(r.id) AS reservations
    FROM "Category" cat
    JOIN "BusinessCategory" bc ON bc."categoryId" = cat.id
    JOIN "Business" b ON b.id = bc."businessId" AND b.status = 'ACTIVE'
    LEFT JOIN "Reservation" r ON r."businessId" = b.id
    WHERE cat."parentId" IS NULL
    GROUP BY 1
    ORDER BY 3 DESC
    LIMIT 10
  `;
  return rows.map((r) => ({
    name: r.name,
    businesses: Number(r.businesses),
    reservations: Number(r.reservations),
  }));
}

export async function topBusinesses(limit = 10) {
  const grouped = await db.reservation.groupBy({
    by: ['businessId'],
    where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    _count: { businessId: true },
    orderBy: { _count: { businessId: 'desc' } },
    take: limit,
  });

  const businesses = await db.business.findMany({
    where: { id: { in: grouped.map((g) => g.businessId) } },
    select: { id: true, name: true, slug: true, ratingAverage: true },
  });
  const byId = new Map(businesses.map((b) => [b.id, b]));

  return grouped
    .map((g) => {
      const business = byId.get(g.businessId);
      return business
        ? { ...business, reservations: g._count.businessId }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export type AdminBusinessFilters = {
  q?: string;
  status?: string;
  verification?: string;
  page?: number;
  perPage?: number;
};

export async function adminBusinesses(filters: AdminBusinessFilters) {
  const perPage = Math.min(100, filters.perPage ?? 25);
  const page = Math.max(1, filters.page ?? 1);

  const where: Prisma.BusinessWhereInput = {};
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      { slug: { contains: filters.q, mode: 'insensitive' } },
      { owner: { email: { contains: filters.q, mode: 'insensitive' } } },
    ];
  }
  if (filters.status) where.status = filters.status as Prisma.EnumBusinessStatusFilter['equals'];
  if (filters.verification) {
    where.verification = filters.verification as Prisma.EnumVerificationStatusFilter['equals'];
  }

  const [rows, total] = await Promise.all([
    db.business.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, slug: true, name: true, status: true, verification: true,
        ratingAverage: true, ratingCount: true, createdAt: true, publishedAt: true,
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        location: { select: { city: { select: { name: true } } } },
        subscription: { select: { status: true, trialEndAt: true, currentEndAt: true } },
        _count: { select: { reservations: true, services: true, staff: true } },
      },
    }),
    db.business.count({ where }),
  ]);

  return { rows, total, page, perPage, pageCount: Math.ceil(total / perPage) };
}

export async function adminUsers(filters: { q?: string; role?: string; status?: string; page?: number }) {
  const perPage = 25;
  const page = Math.max(1, filters.page ?? 1);

  const where: Prisma.UserWhereInput = {};
  if (filters.q) {
    where.OR = [
      { email: { contains: filters.q, mode: 'insensitive' } },
      { firstName: { contains: filters.q, mode: 'insensitive' } },
      { lastName: { contains: filters.q, mode: 'insensitive' } },
      { phone: { contains: filters.q } },
    ];
  }
  if (filters.status) where.status = filters.status as Prisma.EnumUserStatusFilter['equals'];
  if (filters.role) {
    where.roles = { some: { role: filters.role as Prisma.EnumRoleNameFilter['equals'] } };
  }

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        status: true, createdAt: true, lastLoginAt: true, locale: true,
        roles: { select: { role: true, businessId: true } },
        _count: { select: { reservations: true, reviews: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  return { rows, total, page, perPage, pageCount: Math.ceil(total / perPage) };
}
