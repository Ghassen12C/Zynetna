/**
 * Form result shape, shared by server actions and the client components that
 * render them.
 *
 * Deliberately free of any server import: a client component needs `idle` and
 * the type, and pulling the server helpers in with them would drag the
 * environment module — and therefore secrets — into the browser bundle.
 */
export type FormState<T = undefined> =
  | { status: 'idle' }
  | { status: 'success'; message?: string; data?: T }
  | {
      status: 'error';
      message: string;
      /** Field name → first message, for inline display. */
      fieldErrors?: Record<string, string>;
    };

export const idle: FormState<never> = { status: 'idle' };

/** Narrowing helper so forms can read field errors without repeating the check. */
export function fieldError(state: FormState<never> | FormState, field: string): string | undefined {
  return state.status === 'error' ? state.fieldErrors?.[field] : undefined;
}
