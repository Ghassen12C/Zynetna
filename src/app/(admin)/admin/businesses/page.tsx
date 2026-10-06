import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/server/auth/guard';
import { adminBusinesses } from '@/server/services/adminDashboard';
import { AdminBusinessTable } from '@/components/admin/AdminBusinessTable';

export const metadata: Metadata = { title: 'Établissements', robots: { index: false } };

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; verification?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;

  const result = await adminBusinesses({
    q: params.q,
    status: params.status,
    verification: params.verification,
    page: Number(params.page ?? 1) || 1,
  });

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
        cityName: b.location?.city?.name ?? null,
        subscriptionStatus: b.subscription?.status ?? null,
        reservations: b._count.reservations,
        services: b._count.services,
        staff: b._count.staff,
      }))}
      total={result.total}
      page={result.page}
      pageCount={result.pageCount}
      filters={params}
    />
  );
}
