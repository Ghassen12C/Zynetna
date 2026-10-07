import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/server/auth/guard';
import { adminUsers } from '@/server/services/adminDashboard';
import { AdminUserTable } from '@/components/admin/AdminUserTable';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.admin.nav.users, robots: { index: false } };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }>;
}) {
  const actor = await requireSuperAdmin();
  const { m, locale } = await translate();
  const params = await searchParams;

  const result = await adminUsers({
    q: params.q,
    role: params.role,
    status: params.status,
    page: Number(params.page ?? 1) || 1,
  });

  return (
    <AdminUserTable
      currentUserId={actor.userId}
      rows={result.rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: `${u.firstName} ${u.lastName}`,
        phone: u.phone,
        status: u.status,
        locale: u.locale,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        roles: [...new Set(u.roles.map((r) => r.role))],
        reservations: u._count.reservations,
        reviews: u._count.reviews,
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
