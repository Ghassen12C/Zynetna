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
const SECTIONS: { role: string; title: string; hint: string; single?: boolean }[] = [
  { role: 'LOGO', title: 'Logo', hint: 'Carré de préférence. Apparaît partout sur Zynetna.', single: true },
  { role: 'COVER', title: 'Photo de couverture', hint: 'La grande image en haut de votre page.', single: true },
  { role: 'EXTERIOR', title: 'Devanture', hint: 'La façade, pour qu’on vous reconnaisse dans la rue.' },
  { role: 'INTERIOR', title: 'Intérieur', hint: 'Accueil, fauteuils, cabines, espace d’attente.' },
  { role: 'PORTFOLIO', title: 'Réalisations', hint: 'Votre travail : coupes, couleurs, ongles, maquillage.' },
  { role: 'TEAM', title: 'Équipe', hint: 'Vos photos d’équipe.' },
];

function UploadButton({ single }: { single?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <span className={`z-btn z-btn--secondary z-btn--sm ${pending ? 'is-busy' : ''}`}>
      {pending ? <span className="z-spinner" aria-hidden="true" /> : null}
      {single ? 'Remplacer' : '+ Ajouter'}
    </span>
  );
}

function UploadForm({
  businessId,
  role,
  single,
}: {
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
        <UploadButton single={single} />
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

function DeleteForm({ businessId, mediaId }: { businessId: string; mediaId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(deleteBusinessMediaAction, idle);
  if (state.status === 'success') router.refresh();

  return (
    <form action={formAction}>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="mediaId" value={mediaId} />
      <button type="submit" className="z-media__delete" aria-label="Supprimer cette image">
        ×
      </button>
    </form>
  );
}

export function MediaManager({
  businessId,
  media,
  maxImages,
}: {
  businessId: string;
  media: Item[];
  maxImages: number | null;
}) {
  const [preview, setPreview] = useState<Item | null>(null);

  return (
    <div className="z-stack" style={{ gap: 'var(--z-space-6)' }}>
      <div>
        <h2 className="z-profile__h3">Photos ({media.length}{maxImages ? ` / ${maxImages}` : ''})</h2>
        <p className="z-policy">
          Les images sont automatiquement optimisées et converties en AVIF et WebP — vos clients
          chargent la bonne taille, même en 4G.
        </p>
      </div>

      {SECTIONS.map((section) => {
        const items = media.filter((m) => m.role === section.role);
        return (
          <Panel key={section.role} className="z-dash__panel">
            <div className="z-dash__panel-head">
              <div>
                <h3 className="z-profile__h3">{section.title}</h3>
                <p className="z-policy">{section.hint}</p>
              </div>
              <UploadForm businessId={businessId} role={section.role} single={section.single} />
            </div>

            {items.length === 0 ? (
              <p className="z-help">Aucune image pour l’instant.</p>
            ) : (
              <ul className="z-media-grid">
                {items.map((item) => (
                  <li key={item.id} className="z-media">
                    <button
                      type="button"
                      className="z-media__btn"
                      onClick={() => setPreview(item)}
                      aria-label="Agrandir"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.thumbUrl} alt="" loading="lazy" />
                    </button>
                    <DeleteForm businessId={businessId} mediaId={item.id} />
                    <span className="z-media__meta">
                      {item.width}×{item.height} · {Math.round(item.bytes / 1024)} Ko
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
            aria-label="Fermer"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt="" className="z-lightbox__img" />
        </div>
      ) : null}
    </div>
  );
}
