'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge, Panel } from '@/components/ui/Primitives';
import { saveCategoryAction, toggleCategoryAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';
import { CategoryIcon } from '@/components/brand/CategoryIcon';

type Category = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  nameAr: string;
  nameEn: string;
  icon: string | null;
  servedGender: string;
  position: number;
  isActive: boolean;
  businesses: number;
  services: number;
  children: number;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Enregistrer
    </Button>
  );
}

function CategoryForm({
  category,
  roots,
  onDone,
}: {
  category: Category | null;
  roots: Category[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveCategoryAction, idle);
  if (state.status === 'success') {
    router.refresh();
    onDone();
  }
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <Panel>
      <form action={formAction} className="z-auth__form">
        {category ? <input type="hidden" name="id" value={category.id} /> : null}
        <h3 className="z-profile__h3">{category ? 'Modifier' : 'Nouvelle catégorie'}</h3>
        {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

        <Select label="Catégorie parente" name="parentId" defaultValue={category?.parentId ?? ''} optional>
          <option value="">Aucune (catégorie principale)</option>
          {roots
            .filter((r) => r.id !== category?.id)
            .map((root) => (
              <option key={root.id} value={root.id}>
                {root.name}
              </option>
            ))}
        </Select>

        <div className="z-auth__row">
          <Input label="Nom (français)" name="name" defaultValue={category?.name ?? ''} required error={errors?.name} />
          <Input label="Identifiant URL" name="slug" defaultValue={category?.slug ?? ''} required hint="minuscules-et-tirets" error={errors?.slug} />
        </div>

        <div className="z-auth__row">
          <Input label="Nom (arabe)" name="nameAr" defaultValue={category?.nameAr ?? ''} required dir="rtl" error={errors?.nameAr} />
          <Input label="Nom (anglais)" name="nameEn" defaultValue={category?.nameEn ?? ''} required error={errors?.nameEn} />
        </div>

        <div className="z-auth__row">
          <Input label="Icône" name="icon" defaultValue={category?.icon ?? ''} optional maxLength={8} placeholder="💈" error={errors?.icon} />
          <Input label="Position" name="position" type="number" min="0" defaultValue={category?.position ?? 0} required />
        </div>

        <Select label="Clientèle" name="servedGender" defaultValue={category?.servedGender ?? 'EVERYONE'}>
          <option value="EVERYONE">Hommes et femmes</option>
          <option value="WOMEN">Femmes</option>
          <option value="MEN">Hommes</option>
        </Select>

        <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
          <Submit />
          <Button type="button" variant="ghost" onClick={onDone}>
            Annuler
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function ToggleForm({ category }: { category: Category }) {
  const router = useRouter();
  const [, formAction] = useActionState(toggleCategoryAction, idle);
  return (
    <form action={formAction} onSubmit={() => setTimeout(() => router.refresh(), 400)}>
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="isActive" value={category.isActive ? 'false' : 'true'} />
      <Button type="submit" size="sm" variant="ghost">
        {category.isActive ? 'Désactiver' : 'Activer'}
      </Button>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const roots = categories.filter((c) => c.parentId === null);

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <div className="z-dash__panel-head">
        <div>
          <h1 className="z-search__title">Catégories</h1>
          <p className="z-policy">
            Deux niveaux au maximum. Une catégorie principale regroupe ses sous-catégories dans
            la recherche.
          </p>
        </div>
        {!creating && !editing ? (
          <Button onClick={() => setCreating(true)}>+ Nouvelle catégorie</Button>
        ) : null}
      </div>

      {creating ? <CategoryForm category={null} roots={roots} onDone={() => setCreating(false)} /> : null}
      {editing ? <CategoryForm category={editing} roots={roots} onDone={() => setEditing(null)} /> : null}

      <div className="z-stack" style={{ gap: 'var(--z-space-4)' }}>
        {roots.map((root) => {
          const children = categories.filter((c) => c.parentId === root.id);
          return (
            <Panel key={root.id} className="z-dash__panel">
              <div className="z-dash__panel-head">
                <div className="z-row" style={{ gap: 'var(--z-space-3)' }}>
                  <span className="z-ctile__icon" aria-hidden="true">
                    <CategoryIcon slug={root.slug} fallback={root.icon ?? '✂'} size={26} />
                  </span>
                  <div>
                    <h2 className="z-profile__h3">
                      {root.name}{' '}
                      {!root.isActive ? <Badge tone="neutral">Désactivée</Badge> : null}
                    </h2>
                    <p className="z-help">
                      {root.slug} · {root.businesses} établissements · {children.length} sous-catégories
                    </p>
                    <p className="z-help" dir="rtl" lang="ar">
                      {root.nameAr}
                    </p>
                  </div>
                </div>
                <div className="z-row" style={{ gap: 'var(--z-space-1)' }}>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(root)}>
                    Modifier
                  </Button>
                  <ToggleForm category={root} />
                </div>
              </div>

              {children.length > 0 ? (
                <ul className="z-subcats">
                  {children.map((child) => (
                    <li key={child.id}>
                      <span>
                        <strong>{child.name}</strong>
                        <span className="z-help">
                          {' '}
                          · {child.slug} · {child.services} prestations
                        </span>
                        {!child.isActive ? (
                          <>
                            {' '}
                            <Badge tone="neutral">Désactivée</Badge>
                          </>
                        ) : null}
                      </span>
                      <span className="z-row" style={{ gap: 'var(--z-space-1)' }}>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(child)}>
                          Modifier
                        </Button>
                        <ToggleForm category={child} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
