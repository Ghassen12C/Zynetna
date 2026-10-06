import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { TeamManager } from '@/components/pro/TeamManager';
import { proContext } from '@/components/pro/ProGuard';
import { variantUrl } from '@/server/services/media';

export const metadata: Metadata = { title: 'Équipe', robots: { index: false } };

export default async function TeamPage() {
  const { businessId } = await proContext('business.staff.read', '/pro/dashboard/team');

  const [staff, services] = await Promise.all([
    db.staffMember.findMany({
      where: { businessId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        avatar: true,
        services: { select: { serviceId: true } },
        _count: { select: { reservations: true } },
      },
    }),
    db.service.findMany({
      where: { businessId },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, isActive: true },
    }),
  ]);

  return (
    <TeamManager
      businessId={businessId}
      staff={staff.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        title: s.title,
        bio: s.bio,
        specialties: s.specialties,
        isBookable: s.isBookable,
        isActive: s.isActive,
        serviceIds: s.services.map((x) => x.serviceId),
        avatarUrl: s.avatar ? variantUrl(s.avatar, 'thumb') : null,
        reservationCount: s._count.reservations,
      }))}
      services={services}
    />
  );
}
