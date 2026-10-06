'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * Download the QR as SVG (for print) or PNG (for social).
 *
 * The SVG is already in the page, so the conversion happens in the browser via
 * a canvas — no round-trip and no image library.
 */
export function DownloadQr({
  svg,
  slug,
  name,
}: {
  svg: string;
  slug: string;
  name: string;
}) {
  const [busy, setBusy] = useState(false);

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadSvg() {
    saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `zynetna-${slug}.svg`);
  }

  async function downloadPng() {
    setBusy(true);
    try {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const image = new Image();

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('QR image failed to load'));
        image.src = url;
      });

      // 1024 px: large enough for print, small enough to share.
      const size = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#F5F1E8';
        context.fillRect(0, 0, size, size);
        context.drawImage(image, 0, 0, size, size);
        canvas.toBlob((png) => {
          if (png) saveBlob(png, `zynetna-${slug}.png`);
        }, 'image/png');
      }
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/business/${slug}`;
    // The DOM types declare navigator.share as always present, so the runtime
    // check has to be made without narrowing navigator itself.
    const canShare = typeof navigator.share === 'function';
    if (canShare) {
      await navigator.share({ title: name, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  }

  return (
    <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
      <Button onClick={downloadSvg}>Télécharger (SVG)</Button>
      <Button variant="secondary" onClick={downloadPng} loading={busy}>
        Télécharger (PNG)
      </Button>
      <Button variant="ghost" onClick={share}>
        Partager le lien
      </Button>
      <Button variant="ghost" onClick={() => window.print()}>
        Imprimer
      </Button>
    </div>
  );
}
