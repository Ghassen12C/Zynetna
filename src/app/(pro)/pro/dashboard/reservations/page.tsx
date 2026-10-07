import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { ReservationsTable } from '@/components/pro/ReservationsTable';
import { proContext } from '@/components/pro/ProGuard';
import { reservationsFor } from '@/server/services/proDashboard';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dash.nav.reservations, robots: { index: false } };
}

export default async function ProReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; staff?: string; page?: string; created?: string }>;
}) {
  const { businessId } = await proContext('business.reservation.read', '/pro/dashboard/reservations');
  const [params, { m, locale }] = await Promise.all([searchParams, translate()]);
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const perPage = 25;

  const [{ rows, total }, staff, business] = await Promise.all([
    reservationsFor(businessId, {
      status: params.status ? [params.status] : undefined,
      staffMemberId: params.staff,
      take: perPage,
      skip: (page - 1) * perPage,
    }),
    db.staffMember.findMany({
      where: { businessId },
      orderBy: { position: 'asc' },
      select: { id: true, displayName: true },
    }),
    db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { timezone: true, currency: true },
    }),
  ]);

  return (
    <ReservationsTable
      m={{
        reservations: m.dash.reservations,
        shared: m.dash.shared,
        status: m.status,
        common: m.common,
      }}
      locale={locale}
      businessId={businessId}
      timezone={business.timezone}
      currency={business.currency}
      rows={rows.map((r) => ({
        id: r.id,
        reference: r.reference,
        status: r.status,
        startAt: r.startAt.toISOString(),
        customerName: r.customer
          ? `${r.customer.firstName} ${r.customer.lastName}`
          : (r.guestName ?? m.dash.shared.guest),
        customerPhone: r.customer?.phone ?? r.guestPhone ?? null,
        staffName: r.staffMember.displayName,
        serviceName: r.items[0]?.serviceName ?? '—',
        amount: Number(r.totalAmount),
        customerNote: r.customerNote,
        internalNote: r.internalNote,
      }))}
      staff={staff}
      total={total}
      page={page}
      perPage={perPage}
      filters={params}
      created={params.created}
    />
  );
}
