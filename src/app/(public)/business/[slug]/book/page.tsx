import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getBusinessProfile } from '@/server/services/businessProfile';
import { getActor } from '@/server/auth/session';
import { BookingFlow } from '@/components/booking/BookingFlow';
import { canCustomerReschedule } from '@/domain/booking/policy';
import { dayKeyOf } from '@/domain/scheduling/time';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.business.book, robots: { index: false, follow: true } };
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string; staff?: string; reschedule?: string }>;
}) {
  const { slug } = await params;
  const { service, staff, reschedule } = await searchParams;
  const { m, locale } = await translate();

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

  /**
   * Rescheduling reuses this same flow rather than a parallel screen: the
   * customer picks a new slot exactly as they picked the first one. The
   * original is only retired once the replacement is confirmed, so a failed
   * move never costs them their appointment.
   */
  let rescheduling: {
    reservationId: string;
    reference: string;
    currentStartAt: string;
    serviceId: string;
    staffMemberId: string;
  } | null = null;

  if (reschedule) {
    const original = await db.reservation.findFirst({
      // Scoped to this customer and this business: a foreign id resolves to
      // nothing rather than leaking that it exists.
      where: { id: reschedule, customerId: actor.userId, businessId: business.id },
      select: {
        id: true,
        reference: true,
        status: true,
        startAt: true,
        staffMemberId: true,
        items: { select: { serviceId: true }, take: 1 },
        business: {
          select: {
            cancellationWindowHours: true,
            allowCustomerCancel: true,
            allowCustomerReschedule: true,
            minNoticeMinutes: true,
            maxAdvanceDays: true,
          },
        },
      },
    });

    // An appointment the policy no longer allows moving sends the customer
    // back to it, where the reason is spelled out.
    if (!original) redirect(`/business/${slug}/book`);
    const check = canCustomerReschedule(original, original.business, new Date());
    if (!check.allowed) redirect(`/reservations/${original.reference}`);

    const serviceId = original.items[0]?.serviceId;
    if (!serviceId) redirect(`/reservations/${original.reference}`);

    rescheduling = {
      reservationId: original.id,
      reference: original.reference,
      currentStartAt: original.startAt.toISOString(),
      serviceId,
      staffMemberId: original.staffMemberId,
    };
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
      preselectedServiceId={rescheduling?.serviceId ?? service ?? null}
      preselectedStaffId={rescheduling?.staffMemberId ?? staff ?? null}
      rescheduling={rescheduling}
      m={{ booking: m.booking, business: m.business, common: m.common }}
      locale={locale}
    />
  );
}
