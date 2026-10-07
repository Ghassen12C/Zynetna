'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { submitReviewAction } from '@/server/actions/reviews';
import { idle } from '@/lib/formState';
import type { Locale } from '@/i18n/config';
import { formatCount } from '@/i18n/format';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

/** Keyboard-accessible star input: a real radio group, styled as stars. */
export function ReviewForm({
  reservationId,
  businessName,
  serviceName,
  m,
  locale,
}: {
  reservationId: string;
  businessName: string;
  serviceName?: string | null;
  m: { review: Messages['review']; common: Messages['common'] };
  locale: Locale;
}) {
  const labels = m.review.ratingLabels;
  const [state, formAction] = useActionState(submitReviewAction, idle);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  if (state.status === 'success') {
    return <Alert tone="success">{state.message}</Alert>;
  }

  const shown = hover || rating;

  return (
    <form action={formAction} className="z-panel z-reviewform">
      <input type="hidden" name="reservationId" value={reservationId} />

      <div>
        <h3 className="z-profile__h3">{businessName}</h3>
        {serviceName ? <p className="z-policy">{serviceName}</p> : null}
      </div>

      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

      <fieldset className="z-stars">
        <legend className="z-label">{m.review.yourRating}</legend>
        <div className="z-stars__row" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="z-stars__item">
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                required
              />
              <span className="z-sr-only">
                {interpolate(formatCount(m.review.starOption, value, locale), {
                  label: labels[value] ?? '',
                })}
              </span>
              <svg
                width="34"
                height="34"
                viewBox="0 0 20 20"
                aria-hidden="true"
                onMouseEnter={() => setHover(value)}
              >
                <path
                  d="M10 1.6l2.47 5.2 5.53.78-4 3.98.95 5.64L10 14.5l-4.95 2.7.95-5.64-4-3.98 5.53-.78L10 1.6Z"
                  fill={shown >= value ? 'var(--z-jasmin)' : 'var(--z-chaux-300)'}
                />
              </svg>
            </label>
          ))}
        </div>
        <p className="z-help" aria-live="polite">
          {shown ? labels[shown] : m.review.pickRating}
        </p>
      </fieldset>

      <div className="z-field">
        <label className="z-label" htmlFor={`comment-${reservationId}`}>
          {m.review.yourComment}{' '}
          <span className="z-label__optional">· {m.common.optional}</span>
        </label>
        <textarea
          id={`comment-${reservationId}`}
          name="comment"
          className="z-textarea"
          maxLength={1500}
          placeholder={m.review.commentPlaceholder}
        />
      </div>

      <Submit label={m.review.publish} />
    </form>
  );
}
