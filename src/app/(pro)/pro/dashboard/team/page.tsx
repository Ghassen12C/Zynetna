import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { TeamManager } from '@/components/pro/TeamManager';
import { proContext } from '@/components/pro/ProGuard';
import { variantUrl } from '@/server/services/media';
import { listInvitations } from '@/server/services/invitations';
import { InvitationsPanel } from '@/components/pro/InvitationsPanel';
import { can } from '@/domain/identity/actor';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.pro.team, robots: { index: false } };
}

export default async function TeamPage() {
  const { m, locale } = await translate();
  const { actor, businessId } = await proContext('business.staff.read', '/pro/dashboard/team');

  // Only someone who may change the team sees the invitation controls at all.
  const canInvite = can(actor, 'business.staff.write', { businessId });

  const [staff, services, invitations] = await Promise.all([
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
    canInvite ? listInvitations(businessId) : Promise.resolve([]),
  ]);

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-8)' }}>
      <TeamManager
        m={{ dashSetup: m.dashSetup, common: m.common }}
        locale={locale}
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

      {canInvite ? (
        <InvitationsPanel
          m={{ dashSetup: m.dashSetup, common: m.common }}
          businessId={businessId}
          invitations={invitations.map((i) => ({
            id: i.id,
            email: i.email,
            role: i.role,
            status: i.status,
            expiresAt: i.expiresAt.toISOString(),
            invitedByName: i.invitedByName,
          }))}
          unlinkedStaff={staff
            .filter((s) => !s.userId && s.isActive)
            .map((s) => ({ id: s.id, displayName: s.displayName }))}
        />
      ) : null}
    </div>
  );
}
