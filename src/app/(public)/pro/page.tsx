import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, Eyebrow } from '@/components/ui/Primitives';
import { db } from '@/lib/db';
import { formatCount, formatPrice } from '@/i18n/format';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return {
    title: m.nav.forPros,
    description: m.proPage.metaDescription,
    alternates: { canonical: '/pro' },
  };
}

export const revalidate = 3600;

export default async function ProPitchPage() {
  const [plan, businessCount, { m, t, locale, path }] = await Promise.all([
    db.subscriptionPlan.findFirst({ where: { isDefault: true } }),
    db.business.count({ where: { status: 'ACTIVE' } }),
    translate(),
  ]);
  const copy = m.proPage;

  const price = plan
    ? formatPrice(Number(plan.priceAmount), locale, plan.currency)
    : formatPrice(30, locale);
  const trialMonths = Math.round((plan?.trialDays ?? 60) / 30);
  const trial = formatCount(copy.trialFree, trialMonths, locale);

  return (
    <>
      <section className="z-hero">
        <div className="z-container z-pitch__hero">
          <Badge tone="gold">{trial}</Badge>
          <h1 className="z-hero__title">
            {copy.heroLine1}
            <br />
            {copy.heroLine2}
          </h1>
          <p className="z-hero__subtitle">{copy.heroBody}</p>
          <div className="z-row" style={{ gap: 'var(--z-space-3)', flexWrap: 'wrap' }}>
            <ButtonLink href={path('/register/pro')} size="lg">
              {m.footer.createBusiness}
            </ButtonLink>
            <ButtonLink href={path('/search')} variant="secondary" size="lg">
              {copy.seeMarketplace}
            </ButtonLink>
          </div>
          <p className="z-policy">
            {t(copy.terms, { trial, price })}
            {businessCount > 0 ? ` ${formatCount(copy.alreadyCount, businessCount, locale)}` : ''}
          </p>
        </div>
      </section>

      <section className="z-section">
        <div className="z-container">
          {copy.pillars.map((pillar, index) => (
            <div key={pillar.title} className="z-pitch__row">
              <div>
                <Eyebrow>0{index + 1}</Eyebrow>
                <h2 className="z-section__title">{pillar.title}</h2>
                <p className="z-section__lead">{pillar.body}</p>
              </div>
              <ul className="z-procta__list z-pitch__points">
                {pillar.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="z-section z-section--sunken">
        <div className="z-container">
          <div className="z-section__head">
            <div>
              <Eyebrow>{copy.pricingEyebrow}</Eyebrow>
              <h2 className="z-section__title">{copy.pricingTitle}</h2>
              <p className="z-section__lead">{copy.pricingLead}</p>
            </div>
          </div>

          <div className="z-pricing">
            <div className="z-pricing__card">
              <Eyebrow>{copy.planName}</Eyebrow>
              <p className="z-pricing__free">{trial}</p>
              <p className="z-pricing__then">{t(copy.thenPerMonth, { price })}</p>
              <ul className="z-procta__list">
                {copy.planFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <ButtonLink href={path('/register/pro')} size="lg" block>
                {m.home.proCtaButton}
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="z-section">
        <div className="z-container">
          <div className="z-section__head">
            <div>
              <Eyebrow>{copy.faqEyebrow}</Eyebrow>
              <h2 className="z-section__title">{copy.faqTitle}</h2>
            </div>
          </div>
          <div className="z-faq">
            {copy.faq.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
