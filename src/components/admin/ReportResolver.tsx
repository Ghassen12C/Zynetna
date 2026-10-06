'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/Alert';
import { resolveReportAction } from '@/server/actions/admin';
import { idle } from '@/lib/formState';

/**
 * Three outcomes submit the same form; each button carries its own
 * `name`/`value`, which is why there is no shared submit component here.
 */

export function ReportResolver({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(resolveReportAction, idle);
  if (state.status === 'success') router.refresh();

  return (
    <form action={formAction} className="z-stack" style={{ gap: 'var(--z-space-2)' }}>
      <input type="hidden" name="reportId" value={reportId} />
      {state.status === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      <textarea
        name="resolution"
        className="z-textarea"
        rows={2}
        placeholder="Suite donnée (interne)"
        aria-label="Résolution"
      />
      <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
        <button type="submit" name="status" value="REVIEWING" className="z-btn z-btn--ghost z-btn--sm">
          En cours
        </button>
        <button type="submit" name="status" value="RESOLVED" className="z-btn z-btn--primary z-btn--sm">
          Traité
        </button>
        <button type="submit" name="status" value="DISMISSED" className="z-btn z-btn--secondary z-btn--sm">
          Rejeter
        </button>
      </div>
    </form>
  );
}
