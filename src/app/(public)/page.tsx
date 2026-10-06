import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, Eyebrow } from '@/components/ui/Primitives';
import { BusinessCard } from '@/components/business/BusinessCard';
import { WelcomeAvatar } from '@/components/marketing/Avatar';
import { SearchBar } from '@/components/marketing/SearchBar';
import {
  featuredBusinesses,
  listCities,
  popularBusinesses,
  topCategories,
} from '@/server/services/marketplace';

export const revalidate = 300;

const STEPS = [
  {
    title: 'Cherche',
    body: 'Trouve un professionnel près de chez toi, filtré par service, prix et disponibilité réelle.',
  },
  {
    title: 'Réserve',
    body: 'Choisis ton créneau et confirme en quelques secondes. Pas d’appel, pas d’attente.',
  },
  {
    title: 'Profite',
    body: 'Reçois un rappel avant ton rendez-vous, puis partage ton avis.',
  },
];

const PRO_BENEFITS = [
  'Une page publique complète, comme un mini-site',
  'Réservation en ligne 24 h/24',
  'Catalogue de prestations avec photos et prix',
  'Gestion de l’équipe et des plannings',
  'Fiche client et historique des rendez-vous',
  'Statistiques et chiffre d’affaires',
];

export default async function HomePage() {
  const [categories, featured, popular, cities] = await Promise.all([
    topCategories(8),
    featuredBusinesses(8),
    popularBusinesses(4),
    listCities(),
  ]);

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="z-hero">
        <div className="z-container z-hero__grid">
          <div className="z-hero__copy">
            <Badge tone="gold">2 mois offerts pour les professionnels</Badge>
            <h1 className="z-hero__title">Trouve. Réserve. Profite.</h1>
            <p className="z-hero__subtitle">
              Coiffeurs, barbiers, instituts de beauté, spas et centres de bien-être —
              partout en Tunisie. Réserve ta chaise, réserve ton éclat.
            </p>

            <div className="z-hero__search">
              <SearchBar cities={cities} />
            </div>

            <div className="z-hero__chips">
              {categories.slice(0, 5).map((category) => (
                <Link
                  key={category.slug}
                  href={`/search?category=${category.slug}`}
                  className="z-chip"
                >
                  {category.icon ? <span aria-hidden="true">{category.icon}</span> : null}
                  {category.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="z-hero__art">
            <p className="z-hero__greeting">
              Ahla w sahla ! 👋
              <span>Dis-moi ce que tu cherches, je t’emmène.</span>
            </p>
            <WelcomeAvatar />
          </div>
        </div>
      </section>

      {/* ── Categories ─────────────────────────────────────────────────── */}
      {categories.length > 0 ? (
        <section className="z-section">
          <div className="z-container">
            <div className="z-section__head">
              <div>
                <Eyebrow>Explorer</Eyebrow>
                <h2 className="z-section__title">Catégories populaires</h2>
              </div>
              <Link href="/categories" className="z-header__link">
                Tout voir →
              </Link>
            </div>

            <div className="z-grid z-grid--4">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/search?category=${category.slug}`}
                  className="z-ctile"
                >
                  <span className="z-ctile__icon" aria-hidden="true">
                    {category.icon ?? '✂'}
                  </span>
                  <span className="z-ctile__name">{category.name}</span>
                  <span className="z-ctile__count">
                    {category.count} établissement{category.count > 1 ? 's' : ''}
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
            <div className="z-section__head">
              <div>
                <Eyebrow>Sélection Zynetna</Eyebrow>
                <h2 className="z-section__title">Établissements à la une</h2>
                <p className="z-section__lead">
                  Des adresses vérifiées, bien notées par leurs clients.
                </p>
              </div>
              <Link href="/search?verified=1" className="z-header__link">
                Tout voir →
              </Link>
            </div>

            <div className="z-grid z-grid--3">
              {featured.map((business) => (
                <BusinessCard key={business.slug} business={business} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="z-section">
        <div className="z-container">
          <div className="z-section__head">
            <div>
              <Eyebrow>Simple</Eyebrow>
              <h2 className="z-section__title">Comment ça marche</h2>
            </div>
          </div>

          <div className="z-grid z-grid--3">
            {STEPS.map((step, index) => (
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
            <div className="z-section__head">
              <div>
                <Eyebrow>Tendance</Eyebrow>
                <h2 className="z-section__title">Les plus réservés</h2>
              </div>
            </div>
            <div className="z-grid z-grid--3">
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
          <div className="z-procta">
            <svg className="z-procta__arch" viewBox="0 0 100 138" width="300" aria-hidden="true">
              <path
                d="M0 50a50 50 0 0 1 100 0v80a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V50Z"
                fill="var(--z-chaux)"
              />
            </svg>

            <div className="z-procta__inner">
              <div>
                <Eyebrow>Pour les professionnels</Eyebrow>
                <h2>Mets ton établissement en ligne.</h2>
                <p>
                  Zynetna n’est pas qu’un agenda : c’est ta vitrine digitale. Tes photos,
                  tes prestations, ton équipe, tes horaires, tes clients — et des
                  réservations qui tombent pendant que tu travailles.
                </p>
                <ul className="z-procta__list">
                  {PRO_BENEFITS.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              </div>

              <div className="z-procta__price">
                <span className="z-procta__free">2 mois offerts</span>
                <span className="z-procta__then">
                  puis 30 TND / mois · sans engagement
                </span>
                <ButtonLink href="/register/pro" variant="accent" size="lg" block>
                  Créer mon établissement
                </ButtonLink>
                <ButtonLink href="/pro" variant="ghost" size="sm" block className="z-procta__learn">
                  En savoir plus
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
