import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { HoursManager } from '@/components/pro/HoursManager';
import { proContext } from '@/components/pro/ProGuard';

export const metadata: Metadata = { title: 'Horaires', robots: { index: false } };

export default async function HoursPage() {
  const { businessId } = await proContext('business.read', '/pro/dashboard/hours');

  const [hours, exceptions, staff] = await Promise.all([
    db.businessHours.findMany({
      where: { businessId },
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
    }),
    db.scheduleException.findMany({
      where: { businessId, OR: [{ endDate: null, date: { gte: new Date() } }, { endDate: { gte: new Date() } }] },
      orderBy: { date: 'asc' },
      include: { staffMember: { select: { displayName: true } } },
    }),
    db.staffMember.findMany({
      where: { businessId, isActive: true },
      orderBy: { position: 'asc' },
      select: { id: true, displayName: true },
    }),
  ]);

  return (
    <HoursManager
      businessId={businessId}
      hours={hours.map((h) => ({ weekday: h.weekday, startMin: h.startMin, endMin: h.endMin }))}
      exceptions={exceptions.map((e) => ({
        id: e.id,
        kind: e.kind,
        date: e.date.toISOString().slice(0, 10),
        endDate: e.endDate?.toISOString().slice(0, 10) ?? null,
        startMin: e.startMin,
        endMin: e.endMin,
        reason: e.reason,
        staffName: e.staffMember?.displayName ?? null,
      }))}
      staff={staff}
    />
  );
}
