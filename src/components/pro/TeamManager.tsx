'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Badge, EmptyState, Panel } from '@/components/ui/Primitives';
import { deleteStaffAction, saveStaffAction } from '@/server/actions/business';
import { uploadStaffAvatarAction } from '@/server/actions/media';
import { idle } from '@/lib/formState';

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

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Enregistrer
    </Button>
  );
}

function MemberForm({
  businessId,
  member,
  services,
  onDone,
}: {
  businessId: string;
  member: Member | null;
  services: { id: string; name: string; isActive: boolean }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveStaffAction, idle);

  if (state.status === 'success') {
    router.refresh();
    onDone();
  }
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <Panel>
      <form action={formAction} className="z-auth__form">
        <input type="hidden" name="businessId" value={businessId} />
        {member ? <input type="hidden" name="id" value={member.id} /> : null}

        <h3 className="z-profile__h3">{member ? 'Modifier le profil' : 'Nouveau membre'}</h3>
        {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

        <div className="z-auth__row">
          <Input
            label="Nom affiché"
            name="displayName"
            defaultValue={member?.displayName ?? ''}
            required
            placeholder="Sarah Ben Amor"
            error={errors?.displayName}
          />
          <Input
            label="Fonction"
            name="title"
            defaultValue={member?.title ?? ''}
            optional
            placeholder="Coloriste"
            error={errors?.title}
          />
        </div>

        <Textarea
          label="Présentation"
          name="bio"
          defaultValue={member?.bio ?? ''}
          optional
          placeholder="Quelques mots visibles sur la page publique."
          error={errors?.bio}
        />

        <Input
          label="Spécialités"
          name="specialties"
          defaultValue={member?.specialties.join(', ') ?? ''}
          optional
          hint="Séparées par des virgules."
          placeholder="Coloration, Balayage"
          error={errors?.specialties}
        />

        <fieldset className="z-fieldset">
          <legend className="z-label">Prestations réalisées</legend>
          {services.length === 0 ? (
            <p className="z-help">Ajoutez d’abord des prestations.</p>
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
          <span>Réservable en ligne par les clients</span>
        </label>
        <label className="z-check">
          <input type="checkbox" name="isActive" defaultChecked={member?.isActive ?? true} />
          <span>Profil actif et visible sur la page publique</span>
        </label>

        <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
          <SaveButton />
          <Button type="button" variant="ghost" onClick={onDone}>
            Annuler
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function AvatarForm({ businessId, staffId }: { businessId: string; staffId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(uploadStaffAvatarAction, idle);
  if (state.status === 'success') router.refresh();

  return (
    <form action={formAction} className="z-inline-upload">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="staffId" value={staffId} />
      <label className="z-btn z-btn--ghost z-btn--sm">
        Photo
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

function DeleteMemberForm({ businessId, staffId }: { businessId: string; staffId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(deleteStaffAction, idle);
  const [confirming, setConfirming] = useState(false);
  if (state.status === 'success') router.refresh();

  return (
    <>
      {state.status === 'error' ? <span className="z-error">{state.message}</span> : null}
      {confirming ? (
        <form action={formAction} className="z-row" style={{ gap: 'var(--z-space-2)' }}>
          <input type="hidden" name="businessId" value={businessId} />
          <input type="hidden" name="staffId" value={staffId} />
          <Button type="submit" variant="danger" size="sm">
            Confirmer
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Non
          </Button>
        </form>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          Supprimer
        </Button>
      )}
    </>
  );
}

export function TeamManager({
  businessId,
  staff,
  services,
}: {
  businessId: string;
  staff: Member[];
  services: { id: string; name: string; isActive: boolean }[];
}) {
  const [editing, setEditing] = useState<Member | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      <div className="z-dash__panel-head">
        <div>
          <h2 className="z-profile__h3">Équipe ({staff.length})</h2>
          <p className="z-policy">
            Chaque professionnel ne propose que les prestations que vous lui attribuez.
          </p>
        </div>
        {!creating && !editing ? (
          <Button onClick={() => setCreating(true)}>+ Ajouter un membre</Button>
        ) : null}
      </div>

      {creating ? (
        <MemberForm
          businessId={businessId}
          member={null}
          services={services}
          onDone={() => setCreating(false)}
        />
      ) : null}
      {editing ? (
        <MemberForm
          businessId={businessId}
          member={editing}
          services={services}
          onDone={() => setEditing(null)}
        />
      ) : null}

      {staff.length === 0 && !creating ? (
        <EmptyState
          title="Aucun membre d’équipe"
          body="Ajoutez les personnes qui réalisent vos prestations — les clients choisissent avec qui réserver."
          action={<Button onClick={() => setCreating(true)}>Ajouter un membre</Button>}
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
                {!member.isActive ? <Badge tone="neutral">Désactivé</Badge> : null}
                {member.isActive && !member.isBookable ? (
                  <Badge tone="warning">Non réservable</Badge>
                ) : null}
                <Badge tone="accent">
                  {member.serviceIds.length} prestation{member.serviceIds.length > 1 ? 's' : ''}
                </Badge>
                {member.reservationCount > 0 ? (
                  <Badge tone="neutral">{member.reservationCount} RDV</Badge>
                ) : null}
              </div>

              {member.specialties.length > 0 ? (
                <p className="z-team__specialties">{member.specialties.join(' · ')}</p>
              ) : null}

              <div className="z-member__actions">
                <AvatarForm businessId={businessId} staffId={member.id} />
                <Button variant="secondary" size="sm" onClick={() => setEditing(member)}>
                  Modifier
                </Button>
                <DeleteMemberForm businessId={businessId} staffId={member.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
