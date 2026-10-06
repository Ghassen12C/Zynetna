import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { CalendarView } from '@/components/pro/CalendarView';
import { proContext } from '@/components/pro/ProGuard';
import { reservationsFor } from '@/server/services/proDashboard';
import { addDays, dayKeyOf, instantAt } from '@/domain/scheduling/time';

export const metadata: Metadata = { title: 'Agenda', robots: { index: false } };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; view?: string; staff?: string }>;
}) {
  const { businessId } = await proContext('business.reservation.read', '/pro/dashboard/calendar');
  const params = await searchParams;

  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { timezone: true, hours: true },
  });

  const view = params.view === 'day' ? 'day' : 'week';
  const today = dayKeyOf(business.timezone, new Date());
  const from = params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : today;
  const span = view === 'day' ? 1 : 7;

  const [{ rows }, staff] = await Promise.all([
    reservationsFor(businessId, {
      from: instantAt(business.timezone, from, 0),
      to: instantAt(business.timezone, addDays(from, span), 0),
      staffMemberId: params.staff,
      take: 500,
    }),
    db.staffMember.findMany({
      where: { businessId, isActive: true },
      orderBy: { position: 'asc' },
      select: { id: true, displayName: true },
    }),
  ]);

  // Earliest opening and latest closing across the week set the visible band,
  // so an empty 00:00–08:00 strip is never rendered.
  const startMin = business.hours.length
    ? Math.min(...business.hours.map((h) => h.startMin))
    : 8 * 60;
  const endMin = business.hours.length
    ? Math.max(...business.hours.map((h) => h.endMin))
    : 20 * 60;

  return (
    <CalendarView
      timezone={business.timezone}
      from={from}
      today={today}
      view={view}
      span={span}
      dayStartMin={Math.max(0, startMin - 30)}
      dayEndMin={Math.min(1440, endMin + 30)}
      staff={staff}
      selectedStaff={params.staff ?? null}
      events={rows.map((r) => ({
        id: r.id,
        reference: r.reference,
        status: r.status,
        startAt: r.startAt.toISOString(),
        endAt: r.endAt.toISOString(),
        customerName: r.customer
          ? `${r.customer.firstName} ${r.customer.lastName}`
          : (r.guestName ?? 'Client'),
        staffName: r.staffMember.displayName,
        serviceName: r.items[0]?.serviceName ?? '—',
      }))}
    />
  );
}
