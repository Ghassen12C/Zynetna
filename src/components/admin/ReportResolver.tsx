'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { resolveReportAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';
import type { Messages } from '@/i18n';

/**
 * Three outcomes submit the same form; each button carries its own
 * `name`/`value`, which is why there is no shared submit component here.
 */

export function ReportResolver({ reportId, m }: { reportId: string; m: Messages['admin'] }) {
  const r = m.reports;
  const router = useRouter();
  const [state, formAction] = useActionState(resolveReportAction, idle);
  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
      <input type="hidden" name="reportId" value={reportId} />
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      <textarea
        name="resolution"
        className="z-textarea"
        rows={2}
        placeholder={r.resolutionPlaceholder}
        aria-label={r.resolutionLabel}
      />
      <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
        <button type="submit" name="status" value="REVIEWING" className="z-btn z-btn--ghost z-btn--sm">
          {r.markReviewing}
        </button>
        <button type="submit" name="status" value="RESOLVED" className="z-btn z-btn--primary z-btn--sm">
          {r.markResolved}
        </button>
        <button type="submit" name="status" value="DISMISSED" className="z-btn z-btn--secondary z-btn--sm">
          {r.dismiss}
        </button>
      </div>
    </form>
  );
}
