'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Primitives';
import { createBusinessAction } from '@/server/actions/onboarding';
import { idle } from '@/lib/formState';
import { formatCount, formatPrice } from '@/i18n/format';
import type { Locale } from '@/i18n/config';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';
import { CategoryIcon } from '@/components/brand/CategoryIcon';

type M = {
  dashSetup: Messages['dashSetup'];
  common: Messages['common'];
  labels: Messages['labels'];
};

/**
 * Onboarding.
 *
 * Only what is strictly needed to create the business is asked here — name,
 * category, city. Everything else (photos, services, team, hours) is completed
 * in the dashboard, where the owner can see the effect of each change on their
 * own page. A long wizard before anything exists is where people drop out.
 */
function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block loading={pending}>
      {label}
    </Button>
  );
}

export function OnboardingWizard({
  m,
  locale,
  categories,
  cities,
  trialDays,
  price,
  currency,
}: {
  m: M;
  locale: Locale;
  categories: { id: string; slug: string; name: string; icon: string | null }[];
  cities: { id: string; label: string }[];
  trialDays: number;
  price: number;
  currency: string;
}) {
  const [state, formAction] = useActionState(createBusinessAction, idle);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const errors = state.status === 'error' ? state.fieldErrors : undefined;
  const t = m.dashSetup.onboarding;
  const steps = t.steps;
  const canContinue = step === 0 ? name.trim().length >= 2 : step === 1 ? categoryId !== '' : true;

  return (
    <div className="z-onboard">
      <div className="z-container z-onboard__inner">
        <header className="z-onboard__head">
          <Badge tone="gold">
            {interpolate(t.offer, {
              trial: formatCount(t.trialMonths, Math.round(trialDays / 30), locale),
              price: formatPrice(price, locale, currency),
              interval: m.labels.interval.MONTH,
            })}
          </Badge>
          <h1>{t.heading}</h1>
          <p>{t.intro}</p>
        </header>

        <ol className="z-steps z-onboard__steps">
          {steps.map((item, index) => (
            <li
              key={item.title}
              className={`z-steps__item ${index === step ? 'is-current' : ''} ${index < step ? 'is-done' : ''}`}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="z-steps__dot">{index < step ? '✓' : index + 1}</span>
              <span className="z-steps__label">{item.title}</span>
            </li>
          ))}
        </ol>

        <form action={formAction} className="z-panel z-onboard__form">
          {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

          {/* Every field stays mounted so the final submit carries them all. */}
          <div hidden={step !== 0}>
            <h2 className="z-profile__h3">{steps[0]!.title}</h2>
            <p className="z-policy">{steps[0]!.hint}</p>
            <Input
              label={t.name}
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              required
              error={errors?.name}
            />
            <Input
              label={t.phone}
              name="phone"
              type="tel"
              dir="ltr"
              optional
              placeholder={t.phonePlaceholder}
              error={errors?.phone}
            />
          </div>

          <div hidden={step !== 1}>
            <h2 className="z-profile__h3">{steps[1]!.title}</h2>
            <p className="z-policy">{steps[1]!.hint}</p>
            <div className="z-choices z-choices--people">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className={`z-person ${categoryId === category.id ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="categoryId"
                    value={category.id}
                    checked={categoryId === category.id}
                    onChange={() => setCategoryId(category.id)}
                    className="z-sr-only"
                  />
                  <span className="z-ctile__icon" aria-hidden="true">
                    <CategoryIcon slug={category.slug} fallback={category.icon ?? '✂'} size={28} />
                  </span>
                  <span className="z-person__name">{category.name}</span>
                </label>
              ))}
            </div>
            {errors?.categoryId ? <p className="z-error">{errors.categoryId}</p> : null}
          </div>

          <div hidden={step !== 2}>
            <h2 className="z-profile__h3">{steps[2]!.title}</h2>
            <p className="z-policy">{steps[2]!.hint}</p>
            <Select label={t.city} name="cityId" optional>
              <option value="">{t.cityLater}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.label}
                </option>
              ))}
            </Select>

            <div className="z-onboard__next">
              <h3>{t.nextHeading}</h3>
              <ul className="z-procta__list">
                {t.nextSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="z-onboard__actions">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
                {m.common.back}
              </Button>
            ) : null}

            {step < steps.length - 1 ? (
              <Button
                type="button"
                size="lg"
                block
                disabled={!canContinue}
                onClick={() => setStep((s) => s + 1)}
              >
                {t.continue}
              </Button>
            ) : (
              <Submit label={t.submit} />
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
