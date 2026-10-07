import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, Eyebrow } from '@/components/ui/Primitives';
import { BusinessCard } from '@/components/business/BusinessCard';
import { Rail } from '@/components/ui/Rail';
import { WelcomeAvatar } from '@/components/marketing/Avatar';
import { SearchBar } from '@/components/marketing/SearchBar';
import { translate } from '@/i18n/server';
import { formatCount, formatPrice, localizedName } from '@/i18n/format';
import { publicPlan } from '@/server/services/subscriptions';
import {
  featuredBusinesses,
  listCities,
  popularBusinesses,
  topCategories,
} from '@/server/services/marketplace';
import { CategoryIcon } from '@/components/brand/CategoryIcon';

export const revalidate = 300;

export default async function HomePage() {
  const { m, t, locale, path } = await translate();
  const [categories, featured, popular, cities, plan] = await Promise.all([
    topCategories(8),
    featuredBusinesses(8),
    popularBusinesses(4),
    listCities(),
    publicPlan(),
  ]);

  const steps = [
    { title: m.home.step1Title, body: m.home.step1Body },
    { title: m.home.step2Title, body: m.home.step2Body },
    { title: m.home.step3Title, body: m.home.step3Body },
  ];

  const benefits = [
    m.home.benefitPage,
    m.home.benefitBooking,
    m.home.benefitCatalog,
    m.home.benefitTeam,
    m.home.benefitCustomers,
    m.home.benefitStats,
  ];

  // Trial length and price come from the active plan, so changing the offer is
  // a row in the database rather than an edit to this page.
  const trialMonths = plan ? Math.round(plan.trialDays / 30) : null;
  const price = plan ? formatPrice(Number(plan.priceAmount), locale, plan.currency) : null;

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="z-hero">
        <div className="z-container z-hero__grid">
          <div className="z-hero__copy">
            {trialMonths ? (
              <Badge tone="gold">{t(m.home.trialBadgeLong, { months: trialMonths })}</Badge>
            ) : null}
            <h1 className="z-hero__title">{m.home.heroTitle}</h1>
            <p className="z-hero__subtitle">{m.home.heroSubtitleLong}</p>

            <div className="z-hero__search">
              <SearchBar
                cities={cities.map((c) => ({ slug: c.slug, name: localizedName(c, locale) }))}
                m={{ search: m.search, home: m.home }}
                searchPath={path('/search')}
              />
            </div>

            <div className="z-hero__chips">
              {categories.slice(0, 5).map((category) => (
                <Link
                  key={category.slug}
                  href={path(`/search?category=${category.slug}`)}
                  className="z-chip"
                >
                  <CategoryIcon slug={category.slug} fallback={category.icon} size={18} />
                  {localizedName(category, locale)}
                </Link>
              ))}
            </div>
          </div>

          <div className="z-hero__art">
            {/* The host speaks for itself — the greeting lives with the figure
                rather than in a separate caption beside it. */}
            <WelcomeAvatar copy={m.avatar} />
          </div>
        </div>
      </section>

      {/* ── Categories ─────────────────────────────────────────────────── */}
      {categories.length > 0 ? (
        <section className="z-section">
          <div className="z-container">
            <div className="z-section__head" data-reveal>
              <div>
                <Eyebrow>{m.home.exploreEyebrow}</Eyebrow>
                <h2 className="z-section__title">{m.home.popularCategories}</h2>
              </div>
              <Link href={path('/categories')} className="z-header__link">
                {m.common.seeAll} →
              </Link>
            </div>

            <div className="z-grid z-grid--4" data-reveal="stagger">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={path(`/search?category=${category.slug}`)}
                  className="z-ctile"
                >
                  <span className="z-ctile__icon" aria-hidden="true">
                    <CategoryIcon slug={category.slug} fallback={category.icon ?? '✂'} size={28} />
                  </span>
                  <span className="z-ctile__name">{localizedName(category, locale)}</span>
                  <span className="z-ctile__count">
                    {formatCount(m.home.businessCount, category.count, locale)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Featured ───────────────────────────────────────────────────── */}
      {featured.length > 0 ? (
        <section className="z-section z-section--sunken">
          <div className="z-container">
            <div className="z-section__head" data-reveal>
              <div>
                <Eyebrow>{m.home.selectionEyebrow}</Eyebrow>
                <h2 className="z-section__title">{m.home.featured}</h2>
                <p className="z-section__lead">{m.home.featuredLead}</p>
              </div>
              <Link href={path('/search?verified=1')} className="z-header__link">
                {m.common.seeAll} →
              </Link>
            </div>

            <Rail
              reveal
              labels={{
                previous: m.home.previous,
                next: m.home.nextItems,
                region: m.home.featuredRegion,
              }}
            >
              {featured.map((business) => (
                <BusinessCard key={business.slug} business={business} />
              ))}
            </Rail>
          </div>
        </section>
      ) : null}

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="z-section">
        <div className="z-container">
          <div className="z-section__head" data-reveal>
            <div>
              <Eyebrow>{m.home.simpleEyebrow}</Eyebrow>
              <h2 className="z-section__title">{m.home.howItWorks}</h2>
            </div>
          </div>

          <div className="z-grid z-grid--3" data-reveal="stagger">
            {steps.map((step, index) => (
              <div key={step.title} className="z-step">
                <span className="z-step__num" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="z-step__title">{step.title}</h3>
                <p className="z-step__body">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Most booked ────────────────────────────────────────────────── */}
      {popular.length > 0 ? (
        <section className="z-section z-section--sunken">
          <div className="z-container">
            <div className="z-section__head" data-reveal>
              <div>
                <Eyebrow>{m.home.trendingEyebrow}</Eyebrow>
                <h2 className="z-section__title">{m.home.popular}</h2>
              </div>
            </div>
            <div className="z-grid z-grid--3" data-reveal="stagger">
              {popular.map((business) => (
                <BusinessCard key={business.slug} business={business} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Professional CTA ───────────────────────────────────────────── */}
      <section className="z-section">
        <div className="z-container">
          <div className="z-procta" data-reveal>
            <svg className="z-procta__arch" viewBox="0 0 100 138" width="300" aria-hidden="true">
              <path
                d="M0 50a50 50 0 0 1 100 0v80a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V50Z"
                fill="var(--z-chaux)"
              />
            </svg>

            <div className="z-procta__inner">
              <div>
                <Eyebrow>{m.nav.forPros}</Eyebrow>
                <h2>{m.home.proTitle}</h2>
                <p>{m.home.proBody}</p>
                <ul className="z-procta__list">
                  {benefits.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              </div>

              <div className="z-procta__price">
                {trialMonths ? (
                  <span className="z-procta__free">
                    {t(m.home.trialMonths, { months: trialMonths })}
                  </span>
                ) : null}
                {price ? (
                  <span className="z-procta__then">{t(m.home.thenPrice, { price })}</span>
                ) : null}
                <ButtonLink href={path('/register/pro')} variant="accent" size="lg" block>
                  {m.footer.createBusiness}
                </ButtonLink>
                <ButtonLink
                  href={path('/pro')}
                  variant="ghost"
                  size="sm"
                  block
                  className="z-procta__learn"
                >
                  {m.home.learnMore}
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
