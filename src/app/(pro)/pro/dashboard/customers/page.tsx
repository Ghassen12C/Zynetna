import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/Primitives';
import { proContext } from '@/components/pro/ProGuard';
import { businessCustomers } from '@/server/services/proDashboard';
import { db } from '@/lib/db';
import { formatDate, formatPhone, formatPrice } from '@/i18n/format';

export const metadata: Metadata = { title: 'Clients', robots: { index: false } };

export default async function CustomersPage() {
  const { businessId } = await proContext('business.customer.read', '/pro/dashboard/customers');

  const [customers, business] = await Promise.all([
    businessCustomers(businessId),
    db.business.findUniqueOrThrow({ where: { id: businessId }, select: { currency: true } }),
  ]);

  if (customers.length === 0) {
    return (
      <EmptyState
        title="Aucun client pour l’instant"
        body="Les clients qui réservent chez vous via Zynetna apparaîtront ici."
      />
    );
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-4)' }}>
      <div>
        <h2 className="z-profile__h3">Clients ({customers.length})</h2>
        <p className="z-policy">
          Seules les informations nécessaires au rendez-vous sont visibles. Elles ne doivent
          servir qu’à la relation avec vos clients.
        </p>
      </div>

      <div className="z-table--scroll">
        <table className="z-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Contact</th>
              <th>Rendez-vous</th>
              <th>Honorés</th>
              <th>Dernière visite</th>
              <th>Total dépensé</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <strong>{customer.name}</strong>
                  {customer.completed >= 3 ? (
                    <>
                      <br />
                      <span className="z-badge z-badge--gold">Fidèle</span>
                    </>
                  ) : null}
                </td>
                <td>
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`}>{formatPhone(customer.phone)}</a>
                  ) : (
                    <span className="z-help">—</span>
                  )}
                  <br />
                  <span className="z-help">{customer.email}</span>
                </td>
                <td>{customer.bookings}</td>
                <td>{customer.completed}</td>
                <td>{customer.lastVisit ? formatDate(customer.lastVisit) : '—'}</td>
                <td>{formatPrice(customer.totalSpent, 'fr', business.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
