'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Primitives';
import { createBusinessAction } from '@/server/actions/onboarding';
import { idle } from '@/lib/formState';
import { formatPrice } from '@/i18n/format';

/**
 * Onboarding.
 *
 * Only what is strictly needed to create the business is asked here — name,
 * category, city. Everything else (photos, services, team, hours) is completed
 * in the dashboard, where the owner can see the effect of each change on their
 * own page. A long wizard before anything exists is where people drop out.
 */
const STEPS = [
  { title: 'Votre établissement', hint: 'Le nom que verront vos clients.' },
  { title: 'Votre activité', hint: 'Pour apparaître dans les bonnes recherches.' },
  { title: 'Où êtes-vous ?', hint: 'Pour être trouvé près de chez vos clients.' },
];

const NEXT_STEPS = [
  'Ajouter vos prestations, avec prix et durée',
  'Ajouter votre équipe et qui fait quoi',
  'Régler vos horaires d’ouverture',
  'Téléverser vos photos',
  'Publier votre page',
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block loading={pending}>
      Créer mon établissement
    </Button>
  );
}

export function OnboardingWizard({
  categories,
  cities,
  trialDays,
  price,
  currency,
}: {
  categories: { id: string; name: string; icon: string | null }[];
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
  const canContinue = step === 0 ? name.trim().length >= 2 : step === 1 ? categoryId !== '' : true;

  return (
    <div className="z-onboard">
      <div className="z-container z-onboard__inner">
        <header className="z-onboard__head">
          <Badge tone="gold">
            {Math.round(trialDays / 30)} mois offerts, puis{' '}
            {formatPrice(price, 'fr', currency)} / mois
          </Badge>
          <h1>Mettez votre établissement en ligne</h1>
          <p>
            Trois questions, et votre page existe. Vous complétez le reste ensuite, en voyant
            le résultat en direct.
          </p>
        </header>

        <ol className="z-steps z-onboard__steps">
          {STEPS.map((item, index) => (
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
            <h2 className="z-profile__h3">{STEPS[0]!.title}</h2>
            <p className="z-policy">{STEPS[0]!.hint}</p>
            <Input
              label="Nom de l’établissement"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Barber El Medina"
              required
              error={errors?.name}
            />
            <Input
              label="Téléphone"
              name="phone"
              type="tel"
              optional
              placeholder="20 123 456"
              error={errors?.phone}
            />
          </div>

          <div hidden={step !== 1}>
            <h2 className="z-profile__h3">{STEPS[1]!.title}</h2>
            <p className="z-policy">{STEPS[1]!.hint}</p>
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
                    {category.icon ?? '✂'}
                  </span>
                  <span className="z-person__name">{category.name}</span>
                </label>
              ))}
            </div>
            {errors?.categoryId ? <p className="z-error">{errors.categoryId}</p> : null}
          </div>

          <div hidden={step !== 2}>
            <h2 className="z-profile__h3">{STEPS[2]!.title}</h2>
            <p className="z-policy">{STEPS[2]!.hint}</p>
            <Select label="Ville" name="cityId" optional>
              <option value="">Je préciserai plus tard</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.label}
                </option>
              ))}
            </Select>

            <div className="z-onboard__next">
              <h3>Ensuite, dans votre tableau de bord :</h3>
              <ul className="z-procta__list">
                {NEXT_STEPS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="z-onboard__actions">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
                Retour
              </Button>
            ) : null}

            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                size="lg"
                block
                disabled={!canContinue}
                onClick={() => setStep((s) => s + 1)}
              >
                Continuer
              </Button>
            ) : (
              <Submit />
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
