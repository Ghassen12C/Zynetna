import type { Metadata } from 'next';
import Link from 'next/link';
import { proContext } from '@/components/pro/ProGuard';
import { walkInOptionsAction } from '@/server/actions/walkIn';
import { WalkInForm } from '@/components/pro/WalkInForm';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dash.shared.newAppointment, robots: { index: false } };
}

export default async function NewReservationPage() {
  const { businessId } = await proContext(
    'business.reservation.write',
    '/pro/dashboard/reservations/new',
  );
  const [options, { m, locale, path }] = await Promise.all([
    walkInOptionsAction(businessId),
    translate(),
  ]);
  const d = m.dash.walkIn;

  return (
    <div className="z-stack z-stack--lg">
      <header className="z-page-head">
        <nav aria-label={d.breadcrumb} className="z-breadcrumb">
          <Link href={path('/pro/dashboard/reservations')}>{m.dash.nav.reservations}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{d.crumbNew}</span>
        </nav>
        <h1 className="z-h2">{m.dash.shared.newAppointment}</h1>
        <p className="z-body">{d.intro}</p>
      </header>
      <WalkInForm
        m={{
          walkIn: d,
          channel: m.labels.channel,
          common: m.common,
        }}
        locale={locale}
        businessId={businessId}
        services={options.services}
        staff={options.staff}
        currency={options.currency}
        timezone={options.timezone}
      />
    </div>
  );
}
