import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { variantUrl } from './media';
import { dayKeyOf, instantAt } from '@/domain/scheduling/time';

/**
 * Professional dashboard read model.
 *
 * Every function takes a businessId that the caller has already proven access
 * to via requireBusinessAccess — these never resolve a tenant themselves, so
 * there is no second place where isolation could be got wrong.
 */

export async function businessHeader(businessId: string) {
  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: {
      id: true, slug: true, name: true, status: true, verification: true,
      timezone: true, currency: true, publishedAt: true,
      media: {
        where: { role: 'LOGO' },
        take: 1,
        select: { asset: { select: { storageKey: true, variants: true } } },
      },
      subscription: {
        select: {
          status: true, trialEndAt: true, currentEndAt: true,
          plan: { select: { name: true, priceAmount: true, currency: true, trialDays: true } },
        },
      },
      _count: { select: { services: true, staff: true, reviews: true } },
    },
  });

  return {
    ...business,
    logoUrl: business.media[0] ? variantUrl(business.media[0].asset, 'thumb') : null,
  };
}

/** Overview metrics. Revenue counts only honoured appointments. */
export async function overviewMetrics(businessId: string, timezone: string) {
  const now = new Date();
  const today = dayKeyOf(timezone, now);
  const dayStart = instantAt(timezone, today, 0);
  const dayEnd = instantAt(timezone, today, 1440);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    todayAppointments,
    upcoming,
    todayRevenue,
    monthRevenue,
    prevMonthRevenue,
    totalCustomers,
    recentStatusCounts,
    topServices,
    topStaff,
  ] = await Promise.all([
    db.reservation.count({
      where: { businessId, startAt: { gte: dayStart, lt: dayEnd }, status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] } },
    }),
    db.reservation.count({
      where: { businessId, startAt: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } },
    }),
    db.reservation.aggregate({
      where: { businessId, startAt: { gte: dayStart, lt: dayEnd }, status: 'COMPLETED' },
      _sum: { totalAmount: true },
    }),
    db.reservation.aggregate({
      where: { businessId, startAt: { gte: monthStart }, status: 'COMPLETED' },
      _sum: { totalAmount: true },
    }),
    db.reservation.aggregate({
      where: { businessId, startAt: { gte: prevMonthStart, lt: monthStart }, status: 'COMPLETED' },
      _sum: { totalAmount: true },
    }),
    db.reservation.findMany({
      where: { businessId, customerId: { not: null } },
      distinct: ['customerId'],
      select: { customerId: true },
    }),
    db.reservation.groupBy({
      by: ['status'],
      where: { businessId, startAt: { gte: thirtyDaysAgo } },
      _count: { status: true },
    }),
    db.reservationItem.groupBy({
      by: ['serviceName'],
      where: { reservation: { businessId, startAt: { gte: thirtyDaysAgo }, status: { in: ['COMPLETED', 'CONFIRMED'] } } },
      _count: { serviceName: true },
      _sum: { priceAmount: true },
      orderBy: { _count: { serviceName: 'desc' } },
      take: 5,
    }),
    db.reservation.groupBy({
      by: ['staffMemberId'],
      where: { businessId, startAt: { gte: thirtyDaysAgo }, status: { in: ['COMPLETED', 'CONFIRMED'] } },
      _count: { staffMemberId: true },
      orderBy: { _count: { staffMemberId: 'desc' } },
      take: 5,
    }),
  ]);

  const counts = Object.fromEntries(recentStatusCounts.map((r) => [r.status, r._count.status]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const cancelled =
    (counts.CANCELLED_BY_CUSTOMER ?? 0) + (counts.CANCELLED_BY_BUSINESS ?? 0);
  const noShow = counts.NO_SHOW ?? 0;

  const staffNames = await db.staffMember.findMany({
    where: { id: { in: topStaff.map((s) => s.staffMemberId) } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(staffNames.map((s) => [s.id, s.displayName]));

  // New vs returning, over the same 30-day window.
  const customerCounts = await db.reservation.groupBy({
    by: ['customerId'],
    where: { businessId, customerId: { not: null }, status: { in: ['COMPLETED', 'CONFIRMED'] } },
    _count: { customerId: true },
  });
  const returning = customerCounts.filter((c) => c._count.customerId > 1).length;

  const monthTotal = Number(monthRevenue._sum.totalAmount ?? 0);
  const prevTotal = Number(prevMonthRevenue._sum.totalAmount ?? 0);

  return {
    todayAppointments,
    upcoming,
    todayRevenue: Number(todayRevenue._sum.totalAmount ?? 0),
    monthRevenue: monthTotal,
    monthDelta: prevTotal > 0 ? Math.round(((monthTotal - prevTotal) / prevTotal) * 100) : null,
    totalCustomers: totalCustomers.length,
    returningCustomers: returning,
    newCustomers: Math.max(0, totalCustomers.length - returning),
    cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    noShowRate: total > 0 ? Math.round((noShow / total) * 100) : 0,
    topServices: topServices.map((s) => ({
      name: s.serviceName,
      count: s._count.serviceName,
      revenue: Number(s._sum.priceAmount ?? 0),
    })),
    topStaff: topStaff.map((s) => ({
      name: nameById.get(s.staffMemberId) ?? '—',
      count: s._count.staffMemberId,
    })),
  };
}

/** Daily booking counts for the dashboard chart. */
export async function bookingTrend(businessId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db.$queryRaw<{ day: Date; count: bigint; revenue: Prisma.Decimal | null }[]>`
    SELECT date_trunc('day', "startAt") AS day,
           count(*) AS count,
           sum(CASE WHEN status = 'COMPLETED' THEN "totalAmount" ELSE 0 END) AS revenue
    FROM "Reservation"
    WHERE "businessId" = ${businessId}
      AND "startAt" >= ${since}
      AND status NOT IN ('CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_BUSINESS', 'EXPIRED')
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    count: Number(r.count),
    revenue: Number(r.revenue ?? 0),
  }));
}

export async function reservationsFor(
  businessId: string,
  options: {
    from?: Date;
    to?: Date;
    status?: string[];
    staffMemberId?: string;
    take?: number;
    skip?: number;
  } = {},
) {
  const where: Prisma.ReservationWhereInput = { businessId };
  if (options.from || options.to) {
    where.startAt = {
      ...(options.from ? { gte: options.from } : {}),
      ...(options.to ? { lt: options.to } : {}),
    };
  }
  if (options.status?.length) {
    where.status = { in: options.status as Prisma.EnumReservationStatusFilter['in'] };
  }
  if (options.staffMemberId) where.staffMemberId = options.staffMemberId;

  const [rows, total] = await Promise.all([
    db.reservation.findMany({
      where,
      orderBy: { startAt: options.from ? 'asc' : 'desc' },
      take: options.take ?? 50,
      skip: options.skip ?? 0,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        staffMember: { select: { id: true, displayName: true } },
        items: { select: { serviceName: true, durationMinutes: true, priceAmount: true } },
      },
    }),
    db.reservation.count({ where }),
  ]);

  return { rows, total };
}

/**
 * Customers who have booked with this business.
 * Only what a business legitimately needs to run an appointment is exposed.
 */
export async function businessCustomers(businessId: string, take = 100) {
  const grouped = await db.reservation.groupBy({
    by: ['customerId'],
    where: { businessId, customerId: { not: null } },
    _count: { customerId: true },
    _max: { startAt: true },
    _sum: { totalAmount: true },
    orderBy: { _max: { startAt: 'desc' } },
    take,
  });

  const ids = grouped.map((g) => g.customerId).filter((id): id is string => Boolean(id));
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  // Completed-only counts, so "visits" means visits rather than attempts.
  const completed = await db.reservation.groupBy({
    by: ['customerId'],
    where: { businessId, customerId: { in: ids }, status: 'COMPLETED' },
    _count: { customerId: true },
  });
  const completedById = new Map(completed.map((c) => [c.customerId, c._count.customerId]));

  return grouped
    .map((g) => {
      const user = g.customerId ? byId.get(g.customerId) : null;
      if (!user) return null;
      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        phone: user.phone,
        email: user.email,
        bookings: g._count.customerId,
        completed: completedById.get(user.id) ?? 0,
        lastVisit: g._max.startAt,
        totalSpent: Number(g._sum.totalAmount ?? 0),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function businessReviews(businessId: string, take = 50) {
  return db.review.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      customer: { select: { firstName: true, lastName: true } },
      response: true,
      reservation: { select: { reference: true, items: { select: { serviceName: true }, take: 1 } } },
    },
  });
}
