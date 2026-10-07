import Link from 'next/link';
import { Fragment } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Arrow } from '@/components/ui/Arrow';
import { Eyebrow } from '@/components/ui/Primitives';
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
  marketplaceStats,
  popularBusinesses,
  topCategories,
} from '@/server/services/marketplace';
import { CategoryIcon } from '@/components/brand/CategoryIcon';

export const revalidate = 300;

/** Drawn in the same line family as the category icons. */
const STEP_ICONS = [
  // Search: a lens over a map pin's dot — finding, near you.
  <>
    <circle key="a" cx="10.5" cy="10.5" r="6.5" />
    <path key="b" d="M15.5 15.5 21 21" />
    <circle key="c" cx="10.5" cy="10.5" r="1.6" />
  </>,
  // Book: a calendar page with its day ticked.
  <>
    <rect key="a" x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path key="b" d="M3.5 9.5h17M8 3v4M16 3v4" />
    <path key="c" d="m9 14.6 2 2 4-4.2" />
  </>,
  // Enjoy: the sparkle from the beauty category.
  <>
    <path key="a" d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7L11 3.5Z" />
    <path key="b" d="M18.5 14.5v5M16 17h5" />
  </>,
];

export default async function HomePage() {
  const { m, t, locale, path } = await translate();
  const [categories, featured, popular, cities, plan, stats] = await Promise.all([
    topCategories(8),
    featuredBusinesses(8),
    popularBusinesses(4),
    listCities(),
    publicPlan(),
    marketplaceStats(),
  ]);

  // The headline is three short verbs; splitting them lets each land in turn.
  const headline = m.home.heroTitle.split(/(?<=\.)\s+/);

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
        {/* The zellige lattice, faint and fading out from behind the host —
            the brand's tile, not a stock gradient. Decorative only. */}
        <div className="z-hero__pattern" aria-hidden="true" />
        <div className="z-container z-hero__grid">
          {/* Entrance choreography is pure CSS keyed on --e, so the first
              paint never waits for JavaScript. */}
          <div className="z-hero__copy">
            {stats.businesses > 0 ? (
              <p className="z-hero__live" style={{ ['--e' as string]: 0 }}>
                <span className="z-hero__pulse" aria-hidden="true" />
                {formatCount(m.home.liveStats, stats.businesses, locale)}
                {stats.cities > 1 ? ` ${formatCount(m.home.inCities, stats.cities, locale)}` : ''}
              </p>
            ) : null}
            <h1 className="z-hero__title">
              {headline.map((word, i) => (
                // The space sits between the spans: inside an inline-block
                // it would collapse and run the verbs together.
                <Fragment key={i}>
                  <span className="z-hero__word" style={{ ['--e' as string]: i + 1 }}>
                    {word}
                  </span>{' '}
                </Fragment>
              ))}
            </h1>
            <p className="z-hero__subtitle" style={{ ['--e' as string]: headline.length + 1 }}>
              {m.home.heroSubtitleLong}
            </p>

            <div className="z-hero__search" style={{ ['--e' as string]: headline.length + 2 }}>
              <SearchBar
                cities={cities.map((c) => ({ slug: c.slug, name: localizedName(c, locale) }))}
                m={{ search: m.search, home: m.home }}
                searchPath={path('/search')}
              />
            </div>

            <div className="z-hero__chips" style={{ ['--e' as string]: headline.length + 3 }}>
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
                {m.common.seeAll} <Arrow />
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
                {m.common.seeAll} <Arrow />
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

          {/* Three steps on one path: the line draws across as the section
              scrolls in, so they read as a journey, not three loose facts. */}
          <ol className="z-journey" data-reveal="stagger">
            {steps.map((step, index) => (
              <li key={step.title} className="z-journey__step">
                <span className="z-journey__mark" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="26"
                    height="26"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {STEP_ICONS[index]}
                  </svg>
                  <span className="z-journey__num">{index + 1}</span>
                </span>
                <h3 className="z-step__title">{step.title}</h3>
                <p className="z-step__body">{step.body}</p>
              </li>
            ))}
          </ol>
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
