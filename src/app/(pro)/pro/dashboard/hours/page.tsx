import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { HoursManager } from '@/components/pro/HoursManager';
import { proContext } from '@/components/pro/ProGuard';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dashSetup.hours.title, robots: { index: false } };
}

export default async function HoursPage() {
  const { m, locale } = await translate();
  const { businessId } = await proContext('business.read', '/pro/dashboard/hours');

  const [hours, exceptions, staff, staffHours] = await Promise.all([
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
    db.staffHours.findMany({
      where: { staffMember: { businessId, isActive: true } },
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
      select: { staffMemberId: true, weekday: true, startMin: true, endMin: true },
    }),
  ]);

  return (
    <HoursManager
      m={{ dashSetup: m.dashSetup, common: m.common, labels: m.labels }}
      locale={locale}
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
      staffHours={staffHours}
    />
  );
}
