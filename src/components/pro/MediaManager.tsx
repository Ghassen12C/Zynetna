'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { Panel } from '@/components/ui/Primitives';
import {
  deleteBusinessMediaAction,
  uploadBusinessMediaAction,
} from '@/server/actions/media';
import { idle } from '@/lib/formState';
import { formatNumber } from '@/i18n/format';
import { LOCALE_META, type Locale } from '@/i18n/config';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n';

type M = {
  dashSetup: Messages['dashSetup'];
  common: Messages['common'];
  labels: Messages['labels'];
};

type Item = {
  id: string;
  role: string;
  position: number;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  bytes: number;
};

/**
 * Media manager.
 *
 * Images are grouped by what they are for, because a salon owner thinks in
 * "the front of my shop" and "my work", not in "gallery item 7".
 */
type SectionRole = keyof Messages['dashSetup']['gallery']['hints'];

const SECTIONS: { role: SectionRole; single?: boolean }[] = [
  { role: 'LOGO', single: true },
  { role: 'COVER', single: true },
  { role: 'EXTERIOR' },
  { role: 'INTERIOR' },
  { role: 'PORTFOLIO' },
  { role: 'TEAM' },
];

function UploadButton({ m, single }: { m: M; single?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <span className={`z-btn z-btn--secondary z-btn--sm ${pending ? 'is-busy' : ''}`}>
      {pending ? <span className="z-spinner" aria-hidden="true" /> : null}
      {single ? m.dashSetup.gallery.replace : `+ ${m.dashSetup.gallery.add}`}
    </span>
  );
}

function UploadForm({
  m,
  businessId,
  role,
  single,
}: {
  m: M;
  businessId: string;
  role: string;
  single?: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(uploadBusinessMediaAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  if (state.status === 'success') router.refresh();

  return (
    <form ref={formRef} action={formAction} className="z-upload">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="role" value={role} />
      <label>
        <UploadButton m={m} single={single} />
        <input
          type="file"
          name="files"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple={!single}
          className="z-sr-only"
          onChange={() => formRef.current?.requestSubmit()}
        />
      </label>
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
    </form>
  );
}

function DeleteForm({
  label,
  businessId,
  mediaId,
}: {
  label: string;
  businessId: string;
  mediaId: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(deleteBusinessMediaAction, idle);
  if (state.status === 'success') router.refresh();

  return (
    <form action={formAction}>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="mediaId" value={mediaId} />
      <button type="submit" className="z-media__delete" aria-label={label} title={label}>
        ×
      </button>
    </form>
  );
}

export function MediaManager({
  m,
  locale,
  businessId,
  media,
  maxImages,
}: {
  m: M;
  locale: Locale;
  businessId: string;
  media: Item[];
  maxImages: number | null;
}) {
  const [preview, setPreview] = useState<Item | null>(null);
  const t = m.dashSetup.gallery;
  const kilobytes = new Intl.NumberFormat(LOCALE_META[locale].intl, {
    style: 'unit',
    unit: 'kilobyte',
    maximumFractionDigits: 0,
  });
  const roleLabel = (role: string) =>
    m.labels.mediaRole[role as keyof Messages['labels']['mediaRole']] ?? role;
  const previewAlt = preview
    ? interpolate(t.imageAlt, {
        role: roleLabel(preview.role),
        n: media.filter((x) => x.role === preview.role).indexOf(preview) + 1,
      })
    : '';

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      <div>
        <h2 className="z-profile__h3">
          {maxImages
            ? interpolate(t.headingWithMax, {
                count: formatNumber(media.length, locale),
                max: formatNumber(maxImages, locale),
              })
            : interpolate(t.heading, { count: formatNumber(media.length, locale) })}
        </h2>
        <p className="z-policy">{t.intro}</p>
      </div>

      {SECTIONS.map((section) => {
        const items = media.filter((m) => m.role === section.role);
        return (
          <Panel key={section.role} className="z-dash__panel">
            <div className="z-dash__panel-head">
              <div>
                <h3 className="z-profile__h3">{m.labels.mediaRole[section.role]}</h3>
                <p className="z-policy">{t.hints[section.role]}</p>
              </div>
              <UploadForm
                m={m}
                businessId={businessId}
                role={section.role}
                single={section.single}
              />
            </div>

            {items.length === 0 ? (
              <p className="z-help">{t.empty}</p>
            ) : (
              <ul className="z-media-grid">
                {items.map((item) => (
                  <li key={item.id} className="z-media">
                    <button
                      type="button"
                      className="z-media__btn"
                      onClick={() => setPreview(item)}
                      aria-label={t.enlarge}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.thumbUrl} alt="" loading="lazy" />
                    </button>
                    <DeleteForm label={t.deleteImage} businessId={businessId} mediaId={item.id} />
                    <span className="z-media__meta" dir="ltr">
                      {item.width}×{item.height} · {kilobytes.format(Math.round(item.bytes / 1024))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        );
      })}

      {preview ? (
        <div className="z-lightbox" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          <button
            type="button"
            className="z-lightbox__close"
            onClick={() => setPreview(null)}
            aria-label={m.common.close}
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={previewAlt} className="z-lightbox__img" />
        </div>
      ) : null}
    </div>
  );
}
