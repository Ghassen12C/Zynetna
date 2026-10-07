import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/Primitives';
import { proContext } from '@/components/pro/ProGuard';
import { businessCustomers } from '@/server/services/proDashboard';
import { db } from '@/lib/db';
import { formatDate, formatNumber, formatPhone, formatPrice } from '@/i18n/format';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dash.nav.customers, robots: { index: false } };
}

export default async function CustomersPage() {
  const { businessId } = await proContext('business.customer.read', '/pro/dashboard/customers');

  const [customers, business, { m, locale, t }] = await Promise.all([
    businessCustomers(businessId),
    db.business.findUniqueOrThrow({ where: { id: businessId }, select: { currency: true } }),
    translate(),
  ]);
  const d = m.dash.customers;

  if (customers.length === 0) {
    return (
      <EmptyState
        title={d.emptyTitle}
        body={d.emptyBody}
      />
    );
  }

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-4)' }}>
      <div>
        <h2 className="z-profile__h3">
          {t(d.title, { count: formatNumber(customers.length, locale) })}
        </h2>
        <p className="z-policy">{d.privacy}</p>
      </div>

      <div className="z-table--scroll">
        <table className="z-table">
          <thead>
            <tr>
              <th>{d.colCustomer}</th>
              <th>{d.colContact}</th>
              <th>{d.colBookings}</th>
              <th>{d.colCompleted}</th>
              <th>{d.colLastVisit}</th>
              <th>{d.colTotalSpent}</th>
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
                      <span className="z-badge z-badge--gold" title={d.regularHint}>
                        {d.regular}
                      </span>
                    </>
                  ) : null}
                </td>
                <td>
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} dir="ltr">
                      {formatPhone(customer.phone)}
                    </a>
                  ) : (
                    <span className="z-help">—</span>
                  )}
                  <br />
                  <span className="z-help z-dash__wrap" dir="ltr">
                    {customer.email}
                  </span>
                </td>
                <td>{formatNumber(customer.bookings, locale)}</td>
                <td>{formatNumber(customer.completed, locale)}</td>
                <td>{customer.lastVisit ? formatDate(customer.lastVisit, locale) : '—'}</td>
                <td>{formatPrice(customer.totalSpent, locale, business.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
