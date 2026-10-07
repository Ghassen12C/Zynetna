import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/server/auth/guard';
import { adminBusinesses } from '@/server/services/adminDashboard';
import { AdminBusinessTable } from '@/components/admin/AdminBusinessTable';
import { db } from '@/lib/db';
import { translate } from '@/i18n/server';
import { localizedName } from '@/i18n/format';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.admin.nav.businesses, robots: { index: false } };
}

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; verification?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const { m, locale } = await translate();
  const params = await searchParams;

  const result = await adminBusinesses({
    q: params.q,
    status: params.status,
    verification: params.verification,
    page: Number(params.page ?? 1) || 1,
  });

  // The listing selects the French city name only; translate it here.
  const cities = await db.city.findMany({
    where: { name: { in: result.rows.flatMap((b) => b.location?.city?.name ?? []) } },
    select: { name: true, nameAr: true },
  });
  const cityName = (name: string) => {
    const row = cities.find((c) => c.name === name);
    return row ? localizedName(row, locale) : name;
  };

  return (
    <AdminBusinessTable
      rows={result.rows.map((b) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        status: b.status,
        verification: b.verification,
        ratingAverage: b.ratingAverage,
        ratingCount: b.ratingCount,
        createdAt: b.createdAt.toISOString(),
        ownerEmail: b.owner.email,
        ownerName: `${b.owner.firstName} ${b.owner.lastName}`,
        cityName: b.location?.city ? cityName(b.location.city.name) : null,
        subscriptionStatus: b.subscription?.status ?? null,
        reservations: b._count.reservations,
        services: b._count.services,
        staff: b._count.staff,
      }))}
      total={result.total}
      page={result.page}
      pageCount={result.pageCount}
      filters={params}
      m={{ admin: m.admin, labels: m.labels, common: m.common }}
      locale={locale}
    />
  );
}
