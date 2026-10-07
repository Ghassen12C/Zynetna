import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { BusinessProfileEditor } from '@/components/pro/BusinessProfileEditor';
import { proContext } from '@/components/pro/ProGuard';
import { translate } from '@/i18n/server';
import { localizedName } from '@/i18n/format';
import { LOCALE_META } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.pro.profile, robots: { index: false } };
}

export default async function ProProfilePage() {
  const { m, locale } = await translate();
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
      select: {
        id: true,
        name: true,
        nameAr: true,
        governorate: { select: { name: true, nameAr: true } },
      },
    }),
  ]);

  // Place names carry their own translations; sort in the reader's alphabet.
  const collator = new Intl.Collator(LOCALE_META[locale].intl);
  const cityOptions = cities
    .map((c) => ({
      id: c.id,
      label: `${localizedName(c, locale)} (${localizedName(c.governorate, locale)})`,
    }))
    .sort((a, b) => collator.compare(a.label, b.label));

  return (
    <BusinessProfileEditor
      m={{ dashSetup: m.dashSetup, common: m.common, labels: m.labels }}
      locale={locale}
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
      cities={cityOptions}
      readiness={{
        services: business._count.services,
        staff: business._count.staff,
        hours: business._count.hours,
        hasLocation: Boolean(business.location),
      }}
    />
  );
}
