'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProfileMedia } from '@/server/services/businessProfile';

/**
 * Gallery with a keyboard-complete lightbox: Escape closes, arrows navigate,
 * focus is trapped while open and the page behind does not scroll.
 */
export function Gallery({ images }: { images: ProfileMedia[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const isOpen = index !== null;

  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setIndex((current) =>
        current === null ? null : (current + delta + images.length) % images.length,
      ),
    [images.length],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, close, step]);

  if (images.length === 0) return null;

  return (
    <>
      <ul className="z-gallery">
        {images.map((image, i) => (
          <li key={image.id}>
            <button
              type="button"
              className="z-gallery__item"
              onClick={() => setIndex(i)}
              aria-label={`Agrandir l’image ${i + 1} sur ${images.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.thumbUrl} alt={image.alt ?? ''} loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>

      {isOpen ? (
        <div
          className="z-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Galerie"
          onClick={close}
        >
          <button type="button" className="z-lightbox__close" onClick={close} aria-label="Fermer">
            ×
          </button>
          {images.length > 1 ? (
            <button
              type="button"
              className="z-lightbox__nav z-lightbox__nav--prev"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              aria-label="Image précédente"
            >
              ‹
            </button>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[index]!.url}
            alt={images[index]!.alt ?? ''}
            className="z-lightbox__img"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 ? (
            <button
              type="button"
              className="z-lightbox__nav z-lightbox__nav--next"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              aria-label="Image suivante"
            >
              ›
            </button>
          ) : null}

          <p className="z-lightbox__counter" aria-live="polite">
            {index + 1} / {images.length}
          </p>
        </div>
      ) : null}
    </>
  );
}
