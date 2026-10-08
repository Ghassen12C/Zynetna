'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Badge, EmptyState, Panel } from '@/components/ui/Primitives';
import { deleteServiceAction, saveServiceAction } from '@/server/actions/business';
import { uploadServiceMediaAction } from '@/server/actions/media';
import { idle } from '@/lib/formState';
import { formatCount, formatDuration, formatNumber, formatPrice } from '@/i18n/format';
import { LOCALE_META, type Locale } from '@/i18n/config';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';

type M = { dashSetup: Messages['dashSetup']; common: Messages['common'] };

/** The currency as this locale writes it: "DT", "TND", "د.ت.". */
function currencySymbol(currency: string, locale: Locale): string {
  try {
    const parts = new Intl.NumberFormat(LOCALE_META[locale].intl, {
      style: 'currency',
      currency,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

type Service = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  price: number;
  durationMinutes: number;
  bufferMinutes: number;
  prepMinutes: number;
  minNoticeMinutes: number | null;
  isActive: boolean;
  staffIds: string[];
  imageUrl: string | null;
  bookingCount: number;
  isPackage: boolean;
  /** For a pack: the regular services it bundles. */
  includedIds: string[];
  maxAdvanceDays: number | null;
  requiresConfirmation: boolean;
};

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

function ServiceForm({
  m,
  locale,
  businessId,
  currency,
  service,
  isPackage,
  regular,
  businessMaxAdvanceDays,
  staff,
  categories,
  onDone,
}: {
  m: M;
  locale: Locale;
  businessId: string;
  currency: string;
  service: Service | null;
  /** A pack form (bundle of services) rather than a single service. */
  isPackage: boolean;
  /** The business's regular services — what a pack can bundle. */
  regular: Service[];
  businessMaxAdvanceDays: number;
  staff: { id: string; displayName: string }[];
  categories: { id: string; label: string }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveServiceAction, idle);
  const [included, setIncluded] = useState<string[]>(service?.includedIds ?? []);
  const [price, setPrice] = useState<string>(service ? String(service.price) : '');
  const [duration, setDuration] = useState<string>(String(service?.durationMinutes ?? 30));
  const [durationTouched, setDurationTouched] = useState(Boolean(service));
  const [noticeHours, setNoticeHours] = useState<string>(
    service?.minNoticeMinutes != null ? String(Math.round(service.minNoticeMinutes / 60)) : '',
  );

  // After the render, never during it: refreshing is a state update elsewhere.
  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);

  const errors = state.status === 'error' ? state.fieldErrors : undefined;
  const t = m.dashSetup.services;
  const chosen = regular.filter((r) => included.includes(r.id));
  const separateValue = chosen.reduce((sum, r) => sum + r.price, 0);
  const separateDuration = chosen.reduce((sum, r) => sum + r.durationMinutes, 0);
  const saving = separateValue - Number(price || 0);

  function toggle(id: string) {
    const next = included.includes(id) ? included.filter((x) => x !== id) : [...included, id];
    setIncluded(next);
    // Until the owner sets a duration, follow the bundled services' total.
    if (!durationTouched) {
      const total = regular
        .filter((r) => next.includes(r.id))
        .reduce((sum, r) => sum + r.durationMinutes, 0);
      if (total > 0) setDuration(String(total));
    }
  }

  return (
    <Panel>
      <form action={formAction} className="z-auth__form">
        <input type="hidden" name="businessId" value={businessId} />
        {service ? <input type="hidden" name="id" value={service.id} /> : null}
        {isPackage && !service ? <input type="hidden" name="isPackage" value="true" /> : null}

        <h3 className="z-profile__h3">
          {isPackage
            ? service
              ? t.editPackTitle
              : t.newPackTitle
            : service
              ? t.editTitle
              : t.newTitle}
        </h3>
        {isPackage ? <p className="z-policy">{t.packIntro}</p> : null}

        {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

        <Input
          label={t.name}
          name="name"
          defaultValue={service?.name ?? ''}
          required
          placeholder={isPackage ? t.packNamePlaceholder : t.namePlaceholder}
          error={errors?.name}
        />

        {isPackage ? (
          <fieldset className="z-fieldset">
            <legend className="z-label">{t.included}</legend>
            {regular.length < 2 ? (
              <p className="z-help">{t.needTwoServices}</p>
            ) : (
              <div className="z-checkgrid">
                {regular.map((r) => (
                  <label key={r.id} className="z-check">
                    <input
                      type="checkbox"
                      name="includedServiceIds"
                      value={r.id}
                      checked={included.includes(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                    <span>
                      <span dir="auto">{r.name}</span>{' '}
                      <span className="z-help">
                        · {formatPrice(r.price, locale, currency)} ·{' '}
                        {formatDuration(r.durationMinutes, locale)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {chosen.length > 0 ? (
              <p className="z-help">
                {interpolate(t.separateValue, {
                  price: formatPrice(separateValue, locale, currency),
                  duration: formatDuration(separateDuration, locale),
                })}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        <Textarea
          label={t.description}
          name="description"
          defaultValue={service?.description ?? ''}
          optional
          placeholder={isPackage ? t.packDescriptionPlaceholder : t.descriptionPlaceholder}
          error={errors?.description}
        />

        <Select
          label={t.category}
          name="categoryId"
          defaultValue={service?.categoryId ?? ''}
          optional
        >
          <option value="">{m.dashSetup.shared.none}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </Select>

        <div className="z-auth__row">
          <Input
            label={interpolate(t.price, { currency: currencySymbol(currency, locale) })}
            name="priceAmount"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            inputMode="decimal"
            hint={
              isPackage && chosen.length > 0 && saving > 0
                ? interpolate(t.saving, { price: formatPrice(saving, locale, currency) })
                : undefined
            }
            error={errors?.priceAmount}
          />
          <Input
            label={t.duration}
            name="durationMinutes"
            type="number"
            min="5"
            step="5"
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value);
              setDurationTouched(true);
            }}
            required
            inputMode="numeric"
            error={errors?.durationMinutes}
          />
        </div>

        <div className="z-auth__row">
          <Input
            label={t.prep}
            name="prepMinutes"
            type="number"
            min="0"
            step="5"
            defaultValue={service?.prepMinutes ?? 0}
            hint={t.prepHint}
            error={errors?.prepMinutes}
          />
          <Input
            label={t.buffer}
            name="bufferMinutes"
            type="number"
            min="0"
            step="5"
            defaultValue={service?.bufferMinutes ?? 0}
            hint={t.bufferHint}
            error={errors?.bufferMinutes}
          />
        </div>

        {/* Packs are planned ahead and often discussed first, so their booking
            options are open; for a single service they stay tucked away. */}
        <details className="z-details" open={isPackage || undefined}>
          <summary className="z-label">{t.bookingOptions}</summary>
          <div className="z-auth__form">
            <div className="z-auth__row">
              <Input
                label={t.maxAdvance}
                name="maxAdvanceDays"
                type="number"
                min="1"
                max="400"
                defaultValue={service?.maxAdvanceDays ?? (isPackage && !service ? 365 : '')}
                inputMode="numeric"
                optional
                hint={interpolate(t.maxAdvanceHint, { days: businessMaxAdvanceDays })}
                error={errors?.maxAdvanceDays}
              />
              <Input
                label={t.minNotice}
                type="number"
                min="0"
                max="1440"
                value={noticeHours}
                onChange={(e) => setNoticeHours(e.target.value)}
                inputMode="numeric"
                optional
                hint={t.minNoticeHint}
                error={errors?.minNoticeMinutes}
              />
              <input
                type="hidden"
                name="minNoticeMinutes"
                value={noticeHours === '' ? '' : String(Math.round(Number(noticeHours) * 60))}
              />
            </div>
            <label className="z-check">
              <input
                type="checkbox"
                name="requiresConfirmation"
                defaultChecked={service?.requiresConfirmation ?? isPackage}
              />
              <span>
                {t.requiresConfirmation}
                <span className="z-help"> — {t.requiresConfirmationHint}</span>
              </span>
            </label>
          </div>
        </details>

        <fieldset className="z-fieldset">
          <legend className="z-label">{t.whoPerforms}</legend>
          {staff.length === 0 ? (
            <p className="z-help">{t.addStaffFirst}</p>
          ) : (
            <div className="z-checkgrid">
              {staff.map((member) => (
                <label key={member.id} className="z-check">
                  <input
                    type="checkbox"
                    name="staffIds"
                    value={member.id}
                    defaultChecked={service?.staffIds.includes(member.id) ?? true}
                  />
                  <span dir="auto">{member.displayName}</span>
                </label>
              ))}
            </div>
          )}
          <p className="z-help">{t.staffHelp}</p>
        </fieldset>

        <label className="z-check">
          <input type="checkbox" name="isActive" defaultChecked={service?.isActive ?? true} />
          <span>{t.visible}</span>
        </label>

        <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
          <SaveButton label={m.common.save} />
          <Button type="button" variant="ghost" onClick={onDone}>
            {m.common.cancel}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function ServiceImageForm({
  m,
  businessId,
  serviceId,
}: {
  m: M;
  businessId: string;
  serviceId: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(uploadServiceMediaAction, idle);
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="z-inline-upload">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <label className="z-btn z-btn--ghost z-btn--sm">
        {m.dashSetup.shared.photo}
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="z-sr-only"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
      </label>
      {state.status === 'error' ? <span className="z-error">{state.message}</span> : null}
    </form>
  );
}

function DeleteServiceForm({ m, businessId, serviceId, bookingCount }: {
  m: M;
  businessId: string;
  serviceId: string;
  bookingCount: number;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(deleteServiceAction, idle);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        {m.common.delete}
      </Button>
    );
  }

  return (
    <form action={formAction} className="z-row" style={{ gap: 'var(--z-space-2)' }}>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <span className="z-help">
        {bookingCount > 0
          ? m.dashSetup.services.willDeactivate
          : m.dashSetup.services.confirmDelete}
      </span>
      <Button type="submit" variant="danger" size="sm">
        {m.common.yes}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        {m.common.no}
      </Button>
    </form>
  );
}

export function ServicesManager({
  m,
  locale,
  businessId,
  currency,
  businessMaxAdvanceDays,
  services,
  staff,
  categories,
}: {
  m: M;
  locale: Locale;
  businessId: string;
  currency: string;
  businessMaxAdvanceDays: number;
  services: Service[];
  staff: { id: string; displayName: string }[];
  categories: { id: string; label: string }[];
}) {
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState<'service' | 'package' | null>(null);
  const t = m.dashSetup.services;
  const packs = services.filter((s) => s.isPackage);
  const regular = services.filter((s) => !s.isPackage);
  const byId = new Map(services.map((s) => [s.id, s]));

  const form = (service: Service | null, isPackage: boolean, onDone: () => void) => (
    <ServiceForm
      m={m}
      locale={locale}
      businessId={businessId}
      currency={currency}
      service={service}
      isPackage={isPackage}
      regular={regular}
      businessMaxAdvanceDays={businessMaxAdvanceDays}
      staff={staff}
      categories={categories}
      onDone={onDone}
    />
  );

  const row = (service: Service) => {
    const parts = service.includedIds.map((id) => byId.get(id)).filter(Boolean) as Service[];
    const value = parts.reduce((sum, p) => sum + p.price, 0);
    return (
      <li key={service.id} className={`z-svc ${service.isPackage ? 'z-svc--pack' : ''}`}>
        {service.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={service.imageUrl} alt="" className="z-svc__img" />
        ) : (
          <div className="z-svc__img z-svc__img--empty" aria-hidden="true" />
        )}

        <div className="z-svc__body">
          <h3 className="z-svc__name">
            <span dir="auto">{service.name}</span>
            {!service.isActive ? (
              <>
                {' '}
                <Badge tone="neutral">{t.hidden}</Badge>
              </>
            ) : null}
            {service.requiresConfirmation ? (
              <>
                {' '}
                <Badge tone="warning">{t.onRequest}</Badge>
              </>
            ) : null}
          </h3>
          {service.isPackage && parts.length > 0 ? (
            <p className="z-svc__includes">
              {parts.map((p, i) => (
                <span key={p.id}>
                  {i > 0 ? ' + ' : ''}
                  <bdi>{p.name}</bdi>
                </span>
              ))}
            </p>
          ) : null}
          <p className="z-svc__duration">
            {formatDuration(service.durationMinutes, locale)}
            {service.bufferMinutes > 0
              ? ` ${interpolate(t.bufferSuffix, {
                  duration: formatDuration(service.bufferMinutes, locale),
                })}`
              : ''}
            {' · '}
            {formatCount(t.staffCount, service.staffIds.length, locale)}
            {service.maxAdvanceDays
              ? ` · ${interpolate(t.upToDays, { days: formatNumber(service.maxAdvanceDays, locale) })}`
              : ''}
            {service.bookingCount > 0
              ? ` · ${formatCount(t.bookingCount, service.bookingCount, locale)}`
              : ''}
          </p>
        </div>

        <div className="z-svc__aside">
          <span className="z-svc__price">{formatPrice(service.price, locale, currency)}</span>
          {service.isPackage && value > service.price ? (
            <span className="z-svc__was">
              {interpolate(t.insteadOf, { price: formatPrice(value, locale, currency) })}
            </span>
          ) : null}
          <div className="z-row" style={{ gap: 'var(--z-space-1)', flexWrap: 'wrap' }}>
            <ServiceImageForm m={m} businessId={businessId} serviceId={service.id} />
            <Button variant="secondary" size="sm" onClick={() => setEditing(service)}>
              {m.common.edit}
            </Button>
            <DeleteServiceForm
              m={m}
              businessId={businessId}
              serviceId={service.id}
              bookingCount={service.bookingCount}
            />
          </div>
        </div>
      </li>
    );
  };

  const idle = !creating && !editing;

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      <div className="z-dash__panel-head">
        <div>
          <h2 className="z-profile__h3">
            {interpolate(t.heading, { count: formatNumber(regular.length, locale) })}
          </h2>
          <p className="z-policy">{t.intro}</p>
        </div>
        {idle ? (
          <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setCreating('package')}>
              + {t.addPack}
            </Button>
            <Button onClick={() => setCreating('service')}>+ {t.add}</Button>
          </div>
        ) : null}
      </div>

      {creating ? form(null, creating === 'package', () => setCreating(null)) : null}
      {editing ? form(editing, editing.isPackage, () => setEditing(null)) : null}

      {packs.length > 0 ? (
        <section className="z-stack" style={{ gap: 'var(--z-space-3)' }}>
          <div>
            <h3 className="z-profile__h3">{t.packsHeading}</h3>
            <p className="z-policy">{t.packsLead}</p>
          </div>
          <ul className="z-svc-list">{packs.map(row)}</ul>
        </section>
      ) : null}

      {regular.length === 0 && !creating ? (
        <EmptyState
          title={t.emptyTitle}
          body={t.emptyBody}
          action={<Button onClick={() => setCreating('service')}>{t.add}</Button>}
        />
      ) : (
        <ul className="z-svc-list">{regular.map(row)}</ul>
      )}
    </div>
  );
}
