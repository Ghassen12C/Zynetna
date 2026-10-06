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
import { formatDuration, formatPrice } from '@/i18n/format';

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

function SaveButton({ label = 'Enregistrer' }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

function ServiceForm({
  businessId,
  currency,
  service,
  staff,
  categories,
  onDone,
}: {
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

  return (
    <Panel>
      <form action={formAction} className="z-auth__form">
        <input type="hidden" name="businessId" value={businessId} />
        {service ? <input type="hidden" name="id" value={service.id} /> : null}

        <h3 className="z-profile__h3">
          {service ? 'Modifier la prestation' : 'Nouvelle prestation'}
        </h3>

        {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

        <Input
          label="Nom"
          name="name"
          defaultValue={service?.name ?? ''}
          required
          placeholder="Coupe homme"
          error={errors?.name}
        />

        <Textarea
          label="Description"
          name="description"
          defaultValue={service?.description ?? ''}
          optional
          placeholder="Ce que comprend la prestation."
          error={errors?.description}
        />

        <Select label="Catégorie" name="categoryId" defaultValue={service?.categoryId ?? ''} optional>
          <option value="">Aucune</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </Select>

        <div className="z-auth__row">
          <Input
            label={`Prix (${currency})`}
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
            label="Durée (min)"
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
            label="Préparation (min)"
            name="prepMinutes"
            type="number"
            min="0"
            step="5"
            defaultValue={service?.prepMinutes ?? 0}
            hint="Avant le client."
            error={errors?.prepMinutes}
          />
          <Input
            label="Battement (min)"
            name="bufferMinutes"
            type="number"
            min="0"
            step="5"
            defaultValue={service?.bufferMinutes ?? 0}
            hint="Nettoyage, remise en place."
            error={errors?.bufferMinutes}
          />
        </div>

        <fieldset className="z-fieldset">
          <legend className="z-label">Qui réalise cette prestation ?</legend>
          {staff.length === 0 ? (
            <p className="z-help">Ajoutez d’abord un membre d’équipe.</p>
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
          <p className="z-help">
            Seuls les professionnels cochés apparaîtront à la réservation pour cette prestation.
          </p>
        </fieldset>

        <label className="z-check">
          <input type="checkbox" name="isActive" defaultChecked={service?.isActive ?? true} />
          <span>Prestation visible et réservable</span>
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

function ServiceImageForm({ businessId, serviceId }: { businessId: string; serviceId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(uploadServiceMediaAction, idle);
  if (state.status === 'success') router.refresh();

  return (
    <form action={formAction} className="z-inline-upload">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="serviceId" value={serviceId} />
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

function DeleteServiceForm({ businessId, serviceId, bookingCount }: {
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
        Supprimer
      </Button>
    );
  }

  return (
    <form action={formAction} className="z-row" style={{ gap: 'var(--z-space-2)' }}>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <span className="z-help">
        {bookingCount > 0 ? 'Sera désactivée (historique conservé).' : 'Confirmer ?'}
      </span>
      <Button type="submit" variant="danger" size="sm">
        Oui
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Non
      </Button>
    </form>
  );
}

export function ServicesManager({
  businessId,
  currency,
  services,
  staff,
  categories,
}: {
  businessId: string;
  currency: string;
  services: Service[];
  staff: { id: string; displayName: string }[];
  categories: { id: string; label: string }[];
}) {
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      <div className="z-dash__panel-head">
        <div>
          <h2 className="z-profile__h3">Prestations ({services.length})</h2>
          <p className="z-policy">
            Le prix et la durée que vous définissez ici sont ceux que voient vos clients.
          </p>
        </div>
        {!creating && !editing ? (
          <Button onClick={() => setCreating(true)}>+ Ajouter une prestation</Button>
        ) : null}
      </div>

      {creating ? (
        <ServiceForm
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
          title="Aucune prestation"
          body="Ajoutez vos prestations avec leur prix et leur durée — c’est ce que vos clients réservent."
          action={<Button onClick={() => setCreating(true)}>Ajouter une prestation</Button>}
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
                      <Badge tone="neutral">Masquée</Badge>
                    </>
                  ) : null}
                </h3>
                <p className="z-svc__duration">
                  {formatDuration(service.durationMinutes)}
                  {service.bufferMinutes > 0 ? ` + ${service.bufferMinutes} min battement` : ''}
                  {' · '}
                  {service.staffIds.length} professionnel{service.staffIds.length > 1 ? 's' : ''}
                  {service.bookingCount > 0 ? ` · ${service.bookingCount} réservations` : ''}
                </p>
              </div>

              <div className="z-svc__aside">
                <span className="z-svc__price">{formatPrice(service.price, 'fr', currency)}</span>
                <div className="z-row" style={{ gap: 'var(--z-space-1)', flexWrap: 'wrap' }}>
                  <ServiceImageForm businessId={businessId} serviceId={service.id} />
                  <Button variant="secondary" size="sm" onClick={() => setEditing(service)}>
                    Modifier
                  </Button>
                  <DeleteServiceForm
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
