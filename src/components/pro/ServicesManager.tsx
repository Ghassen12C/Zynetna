'use client';

import { useActionState, useState } from 'react';
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
  staff,
  categories,
  onDone,
}: {
  m: M;
  locale: Locale;
  businessId: string;
  currency: string;
  service: Service | null;
  staff: { id: string; displayName: string }[];
  categories: { id: string; label: string }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveServiceAction, idle);

  if (state.status === 'success') {
    router.refresh();
    onDone();
  }

  const errors = state.status === 'error' ? state.fieldErrors : undefined;
  const t = m.dashSetup.services;

  return (
    <Panel>
      <form action={formAction} className="z-auth__form">
        <input type="hidden" name="businessId" value={businessId} />
        {service ? <input type="hidden" name="id" value={service.id} /> : null}

        <h3 className="z-profile__h3">
          {service ? t.editTitle : t.newTitle}
        </h3>

        {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

        <Input
          label={t.name}
          name="name"
          defaultValue={service?.name ?? ''}
          required
          placeholder={t.namePlaceholder}
          error={errors?.name}
        />

        <Textarea
          label={t.description}
          name="description"
          defaultValue={service?.description ?? ''}
          optional
          placeholder={t.descriptionPlaceholder}
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
            defaultValue={service?.price ?? ''}
            required
            inputMode="decimal"
            error={errors?.priceAmount}
          />
          <Input
            label={t.duration}
            name="durationMinutes"
            type="number"
            min="5"
            step="5"
            defaultValue={service?.durationMinutes ?? 30}
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
                  <span>{member.displayName}</span>
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
  if (state.status === 'success') router.refresh();

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
  if (state.status === 'success') router.refresh();

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
  services,
  staff,
  categories,
}: {
  m: M;
  locale: Locale;
  businessId: string;
  currency: string;
  services: Service[];
  staff: { id: string; displayName: string }[];
  categories: { id: string; label: string }[];
}) {
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const t = m.dashSetup.services;

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      <div className="z-dash__panel-head">
        <div>
          <h2 className="z-profile__h3">
            {interpolate(t.heading, { count: formatNumber(services.length, locale) })}
          </h2>
          <p className="z-policy">{t.intro}</p>
        </div>
        {!creating && !editing ? (
          <Button onClick={() => setCreating(true)}>+ {t.add}</Button>
        ) : null}
      </div>

      {creating ? (
        <ServiceForm
          m={m}
          locale={locale}
          businessId={businessId}
          currency={currency}
          service={null}
          staff={staff}
          categories={categories}
          onDone={() => setCreating(false)}
        />
      ) : null}

      {editing ? (
        <ServiceForm
          m={m}
          locale={locale}
          businessId={businessId}
          currency={currency}
          service={editing}
          staff={staff}
          categories={categories}
          onDone={() => setEditing(null)}
        />
      ) : null}

      {services.length === 0 && !creating ? (
        <EmptyState
          title={t.emptyTitle}
          body={t.emptyBody}
          action={<Button onClick={() => setCreating(true)}>{t.add}</Button>}
        />
      ) : (
        <ul className="z-svc-list">
          {services.map((service) => (
            <li key={service.id} className="z-svc">
              {service.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={service.imageUrl} alt="" className="z-svc__img" />
              ) : (
                <div className="z-svc__img z-svc__img--empty" aria-hidden="true" />
              )}

              <div className="z-svc__body">
                <h3 className="z-svc__name">
                  {service.name}
                  {!service.isActive ? (
                    <>
                      {' '}
                      <Badge tone="neutral">{t.hidden}</Badge>
                    </>
                  ) : null}
                </h3>
                <p className="z-svc__duration">
                  {formatDuration(service.durationMinutes, locale)}
                  {service.bufferMinutes > 0
                    ? ` ${interpolate(t.bufferSuffix, {
                        duration: formatDuration(service.bufferMinutes, locale),
                      })}`
                    : ''}
                  {' · '}
                  {formatCount(t.staffCount, service.staffIds.length, locale)}
                  {service.bookingCount > 0
                    ? ` · ${formatCount(t.bookingCount, service.bookingCount, locale)}`
                    : ''}
                </p>
              </div>

              <div className="z-svc__aside">
                <span className="z-svc__price">{formatPrice(service.price, locale, currency)}</span>
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
          ))}
        </ul>
      )}
    </div>
  );
}
