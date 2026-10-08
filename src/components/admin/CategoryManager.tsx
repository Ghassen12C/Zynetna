'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge, Panel } from '@/components/ui/Primitives';
import { saveCategoryAction, toggleCategoryAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';
import { CategoryIcon } from '@/components/brand/CategoryIcon';
import type { Messages } from '@/i18n';
import type { Locale } from '@/i18n/config';
import { formatCount, localizedName } from '@/i18n/format';

type AdminMessages = Pick<Messages, 'admin' | 'labels' | 'common'>;

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

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

/** The names in the other two languages, so an admin can check every translation. */
function OtherNames({ category, locale }: { category: Category; locale: Locale }) {
  const names = [
    { lang: 'fr', dir: 'ltr' as const, value: category.name },
    { lang: 'ar', dir: 'rtl' as const, value: category.nameAr },
    { lang: 'en', dir: 'ltr' as const, value: category.nameEn },
  ].filter((n) => n.lang !== locale && n.value);
  return (
    <span className="z-help">
      {names.map((n, i) => (
        <span key={n.lang}>
          {i > 0 ? ' · ' : null}
          <bdi lang={n.lang} dir={n.dir}>
            {n.value}
          </bdi>
        </span>
      ))}
    </span>
  );
}

function CategoryForm({
  category,
  roots,
  onDone,
  m,
  locale,
}: {
  category: Category | null;
  roots: Category[];
  onDone: () => void;
  m: AdminMessages;
  locale: Locale;
}) {
  const k = m.admin.categories;
  const router = useRouter();
  const [state, formAction] = useActionState(saveCategoryAction, idle);
  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);
  const errors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <Panel>
      <form action={formAction} className="z-auth__form">
        {category ? <input type="hidden" name="id" value={category.id} /> : null}
        <h3 className="z-profile__h3">{category ? k.editTitle : k.newTitle}</h3>
        {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}

        <Select
          label={k.parent}
          name="parentId"
          defaultValue={category?.parentId ?? ''}
          optional
        >
          <option value="">{k.noParent}</option>
          {roots
            .filter((r) => r.id !== category?.id)
            .map((root) => (
              <option key={root.id} value={root.id}>
                {localizedName(root, locale)}
              </option>
            ))}
        </Select>

        <div className="z-auth__row">
          <Input
            label={k.nameFr}
            name="name"
            defaultValue={category?.name ?? ''}
            required
            lang="fr"
            dir="ltr"
            error={errors?.name}
          />
          <Input
            label={k.slug}
            name="slug"
            defaultValue={category?.slug ?? ''}
            required
            dir="ltr"
            hint={k.slugHint}
            error={errors?.slug}
          />
        </div>

        <div className="z-auth__row">
          <Input
            label={k.nameAr}
            name="nameAr"
            defaultValue={category?.nameAr ?? ''}
            required
            lang="ar"
            dir="rtl"
            error={errors?.nameAr}
          />
          <Input
            label={k.nameEn}
            name="nameEn"
            defaultValue={category?.nameEn ?? ''}
            required
            lang="en"
            dir="ltr"
            error={errors?.nameEn}
          />
        </div>

        <div className="z-auth__row">
          <Input
            label={k.icon}
            name="icon"
            defaultValue={category?.icon ?? ''}
            optional
            maxLength={8}
            placeholder="💈"
            error={errors?.icon}
          />
          <Input
            label={k.position}
            name="position"
            type="number"
            min="0"
            defaultValue={category?.position ?? 0}
            required
          />
        </div>

        <Select label={k.audience} name="servedGender" defaultValue={category?.servedGender ?? 'EVERYONE'}>
          <option value="EVERYONE">{k.audienceEveryone}</option>
          <option value="WOMEN">{m.labels.servedGender.WOMEN}</option>
          <option value="MEN">{m.labels.servedGender.MEN}</option>
        </Select>

        <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
          <Submit label={m.common.save} />
          <Button type="button" variant="ghost" onClick={onDone}>
            {m.common.cancel}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function ToggleForm({ category, m }: { category: Category; m: AdminMessages }) {
  const router = useRouter();
  const [, formAction] = useActionState(toggleCategoryAction, idle);
  return (
    <form action={formAction} onSubmit={() => setTimeout(() => router.refresh(), 400)}>
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="isActive" value={category.isActive ? 'false' : 'true'} />
      <Button type="submit" size="sm" variant="ghost">
        {category.isActive ? m.admin.categories.deactivate : m.admin.categories.activate}
      </Button>
    </form>
  );
}

export function CategoryManager({
  categories,
  m,
  locale,
}: {
  categories: Category[];
  m: AdminMessages;
  locale: Locale;
}) {
  const k = m.admin.categories;
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const roots = categories.filter((c) => c.parentId === null);

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-5)' }}>
      <div className="z-dash__panel-head">
        <div>
          <h1 className="z-search__title">{m.admin.nav.categories}</h1>
          <p className="z-policy">{k.lead}</p>
        </div>
        {!creating && !editing ? (
          <Button onClick={() => setCreating(true)}>{k.create}</Button>
        ) : null}
      </div>

      {creating ? (
        <CategoryForm
          category={null}
          roots={roots}
          onDone={() => setCreating(false)}
          m={m}
          locale={locale}
        />
      ) : null}
      {editing ? (
        <CategoryForm
          category={editing}
          roots={roots}
          onDone={() => setEditing(null)}
          m={m}
          locale={locale}
        />
      ) : null}

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
                      {localizedName(root, locale)}{' '}
                      {!root.isActive ? <Badge tone="neutral">{k.inactive}</Badge> : null}
                    </h2>
                    <p className="z-help">
                      <bdi dir="ltr">{root.slug}</bdi> ·{' '}
                      {formatCount(m.admin.common.businessesCount, root.businesses, locale)} ·{' '}
                      {formatCount(k.subcategoriesCount, children.length, locale)}
                    </p>
                    <p>
                      <OtherNames category={root} locale={locale} />
                    </p>
                  </div>
                </div>
                <div className="z-row" style={{ gap: 'var(--z-space-1)', flexWrap: 'wrap' }}>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(root)}>
                    {m.common.edit}
                  </Button>
                  <ToggleForm category={root} m={m} />
                </div>
              </div>

              {children.length > 0 ? (
                <ul className="z-subcats">
                  {children.map((child) => (
                    <li key={child.id}>
                      <span>
                        <strong>{localizedName(child, locale)}</strong>
                        <span className="z-help">
                          {' '}
                          · <bdi dir="ltr">{child.slug}</bdi> ·{' '}
                          {formatCount(m.admin.common.servicesCount, child.services, locale)}
                        </span>
                        {!child.isActive ? (
                          <>
                            {' '}
                            <Badge tone="neutral">{k.inactive}</Badge>
                          </>
                        ) : null}
                      </span>
                      <span className="z-row" style={{ gap: 'var(--z-space-1)', flexWrap: 'wrap' }}>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(child)}>
                          {m.common.edit}
                        </Button>
                        <ToggleForm category={child} m={m} />
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
