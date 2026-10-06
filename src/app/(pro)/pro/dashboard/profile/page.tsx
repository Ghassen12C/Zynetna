import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { BusinessProfileEditor } from '@/components/pro/BusinessProfileEditor';
import { proContext } from '@/components/pro/ProGuard';

export const metadata: Metadata = { title: 'Mon établissement', robots: { index: false } };

export default async function ProProfilePage() {
  const { businessId } = await proContext('business.read', '/pro/dashboard/profile');

  const [business, cities] = await Promise.all([
    db.business.findUniqueOrThrow({
      where: { id: businessId },
      include: {
        location: true,
        _count: { select: { services: true, staff: true, hours: true } },
      },
    }),
    db.city.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, governorate: { select: { name: true } } },
    }),
  ]);

  return (
    <BusinessProfileEditor
      businessId={businessId}
      business={{
        name: business.name,
        slug: business.slug,
        tagline: business.tagline,
        description: business.description,
        story: business.story,
        servedGender: business.servedGender,
        phone: business.phone,
        whatsapp: business.whatsapp,
        email: business.email,
        website: business.website,
        instagram: business.instagram,
        facebook: business.facebook,
        tiktok: business.tiktok,
        status: business.status,
        autoConfirm: business.autoConfirm,
        slotGranularityMinutes: business.slotGranularityMinutes,
        minNoticeMinutes: business.minNoticeMinutes,
        maxAdvanceDays: business.maxAdvanceDays,
        cancellationWindowHours: business.cancellationWindowHours,
        allowCustomerCancel: business.allowCustomerCancel,
        allowCustomerReschedule: business.allowCustomerReschedule,
        cancellationPolicy: business.cancellationPolicy,
        noShowPolicy: business.noShowPolicy,
        bookingNotice: business.bookingNotice,
      }}
      location={
        business.location
          ? {
              cityId: business.location.cityId,
              addressLine1: business.location.addressLine1,
              addressLine2: business.location.addressLine2,
              postalCode: business.location.postalCode,
              latitude: business.location.latitude,
              longitude: business.location.longitude,
              directions: business.location.directions,
            }
          : null
      }
      cities={cities.map((c) => ({ id: c.id, label: `${c.name} (${c.governorate.name})` }))}
      readiness={{
        services: business._count.services,
        staff: business._count.staff,
        hours: business._count.hours,
        hasLocation: Boolean(business.location),
      }}
    />
  );
}
