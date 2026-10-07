'use client';

import { useState } from 'react';
import { interpolate } from '@/i18n/interpolate';

/**
 * Sharing — the mechanism a Tunisian salon actually uses to advertise.
 * Native share sheet where available (that is WhatsApp on most phones here),
 * copy-link everywhere else, plus explicit WhatsApp and Facebook targets.
 */
export function ShareButton({
  slug,
  name,
  tagline,
  labels,
}: {
  slug: string;
  name: string;
  tagline?: string;
  /** `text` carries a `{title}` placeholder for the shared message. */
  labels: { share: string; copy: string; copied: string; text: string; qr: string; qrHref: string };
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = typeof window === 'undefined' ? '' : `${window.location.origin}/business/${slug}`;
  const text = interpolate(labels.text, { title: `${name}${tagline ? ` — ${tagline}` : ''}` });

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: name, text, url });
        return;
      } catch {
        // Dismissed, or unavailable — fall through to the menu.
      }
    }
    setOpen((v) => !v);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="z-share">
      <button type="button" className="z-btn z-btn--secondary z-btn--md" onClick={share}>
        <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true" fill="none">
          <path
            d="M14 6.5a2.5 2.5 0 1 0-2.45-3H11.5L7.2 6.1a2.5 2.5 0 1 0 0 3.8l4.3 2.6a2.5 2.5 0 1 0 .6-1.1L7.9 8.9a2.5 2.5 0 0 0 0-1.1l4.2-2.5c.45.7 1.2 1.2 2.1 1.2Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        {labels.share}
      </button>

      {open ? (
        <div className="z-share__menu" role="menu">
          <button type="button" onClick={copy} role="menuitem">
            {copied ? labels.copied : labels.copy}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
          >
            WhatsApp
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
          >
            Facebook
          </a>
          <a href={labels.qrHref} role="menuitem">
            {labels.qr}
          </a>
        </div>
      ) : null}
    </div>
  );
}
