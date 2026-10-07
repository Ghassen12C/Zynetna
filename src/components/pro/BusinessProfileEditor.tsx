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
import { LOCALE_META, type Locale } from '@/i18n/config';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';

type M = {
  dashSetup: Messages['dashSetup'];
  common: Messages['common'];
  labels: Messages['labels'];
};

const SERVED_GENDERS = ['EVERYONE', 'WOMEN', 'MEN'] as const;

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

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function BusinessProfileEditor({
  m,
  locale,
  businessId,
  business,
  location,
  cities,
  readiness,
}: {
  m: M;
  locale: Locale;
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

  const t = m.dashSetup.profile;
  const blockers: string[] = [];
  if (!readiness.hasLocation) blockers.push(t.blockerAddress);
  if (readiness.services === 0) blockers.push(t.blockerService);
  if (readiness.staff === 0) blockers.push(t.blockerStaff);
  if (readiness.hours === 0) blockers.push(t.blockerHours);
  // "a, b and c" / "أ وب وج": the list conjunction belongs to the language.
  const blockerList = new Intl.ListFormat(LOCALE_META[locale].intl, {
    style: 'long',
    type: 'conjunction',
  }).format(blockers);

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      {business.status !== 'ACTIVE' ? (
        <Panel className="z-dash__panel">
          <h2 className="z-profile__h3">
            {business.status === 'PENDING_REVIEW' ? t.pendingTitle : t.publishTitle}
          </h2>

          {publishState.status === 'error' ? (
            <Alert tone="error">{publishState.message}</Alert>
          ) : null}
          {publishState.status === 'success' ? (
            <Alert tone="success">{publishState.message}</Alert>
          ) : null}

          {business.status === 'PENDING_REVIEW' ? (
            <Alert tone="info">{t.pendingBody}</Alert>
          ) : blockers.length > 0 ? (
            <Alert tone="warning">{interpolate(t.missing, { items: blockerList })}</Alert>
          ) : (
            <form action={publishAction}>
              <input type="hidden" name="businessId" value={businessId} />
              <Save label={t.publishTitle} />
            </form>
          )}
        </Panel>
      ) : null}

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">{t.identity}</h2>
        <form action={profileAction} className="z-auth__form">
          <input type="hidden" name="businessId" value={businessId} />

          {profileState.status === 'error' ? <Alert tone="error">{profileState.message}</Alert> : null}
          {profileState.status === 'success' ? (
            <Alert tone="success">{profileState.message}</Alert>
          ) : null}

          <Input
            label={t.name}
            name="name"
            defaultValue={business.name}
            required
            error={pErr?.name}
          />
          <Input
            label={t.tagline}
            name="tagline"
            defaultValue={business.tagline ?? ''}
            optional
            maxLength={140}
            placeholder={t.taglinePlaceholder}
            hint={t.taglineHint}
            error={pErr?.tagline}
          />
          <Textarea
            label={t.description}
            name="description"
            defaultValue={business.description ?? ''}
            optional
            placeholder={t.descriptionPlaceholder}
            error={pErr?.description}
          />
          <Textarea
            label={t.story}
            name="story"
            defaultValue={business.story ?? ''}
            optional
            placeholder={t.storyPlaceholder}
            error={pErr?.story}
          />

          <Select label={t.servedGender} name="servedGender" defaultValue={business.servedGender}>
            {SERVED_GENDERS.map((value) => (
              <option key={value} value={value}>
                {m.labels.servedGender[value]}
              </option>
            ))}
          </Select>

          <h3 className="z-profile__h3">{t.contact}</h3>
          {/* Phone numbers, addresses and URLs are typed left to right in every language. */}
          <div className="z-auth__row">
            <Input
              label={t.phone}
              name="phone"
              type="tel"
              dir="ltr"
              defaultValue={business.phone ?? ''}
              optional
              error={pErr?.phone}
            />
            <Input
              label={t.whatsapp}
              name="whatsapp"
              type="tel"
              dir="ltr"
              defaultValue={business.whatsapp ?? ''}
              optional
              error={pErr?.whatsapp}
            />
          </div>
          <Input
            label={t.email}
            name="email"
            type="email"
            dir="ltr"
            defaultValue={business.email ?? ''}
            optional
            error={pErr?.email}
          />
          <Input
            label={t.website}
            name="website"
            type="url"
            dir="ltr"
            defaultValue={business.website ?? ''}
            optional
            placeholder="https://"
            error={pErr?.website}
          />
          <div className="z-auth__row">
            <Input
              label={t.instagram}
              name="instagram"
              dir="ltr"
              defaultValue={business.instagram ?? ''}
              optional
              placeholder={t.handlePlaceholder}
              error={pErr?.instagram}
            />
            <Input
              label={t.tiktok}
              name="tiktok"
              dir="ltr"
              defaultValue={business.tiktok ?? ''}
              optional
              placeholder={t.handlePlaceholder}
              error={pErr?.tiktok}
            />
          </div>
          <Input
            label={t.facebook}
            name="facebook"
            type="url"
            dir="ltr"
            defaultValue={business.facebook ?? ''}
            optional
            placeholder="https://facebook.com/…"
            error={pErr?.facebook}
          />

          <Save label={m.common.save} />
        </form>
      </Panel>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">{t.address}</h2>
        <form action={locationAction} className="z-auth__form">
          <input type="hidden" name="businessId" value={businessId} />

          {locationState.status === 'error' ? <Alert tone="error">{locationState.message}</Alert> : null}
          {locationState.status === 'success' ? (
            <Alert tone="success">{locationState.message}</Alert>
          ) : null}

          <Input
            label={t.addressLine1}
            name="addressLine1"
            defaultValue={location?.addressLine1 ?? ''}
            required
            placeholder={t.addressLine1Placeholder}
            error={lErr?.addressLine1}
          />
          <Input
            label={t.addressLine2}
            name="addressLine2"
            defaultValue={location?.addressLine2 ?? ''}
            optional
          />

          <div className="z-auth__row">
            <Select label={t.city} name="cityId" defaultValue={location?.cityId ?? ''} optional>
              <option value="">{t.choose}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.label}
                </option>
              ))}
            </Select>
            <Input
              label={t.postalCode}
              name="postalCode"
              dir="ltr"
              defaultValue={location?.postalCode ?? ''}
              optional
            />
          </div>

          <div className="z-auth__row">
            <Input
              label={t.latitude}
              name="latitude"
              type="number"
              step="0.000001"
              defaultValue={location?.latitude ?? 36.8065}
              required
              hint={t.latitudeHint}
              error={lErr?.latitude}
            />
            <Input
              label={t.longitude}
              name="longitude"
              type="number"
              step="0.000001"
              defaultValue={location?.longitude ?? 10.1815}
              required
              error={lErr?.longitude}
            />
          </div>

          <Textarea
            label={t.directions}
            name="directions"
            defaultValue={location?.directions ?? ''}
            optional
            placeholder={t.directionsPlaceholder}
          />

          <Save label={m.common.save} />
        </form>
      </Panel>

      <Panel className="z-dash__panel">
        <h2 className="z-profile__h3">{t.rules}</h2>
        <form action={policyAction} className="z-auth__form">
          <input type="hidden" name="businessId" value={businessId} />

          {policyState.status === 'error' ? <Alert tone="error">{policyState.message}</Alert> : null}
          {policyState.status === 'success' ? <Alert tone="success">{policyState.message}</Alert> : null}

          <label className="z-check">
            <input type="checkbox" name="autoConfirm" defaultChecked={business.autoConfirm} />
            <span>
              {t.autoConfirm}
              <br />
              <span className="z-help">{t.autoConfirmHint}</span>
            </span>
          </label>

          <div className="z-auth__row">
            <Input
              label={t.slotGranularity}
              name="slotGranularityMinutes"
              type="number"
              min="5"
              max="120"
              step="5"
              defaultValue={business.slotGranularityMinutes}
              required
              hint={t.slotGranularityHint}
            />
            <Input
              label={t.minNotice}
              name="minNoticeMinutes"
              type="number"
              min="0"
              step="15"
              defaultValue={business.minNoticeMinutes}
              required
              hint={t.minNoticeHint}
            />
          </div>

          <div className="z-auth__row">
            <Input
              label={t.maxAdvance}
              name="maxAdvanceDays"
              type="number"
              min="1"
              max="365"
              defaultValue={business.maxAdvanceDays}
              required
            />
            <Input
              label={t.cancellationWindow}
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
            <span>{t.allowCancel}</span>
          </label>
          <label className="z-check">
            <input
              type="checkbox"
              name="allowCustomerReschedule"
              defaultChecked={business.allowCustomerReschedule}
            />
            <span>{t.allowReschedule}</span>
          </label>

          <Textarea
            label={t.cancellationPolicy}
            name="cancellationPolicy"
            defaultValue={business.cancellationPolicy ?? ''}
            optional
            hint={t.cancellationPolicyHint}
          />
          <Textarea
            label={t.noShowPolicy}
            name="noShowPolicy"
            defaultValue={business.noShowPolicy ?? ''}
            optional
          />

          <Save label={m.common.save} />
        </form>
      </Panel>
    </div>
  );
}
