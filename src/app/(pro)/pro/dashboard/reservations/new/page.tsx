import type { Metadata } from 'next';
import Link from 'next/link';
import { proContext } from '@/components/pro/ProGuard';
import { walkInOptionsAction } from '@/server/actions/walkIn';
import { WalkInForm } from '@/components/pro/WalkInForm';

export const metadata: Metadata = {
  title: 'Nouveau rendez-vous',
  robots: { index: false },
};

export default async function NewReservationPage() {
  const { businessId } = await proContext(
    'business.reservation.write',
    '/pro/dashboard/reservations/new',
  );
  const options = await walkInOptionsAction(businessId);

  return (
    <div className="z-stack z-stack--lg">
      <header className="z-page-head">
        <nav aria-label="Fil d’Ariane" className="z-breadcrumb">
          <Link href="/pro/dashboard/reservations">Réservations</Link>
          <span aria-hidden="true">/</span>
          <span>Nouveau</span>
        </nav>
        <h1 className="z-h2">Nouveau rendez-vous</h1>
        <p className="z-body">
          Pour une personne venue au salon ou qui vous a appelée. Le rendez-vous apparaît
          dans votre file et bloque le créneau comme une réservation en ligne.
        </p>
      </header>
      <WalkInForm
        businessId={businessId}
        services={options.services}
        staff={options.staff}
        currency={options.currency}
        timezone={options.timezone}
      />
    </div>
  );
}
