import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { ButtonLink } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Primitives';
import { formatNumber } from '@/i18n/format';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return {
    title: m.footer.about,
    description: m.aboutPage.metaDescription,
    alternates: { canonical: '/about' },
  };
}

export const revalidate = 3600;

export default async function AboutPage() {
  const [businesses, cities, reservations, { m, locale, path }] = await Promise.all([
    db.business.count({ where: { status: 'ACTIVE' } }),
    db.city.count(),
    db.reservation.count(),
    translate(),
  ]);
  const copy = m.aboutPage;

  return (
    <>
      <section className="z-hero">
        <div className="z-container z-pitch__hero">
          <Eyebrow>{m.footer.about}</Eyebrow>
          <h1 className="z-hero__title">
            {copy.heroLine1}
            <br />
            {copy.heroLine2}
          </h1>
          <p className="z-hero__subtitle">{copy.heroBody}</p>
        </div>
      </section>

      <section className="z-section">
        <div className="z-container">
          <div className="z-stats">
            <div className="z-stat">
              <span className="z-stat__value">{formatNumber(businesses, locale)}</span>
              <span className="z-stat__label">{copy.statBusinesses}</span>
            </div>
            <div className="z-stat">
              <span className="z-stat__value">{formatNumber(cities, locale)}</span>
              <span className="z-stat__label">{copy.statCities}</span>
            </div>
            <div className="z-stat">
              <span className="z-stat__value">{formatNumber(reservations, locale)}</span>
              <span className="z-stat__label">{copy.statReservations}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="z-section">
        <div className="z-container">
          {copy.sections.map((section) => (
            <div key={section.title} className="z-pitch__row">
              <div>
                <Eyebrow>{section.eyebrow}</Eyebrow>
                <h2 className="z-section__title">{section.title}</h2>
              </div>
              <div className="z-prose">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="z-section z-section--sunken">
        <div className="z-container" style={{ textAlign: 'center' }}>
          <h2 className="z-section__title">{copy.joinTitle}</h2>
          <p className="z-section__lead" style={{ marginInline: 'auto' }}>
            {copy.joinLead}
          </p>
          <div
            className="z-row"
            style={{ gap: 'var(--z-space-3)', justifyContent: 'center', marginTop: 'var(--z-space-6)', flexWrap: 'wrap' }}
          >
            <ButtonLink href={path('/search')} size="lg">
              {m.account.findPro}
            </ButtonLink>
            <ButtonLink href={path('/pro')} variant="secondary" size="lg">
              {copy.listBusiness}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
