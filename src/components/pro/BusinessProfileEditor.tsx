'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Primitives';
import {
  publishBusinessAction,
  updateBusinessProfileAction,
  updateLocationAction,
  updatePolicyAction,
} from '@/server/actions/business';
import { idle } from '@/lib/formState';

type Business = {
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  story: string | null;
  servedGender: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  status: string;
  autoConfirm: boolean;
  slotGranularityMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  cancellationWindowHours: number;
  allowCustomerCancel: boolean;
  allowCustomerReschedule: boolean;
  cancellationPolicy: string | null;
  noShowPolicy: string | null;
  bookingNotice: string | null;
};

function Save({ label = 'Enregistrer' }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function BusinessProfileEditor({
  businessId,
  business,
  location,
  cities,
  readiness,
}: {
  businessId: string;
  business: Business;
  location: {
    cityId: string | null;
    addressLine1: string;
    addressLine2: string | null;
    postalCode: string | null;
    latitude: number;
    longitude: number;
    directions: string | null;
  } | null;
  cities: { id: string; label: string }[];
  readiness: { services: number; staff: number; hours: number; hasLocation: boolean };
}) {
  const router = useRouter();
  const [profileState, profileAction] = useActionState(updateBusinessProfileAction, idle);
  const [locationState, locationAction] = useActionState(updateLocationAction, idle);
  const [policyState, policyAction] = useActionState(updatePolicyAction, idle);
  const [publishState, publishAction] = useActionState(publishBusinessAction, idle);

  if (
    profileState.status === 'success' ||
    locationState.status === 'success' ||
    policyState.status === 'success' ||
    publishState.status === 'success'
  ) {
    router.refresh();
  }

  const pErr = profileState.status === 'error' ? profileState.fieldErrors : undefined;
  const lErr = locationState.status === 'error' ? locationState.fieldErrors : undefined;

  const blockers: string[] = [];
  if (!readiness.hasLocation) blockers.push('une adresse');
  if (readiness.services === 0) blockers.push('au moins une prestation');
  if (readiness.staff === 0) blockers.push('au moins un membre d’équipe');
  if (readiness.hours === 0) blockers.push('vos horaires');

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      {business.status !== 'ACTIVE' ? (
        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">
            {business.status === 'PENDING_REVIEW' ? 'En attente de validation' : 'Publier mon établissement'}
          </h2>

          {publishState.status === 'error' ? (
            <Alert tone="error">{publishState.message}</Alert>
          ) : null}
          {publishState.status === 'success' ? (
            <Alert tone="success">{publishState.message}</Alert>
          ) : null}

          {business.status === 'PENDING_REVIEW' ? (
            <Alert tone="info">
              Votre établissement est en cours de validation par l’équipe Zynetna. Vous serez
              notifié dès qu’il est en ligne.
            </Alert>
          ) : blockers.length > 0 ? (
            <Alert tone="warning">Il manque encore {blockers.join(', ')}.</Alert>
          ) : (
            <form action={publishAction}>
              <input type="hidden" name="businessId" value={businessId} />
              <Save label="Publier mon établissement" />
            </form>
          )}
        </Panel>
      ) : null}

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">Identité</h2>
        <form action={profileAction} className="z-auth__form">
          <input type="hidden" name="businessId" value={businessId} />

          {profileState.status === 'error' ? <Alert tone="error">{profileState.message}</Alert> : null}
          {profileState.status === 'success' ? (
            <Alert tone="success">{profileState.message}</Alert>
          ) : null}

          <Input label="Nom de l’établissement" name="name" defaultValue={business.name} required error={pErr?.name} />
          <Input
            label="Accroche"
            name="tagline"
            defaultValue={business.tagline ?? ''}
            optional
            maxLength={140}
            placeholder="Coupe nette, barbe soignée, café offert."
            hint="Une phrase, affichée sous votre nom."
            error={pErr?.tagline}
          />
          <Textarea
            label="Description"
            name="description"
            defaultValue={business.description ?? ''}
            optional
            placeholder="Présentez votre établissement, vos spécialités, votre ambiance."
            error={pErr?.description}
          />
          <Textarea
            label="Votre histoire"
            name="story"
            defaultValue={business.story ?? ''}
            optional
            placeholder="Depuis quand êtes-vous là ? Qu’est-ce qui vous distingue ?"
            error={pErr?.story}
          />

          <Select label="Clientèle" name="servedGender" defaultValue={business.servedGender}>
            <option value="EVERYONE">Hommes et femmes</option>
            <option value="WOMEN">Femmes</option>
            <option value="MEN">Hommes</option>
          </Select>

          <h3 className="z-profile__h3">Contact</h3>
          <div className="z-auth__row">
            <Input label="Téléphone" name="phone" type="tel" defaultValue={business.phone ?? ''} optional error={pErr?.phone} />
            <Input label="WhatsApp" name="whatsapp" type="tel" defaultValue={business.whatsapp ?? ''} optional error={pErr?.whatsapp} />
          </div>
          <Input label="E-mail" name="email" type="email" defaultValue={business.email ?? ''} optional error={pErr?.email} />
          <Input label="Site web" name="website" type="url" defaultValue={business.website ?? ''} optional placeholder="https://" error={pErr?.website} />
          <div className="z-auth__row">
            <Input label="Instagram" name="instagram" defaultValue={business.instagram ?? ''} optional placeholder="monsalon" error={pErr?.instagram} />
            <Input label="TikTok" name="tiktok" defaultValue={business.tiktok ?? ''} optional placeholder="monsalon" error={pErr?.tiktok} />
          </div>
          <Input label="Facebook" name="facebook" type="url" defaultValue={business.facebook ?? ''} optional placeholder="https://facebook.com/…" error={pErr?.facebook} />

          <Save />
        </form>
      </Panel>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">Adresse</h2>
        <form action={locationAction} className="z-auth__form">
          <input type="hidden" name="businessId" value={businessId} />

          {locationState.status === 'error' ? <Alert tone="error">{locationState.message}</Alert> : null}
          {locationState.status === 'success' ? (
            <Alert tone="success">{locationState.message}</Alert>
          ) : null}

          <Input
            label="Adresse"
            name="addressLine1"
            defaultValue={location?.addressLine1 ?? ''}
            required
            placeholder="14 rue Sidi Ben Arous"
            error={lErr?.addressLine1}
          />
          <Input label="Complément" name="addressLine2" defaultValue={location?.addressLine2 ?? ''} optional />

          <div className="z-auth__row">
            <Select label="Ville" name="cityId" defaultValue={location?.cityId ?? ''} optional>
              <option value="">Choisir…</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.label}
                </option>
              ))}
            </Select>
            <Input label="Code postal" name="postalCode" defaultValue={location?.postalCode ?? ''} optional />
          </div>

          <div className="z-auth__row">
            <Input
              label="Latitude"
              name="latitude"
              type="number"
              step="0.000001"
              defaultValue={location?.latitude ?? 36.8065}
              required
              hint="Ajustez pour positionner précisément votre pin."
              error={lErr?.latitude}
            />
            <Input
              label="Longitude"
              name="longitude"
              type="number"
              step="0.000001"
              defaultValue={location?.longitude ?? 10.1815}
              required
              error={lErr?.longitude}
            />
          </div>

          <Textarea
            label="Comment vous trouver"
            name="directions"
            defaultValue={location?.directions ?? ''}
            optional
            placeholder="En face de la pharmacie, premier étage."
          />

          <Save />
        </form>
      </Panel>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">Règles de réservation</h2>
        <form action={policyAction} className="z-auth__form">
          <input type="hidden" name="businessId" value={businessId} />

          {policyState.status === 'error' ? <Alert tone="error">{policyState.message}</Alert> : null}
          {policyState.status === 'success' ? <Alert tone="success">{policyState.message}</Alert> : null}

          <label className="z-check">
            <input type="checkbox" name="autoConfirm" defaultChecked={business.autoConfirm} />
            <span>
              Confirmer automatiquement les réservations
              <br />
              <span className="z-help">
                Sinon, chaque demande attend votre validation.
              </span>
            </span>
          </label>

          <div className="z-auth__row">
            <Input
              label="Pas des créneaux (min)"
              name="slotGranularityMinutes"
              type="number"
              min="5"
              max="120"
              step="5"
              defaultValue={business.slotGranularityMinutes}
              required
              hint="15 min = créneaux à 09:00, 09:15, 09:30…"
            />
            <Input
              label="Préavis minimum (min)"
              name="minNoticeMinutes"
              type="number"
              min="0"
              step="15"
              defaultValue={business.minNoticeMinutes}
              required
              hint="Délai avant qu’un client puisse réserver."
            />
          </div>

          <div className="z-auth__row">
            <Input
              label="Réservation à l’avance (jours)"
              name="maxAdvanceDays"
              type="number"
              min="1"
              max="365"
              defaultValue={business.maxAdvanceDays}
              required
            />
            <Input
              label="Fenêtre d’annulation (heures)"
              name="cancellationWindowHours"
              type="number"
              min="0"
              max="168"
              defaultValue={business.cancellationWindowHours}
              required
            />
          </div>

          <label className="z-check">
            <input type="checkbox" name="allowCustomerCancel" defaultChecked={business.allowCustomerCancel} />
            <span>Les clients peuvent annuler eux-mêmes</span>
          </label>
          <label className="z-check">
            <input
              type="checkbox"
              name="allowCustomerReschedule"
              defaultChecked={business.allowCustomerReschedule}
            />
            <span>Les clients peuvent déplacer leur rendez-vous</span>
          </label>

          <Textarea
            label="Politique d’annulation"
            name="cancellationPolicy"
            defaultValue={business.cancellationPolicy ?? ''}
            optional
            hint="Affichée au client avant la confirmation."
          />
          <Textarea
            label="Politique d’absence"
            name="noShowPolicy"
            defaultValue={business.noShowPolicy ?? ''}
            optional
          />

          <Save />
        </form>
      </Panel>
    </div>
  );
}
