import Link from 'next/link';
import { Badge, Eyebrow, EmptyState, Rating } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ShareButton } from '@/components/business/ShareButton';
import { FavoriteButton } from '@/components/business/FavoriteButton';
import { Gallery } from '@/components/business/Gallery';
import { type BusinessProfile, isOpenNow } from '@/server/services/businessProfile';
import {
  formatCount,
  formatDate,
  formatDuration,
  formatPhone,
  formatPrice,
  localizedName,
  weekdayNames,
} from '@/i18n/format';
import { translate } from '@/i18n/server';
import { coverStyle } from '@/lib/brand';

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export async function BusinessProfileView({
  business,
  preview = false,
  isFavorite = false,
}: {
  business: BusinessProfile;
  preview?: boolean;
  isFavorite?: boolean;
}) {
  const { m, t, locale, path } = await translate();
  const open = isOpenNow(business.hours, business.timezone);
  const primaryCategory = business.categories.find((c) => c.isPrimary)?.category;

  // Group opening hours by weekday so a split day reads as one row.
  const hoursByDay = weekdayNames(locale).map((label, weekday) => ({
    label,
    weekday,
    periods: business.hours.filter((h) => h.weekday === weekday),
  }));

  // Services grouped by their category, in the order the owner arranged them.
  const serviceGroups = business.services.reduce<Record<string, typeof business.services>>(
    (acc, service) => {
      const key = service.categoryName ?? m.business.services;
      (acc[key] ??= []).push(service);
      return acc;
    },
    {},
  );

  return (
    <div className="z-profile">
      {preview ? (
        <div className="z-preview-bar">
          <span>
            <strong>{m.business.previewLabel}</strong> {m.business.previewBody}
          </span>
          <ButtonLink href="/pro/dashboard/profile" variant="secondary" size="sm">
            {m.business.editMyPage}
          </ButtonLink>
        </div>
      ) : null}

      {/* ── Cover ─────────────────────────────────────────────────────── */}
      <div className="z-profile__cover">
        {business.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.cover.url} alt="" className="z-profile__cover-img" />
        ) : (
          <div
            className="z-profile__cover-fallback z-cover"
            aria-hidden="true"
            style={coverStyle(business.slug)}
          />
        )}
      </div>

      <div className="z-container">
        {/* ── Identity ────────────────────────────────────────────────── */}
        <header className="z-profile__head">
          <div className="z-profile__logo">
            {business.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.logo.thumbUrl} alt="" />
            ) : (
              <svg viewBox="0 0 100 138" width="40" aria-hidden="true">
                <path
                  d="M0 50a50 50 0 0 1 100 0v80a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V50Z"
                  fill="var(--z-medina)"
                />
              </svg>
            )}
          </div>

          <div className="z-profile__identity">
            <div className="z-profile__title-row">
              <h1>{business.name}</h1>
              {business.verification === 'VERIFIED' ? (
                <Badge tone="accent">✓ {m.business.verified}</Badge>
              ) : null}
              <Badge tone={open ? 'success' : 'neutral'}>
                {open ? m.business.openNow : m.business.closedNow}
              </Badge>
            </div>

            {business.tagline ? <p className="z-profile__tagline">{business.tagline}</p> : null}

            <div className="z-profile__meta">
              <Rating value={business.ratingAverage} count={business.reviewCount} />
              {primaryCategory ? <span>· {localizedName(primaryCategory, locale)}</span> : null}
              {business.location?.city ? (
                <span>
                  · {business.location.addressLine1},{' '}
                  {localizedName(business.location.city, locale)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="z-profile__actions">
            <FavoriteButton
              businessId={business.id}
              initial={isFavorite}
              labels={{ add: m.business.addFavorite, remove: m.business.removeFavorite }}
            />
            <ShareButton
              slug={business.slug}
              name={business.name}
              tagline={business.tagline ?? undefined}
              labels={{
                share: m.business.share,
                copy: m.business.copyLink,
                copied: m.business.linkCopied,
              }}
            />
            {business.bookable ? (
              <ButtonLink href={path(`/business/${business.slug}/book`)} size="lg">
                {m.business.book}
              </ButtonLink>
            ) : (
              <Badge tone="warning">{m.business.notBookable}</Badge>
            )}
          </div>
        </header>

        {!business.publiclyVisible && preview ? (
          <Alert tone="warning">{m.business.notPublished}</Alert>
        ) : null}

        <div className="z-profile__grid">
          <div className="z-profile__main">
            {/* ── About ───────────────────────────────────────────────── */}
            {business.description ? (
              <section className="z-profile__section" id="about">
                <h2 className="z-profile__h2">{m.business.about}</h2>
                <div className="z-prose">
                  <p>{business.description}</p>
                  {business.story ? <p>{business.story}</p> : null}
                </div>
              </section>
            ) : null}

            {/* ── Services ────────────────────────────────────────────── */}
            <section className="z-profile__section" id="services">
              <h2 className="z-profile__h2">{m.business.services}</h2>

              {business.services.length === 0 ? (
                <EmptyState title={m.business.noServices} body={m.business.noServicesBody} />
              ) : (
                Object.entries(serviceGroups).map(([group, services]) => (
                  <div key={group} className="z-svc-group">
                    <Eyebrow>{group}</Eyebrow>
                    <ul className="z-svc-list" data-reveal="stagger">
                      {services.map((service) => (
                        <li key={service.id} className="z-svc">
                          {service.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={service.imageUrl}
                              alt=""
                              className="z-svc__img"
                              loading="lazy"
                            />
                          ) : null}

                          <div className="z-svc__body">
                            <h3 className="z-svc__name">{service.name}</h3>
                            {service.description ? (
                              <p className="z-svc__desc">{service.description}</p>
                            ) : null}
                            <p className="z-svc__duration">
                              {formatDuration(service.durationMinutes, locale)}
                            </p>
                          </div>

                          <div className="z-svc__aside">
                            <span className="z-svc__price">
                              {formatPrice(service.price, locale, business.currency)}
                            </span>
                            {business.bookable ? (
                              <ButtonLink
                                href={path(
                                  `/business/${business.slug}/book?service=${service.id}`,
                                )}
                                variant="secondary"
                                size="sm"
                              >
                                {m.business.book}
                              </ButtonLink>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </section>

            {/* ── Team ────────────────────────────────────────────────── */}
            {business.staff.length > 0 ? (
              <section className="z-profile__section" id="team">
                <h2 className="z-profile__h2">{m.business.teamTitle}</h2>
                <div className="z-team" data-reveal="stagger">
                  {business.staff.map((member) => (
                    <article key={member.id} className="z-team__card">
                      <div className="z-team__avatar">
                        {member.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.avatarUrl} alt="" loading="lazy" />
                        ) : (
                          <span aria-hidden="true">
                            {member.displayName
                              .split(' ')
                              .map((p) => p[0])
                              .join('')
                              .slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <h3 className="z-team__name">{member.displayName}</h3>
                      {member.title ? <p className="z-team__title">{member.title}</p> : null}
                      {member.specialties.length > 0 ? (
                        <p className="z-team__specialties">{member.specialties.join(' · ')}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {/* ── Gallery ─────────────────────────────────────────────── */}
            {business.gallery.length > 0 ? (
              <section className="z-profile__section" id="gallery">
                <h2 className="z-profile__h2">{m.business.gallery}</h2>
                <Gallery images={business.gallery} />
              </section>
            ) : null}

            {/* ── Reviews ─────────────────────────────────────────────── */}
            <section className="z-profile__section" id="reviews">
              <h2 className="z-profile__h2">{m.business.reviews}</h2>

              {business.reviewCount === 0 ? (
                <EmptyState title={m.business.noReviews} body={m.business.noReviewsLong} />
              ) : (
                <>
                  <div className="z-reviews__summary">
                    <div className="z-reviews__score">
                      <strong>{business.ratingAverage.toFixed(1)}</strong>
                      <Rating value={business.ratingAverage} showValue={false} />
                      <span>
                        {formatCount(m.business.verifiedReviews, business.reviewCount, locale)}
                      </span>
                    </div>
                    <div className="z-reviews__bars">
                      {business.ratingBreakdown.map((row) => (
                        <div key={row.star} className="z-reviews__bar">
                          <span>{row.star}★</span>
                          <span className="z-reviews__track">
                            <span
                              style={{
                                width: `${
                                  business.reviewCount
                                    ? (row.count / business.reviewCount) * 100
                                    : 0
                                }%`,
                              }}
                            />
                          </span>
                          <span className="z-reviews__count">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <ul className="z-reviews__list" data-reveal="stagger">
                    {business.reviews.map((review) => (
                      <li key={review.id} className="z-review">
                        <div className="z-review__head">
                          <strong>{review.authorName}</strong>
                          <Rating value={review.rating} showValue={false} size={13} />
                          <time dateTime={review.createdAt.toISOString()}>
                            {formatDate(review.createdAt, locale)}
                          </time>
                        </div>
                        {review.serviceName ? (
                          <p className="z-review__service">{review.serviceName}</p>
                        ) : null}
                        {review.comment ? <p>{review.comment}</p> : null}
                        {review.response ? (
                          <div className="z-review__response">
                            <strong>{t(m.business.responseFrom, { name: business.name })}</strong>
                            <p>{review.response.body}</p>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          {/* ── Sidebar ───────────────────────────────────────────────── */}
          <aside className="z-profile__aside">
            <div className="z-panel z-profile__sticky">
              <h2 className="z-profile__h3">{m.business.hours}</h2>
              <ul className="z-hours">
                {hoursByDay.map((day) => (
                  <li
                    key={day.weekday}
                    className={day.periods.length === 0 ? 'is-closed' : undefined}
                  >
                    <span>{day.label}</span>
                    <span>
                      {day.periods.length === 0
                        ? m.business.closedNow
                        : day.periods.map((p) => `${hhmm(p.startMin)}–${hhmm(p.endMin)}`).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>

              {business.exceptions.length > 0 ? (
                <div className="z-hours__exceptions">
                  <Eyebrow>{m.business.upcomingClosures}</Eyebrow>
                  <ul>
                    {business.exceptions.slice(0, 4).map((exception) => (
                      <li key={exception.id}>
                        {formatDate(exception.date, locale, { day: 'numeric', month: 'long' })}
                        {exception.reason ? ` — ${exception.reason}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {business.location ? (
              <div className="z-panel">
                <h2 className="z-profile__h3">{m.business.location}</h2>
                <address className="z-address">
                  {business.location.addressLine1}
                  {business.location.addressLine2 ? (
                    <>
                      <br />
                      {business.location.addressLine2}
                    </>
                  ) : null}
                  <br />
                  {business.location.postalCode}{' '}
                  {business.location.city ? localizedName(business.location.city, locale) : null}
                  <br />
                  {business.location.city
                    ? localizedName(business.location.city.governorate, locale)
                    : null}
                </address>
                <a
                  className="z-btn z-btn--secondary z-btn--sm z-btn--block"
                  href={`https://www.openstreetmap.org/?mlat=${business.location.latitude}&mlon=${business.location.longitude}#map=17/${business.location.latitude}/${business.location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {m.business.directions}
                </a>
              </div>
            ) : null}

            <div className="z-panel">
              <h2 className="z-profile__h3">{m.business.contact}</h2>
              <ul className="z-contact">
                {business.phone ? (
                  <li>
                    <a href={`tel:${business.phone}`}>{formatPhone(business.phone)}</a>
                  </li>
                ) : null}
                {business.whatsapp ? (
                  <li>
                    <a
                      href={`https://wa.me/${business.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                  </li>
                ) : null}
                {business.instagram ? (
                  <li>
                    <a
                      href={`https://instagram.com/${business.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Instagram
                    </a>
                  </li>
                ) : null}
                {business.facebook ? (
                  <li>
                    <a href={business.facebook} target="_blank" rel="noopener noreferrer">
                      Facebook
                    </a>
                  </li>
                ) : null}
                {business.website ? (
                  <li>
                    <a href={business.website} target="_blank" rel="noopener noreferrer">
                      {m.business.website}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>

            {business.cancellationPolicy || business.noShowPolicy ? (
              <div className="z-panel">
                <h2 className="z-profile__h3">{m.business.policies}</h2>
                {business.cancellationPolicy ? (
                  <p className="z-policy">{business.cancellationPolicy}</p>
                ) : null}
                {business.noShowPolicy ? (
                  <p className="z-policy">{business.noShowPolicy}</p>
                ) : null}
                <p className="z-policy z-policy--muted">
                  {t(m.business.noticeAndCancellation, {
                    hours: Math.round(business.minNoticeMinutes / 60),
                    window: business.cancellationWindowHours,
                  })}
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      {/* Sticky mobile booking bar — the primary action is never off screen. */}
      {business.bookable ? (
        <div className="z-profile__mobile-cta">
          <div>
            {business.fromPrice != null ? (
              <>
                <span>{m.business.from}</span>{' '}
                <strong>{formatPrice(business.fromPrice, locale, business.currency)}</strong>
              </>
            ) : (
              <strong>{business.name}</strong>
            )}
          </div>
          <ButtonLink href={path(`/business/${business.slug}/book`)} size="md">
            {m.business.book}
          </ButtonLink>
        </div>
      ) : null}

      <nav className="z-profile__jump" aria-label={m.business.sections}>
        <Link href="#services">{m.business.services}</Link>
        <Link href="#team">{m.business.team}</Link>
        <Link href="#gallery">{m.business.gallery}</Link>
        <Link href="#reviews">{m.business.reviews}</Link>
      </nav>
    </div>
  );
}
