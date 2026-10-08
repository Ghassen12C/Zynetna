'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Badge, EmptyState, Panel } from '@/components/ui/Primitives';
import { deleteStaffAction, saveStaffAction } from '@/server/actions/business';
import { uploadStaffAvatarAction } from '@/server/actions/media';
import { idle } from '@/lib/formState';
import { formatCount, formatNumber } from '@/i18n/format';
import type { Locale } from '@/i18n/config';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';

type M = { dashSetup: Messages['dashSetup']; common: Messages['common'] };

type Member = {
  id: string;
  displayName: string;
  title: string | null;
  bio: string | null;
  specialties: string[];
  isBookable: boolean;
  isActive: boolean;
  serviceIds: string[];
  avatarUrl: string | null;
  reservationCount: number;
};

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

function MemberForm({
  m,
  businessId,
  member,
  services,
  onDone,
}: {
  m: M;
  businessId: string;
  member: Member | null;
  services: { id: string; name: string; isActive: boolean }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveStaffAction, idle);

  // After the render, never during it: refreshing is a state update elsewhere.
  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;
  const t = m.dashSetup.team;

  return (
    <Panel>
      <form action={formAction} className="z-auth__form">
        <input type="hidden" name="businessId" value={businessId} />
        {member ? <input type="hidden" name="id" value={member.id} /> : null}

        <h3 className="z-profile__h3">{member ? t.editTitle : t.newTitle}</h3>
        {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

        <div className="z-auth__row">
          <Input
            label={t.displayName}
            name="displayName"
            defaultValue={member?.displayName ?? ''}
            required
            placeholder={t.displayNamePlaceholder}
            error={errors?.displayName}
          />
          <Input
            label={t.title}
            name="title"
            defaultValue={member?.title ?? ''}
            optional
            placeholder={t.titlePlaceholder}
            error={errors?.title}
          />
        </div>

        <Textarea
          label={t.bio}
          name="bio"
          defaultValue={member?.bio ?? ''}
          optional
          placeholder={t.bioPlaceholder}
          error={errors?.bio}
        />

        <Input
          label={t.specialties}
          name="specialties"
          defaultValue={member?.specialties.join(', ') ?? ''}
          optional
          hint={t.specialtiesHint}
          placeholder={t.specialtiesPlaceholder}
          error={errors?.specialties}
        />

        <fieldset className="z-fieldset">
          <legend className="z-label">{t.servicesPerformed}</legend>
          {services.length === 0 ? (
            <p className="z-help">{t.addServicesFirst}</p>
          ) : (
            <div className="z-checkgrid">
              {services.map((service) => (
                <label key={service.id} className="z-check">
                  <input
                    type="checkbox"
                    name="serviceIds"
                    value={service.id}
                    defaultChecked={member?.serviceIds.includes(service.id) ?? true}
                  />
                  <span>{service.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <label className="z-check">
          <input type="checkbox" name="isBookable" defaultChecked={member?.isBookable ?? true} />
          <span>{t.bookable}</span>
        </label>
        <label className="z-check">
          <input type="checkbox" name="isActive" defaultChecked={member?.isActive ?? true} />
          <span>{t.active}</span>
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

function AvatarForm({ m, businessId, staffId }: { m: M; businessId: string; staffId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(uploadStaffAvatarAction, idle);
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="z-inline-upload">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="staffId" value={staffId} />
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

function DeleteMemberForm({
  m,
  businessId,
  staffId,
}: {
  m: M;
  businessId: string;
  staffId: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(deleteStaffAction, idle);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  return (
    <>
      {state.status === 'error' ? <span className="z-error">{state.message}</span> : null}
      {confirming ? (
        <form action={formAction} className="z-row" style={{ gap: 'var(--z-space-2)' }}>
          <input type="hidden" name="businessId" value={businessId} />
          <input type="hidden" name="staffId" value={staffId} />
          <Button type="submit" variant="danger" size="sm">
            {m.common.confirm}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            {m.common.cancel}
          </Button>
        </form>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          {m.common.delete}
        </Button>
      )}
    </>
  );
}

export function TeamManager({
  m,
  locale,
  businessId,
  staff,
  services,
}: {
  m: M;
  locale: Locale;
  businessId: string;
  staff: Member[];
  services: { id: string; name: string; isActive: boolean }[];
}) {
  const [editing, setEditing] = useState<Member | null>(null);
  const [creating, setCreating] = useState(false);
  const t = m.dashSetup.team;

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      <div className="z-dash__panel-head">
        <div>
          <h2 className="z-profile__h3">
            {interpolate(t.heading, { count: formatNumber(staff.length, locale) })}
          </h2>
          <p className="z-policy">{t.intro}</p>
        </div>
        {!creating && !editing ? (
          <Button onClick={() => setCreating(true)}>+ {t.add}</Button>
        ) : null}
      </div>

      {creating ? (
        <MemberForm
          m={m}
          businessId={businessId}
          member={null}
          services={services}
          onDone={() => setCreating(false)}
        />
      ) : null}
      {editing ? (
        <MemberForm
          m={m}
          businessId={businessId}
          member={editing}
          services={services}
          onDone={() => setEditing(null)}
        />
      ) : null}

      {staff.length === 0 && !creating ? (
        <EmptyState
          title={t.emptyTitle}
          body={t.emptyBody}
          action={<Button onClick={() => setCreating(true)}>{t.add}</Button>}
        />
      ) : (
        <div className="z-grid z-grid--3">
          {staff.map((member) => (
            <article key={member.id} className="z-panel z-member">
              <div className="z-member__head">
                <div className="z-team__avatar">
                  {member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.avatarUrl} alt="" />
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
                <div>
                  <h3 className="z-team__name">{member.displayName}</h3>
                  {member.title ? <p className="z-team__title">{member.title}</p> : null}
                </div>
              </div>

              <div className="z-member__badges">
                {!member.isActive ? <Badge tone="neutral">{t.inactive}</Badge> : null}
                {member.isActive && !member.isBookable ? (
                  <Badge tone="warning">{t.notBookable}</Badge>
                ) : null}
                <Badge tone="accent">
                  {formatCount(t.serviceCount, member.serviceIds.length, locale)}
                </Badge>
                {member.reservationCount > 0 ? (
                  <Badge tone="neutral">
                    {formatCount(t.appointmentCount, member.reservationCount, locale)}
                  </Badge>
                ) : null}
              </div>

              {member.specialties.length > 0 ? (
                <p className="z-team__specialties">{member.specialties.join(' · ')}</p>
              ) : null}

              <div className="z-member__actions">
                <AvatarForm m={m} businessId={businessId} staffId={member.id} />
                <Button variant="secondary" size="sm" onClick={() => setEditing(member)}>
                  {m.common.edit}
                </Button>
                <DeleteMemberForm m={m} businessId={businessId} staffId={member.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
