import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getBusinessProfile } from '@/server/services/businessProfile';
import { getActor } from '@/server/auth/session';
import { BookingFlow } from '@/components/booking/BookingFlow';
import { dayKeyOf } from '@/domain/scheduling/time';

export const metadata: Metadata = {
  title: 'Réserver',
  robots: { index: false, follow: true },
};

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string; staff?: string }>;
}) {
  const { slug } = await params;
  const { service, staff } = await searchParams;

  const business = await getBusinessProfile(slug);
  if (!business) notFound();

  // Signing in is required to book, so the appointment belongs to an account
  // that can later cancel, reschedule and review it.
  const actor = await getActor();
  if (!actor) {
    const target = `/business/${slug}/book${service ? `?service=${service}` : ''}`;
    redirect(`/login?redirectTo=${encodeURIComponent(target)}`);
  }

  if (!business.bookable) {
    redirect(`/business/${slug}`);
  }

  return (
    <BookingFlow
      business={{
        id: business.id,
        slug: business.slug,
        name: business.name,
        currency: business.currency,
        timezone: business.timezone,
        maxAdvanceDays: business.maxAdvanceDays,
        minNoticeMinutes: business.minNoticeMinutes,
        cancellationWindowHours: business.cancellationWindowHours,
        cancellationPolicy: business.cancellationPolicy,
        autoConfirm: business.autoConfirm,
        logoUrl: business.logo?.thumbUrl ?? null,
        addressLine: business.location
          ? `${business.location.addressLine1}, ${business.location.city?.name ?? ''}`
          : null,
      }}
      services={business.services}
      staff={business.staff}
      today={dayKeyOf(business.timezone, new Date())}
      preselectedServiceId={service ?? null}
      preselectedStaffId={staff ?? null}
    />
  );
}
