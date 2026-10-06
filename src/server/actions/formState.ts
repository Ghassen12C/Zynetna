import 'server-only';
import { ZodError, type ZodType } from 'zod';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { FormState } from '@/lib/formState';

export type { FormState } from '@/lib/formState';
export { idle, fieldError } from '@/lib/formState';

export function fieldErrorsOf(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    out[key] ??= issue.message;
  }
  return out;
}

/** Parse FormData against a schema, returning the standard error shape. */
export function parseForm<S extends ZodType>(
  schema: S,
  formData: FormData,
): { ok: true; data: S['_output'] } | { ok: false; state: FormState<never> } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    // Repeated names (checkbox groups) collapse into an array.
    if (key in raw) {
      const existing = raw[key];
      raw[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      raw[key] = value;
    }
  }

  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };

  return {
    ok: false,
    state: {
      status: 'error',
      message: 'Merci de corriger les champs indiqués.',
      fieldErrors: fieldErrorsOf(result.error),
    },
  };
}

/**
 * Convert a thrown error into a form state. Known AppErrors are safe to show;
 * anything else becomes a generic message and is logged in full.
 */
export function toFormState(error: unknown, context?: string): FormState<never> {
  if (error instanceof AppError && error.expose) {
    return { status: 'error', message: error.message };
  }
  if (error instanceof ZodError) {
    return {
      status: 'error',
      message: 'Merci de corriger les champs indiqués.',
      fieldErrors: fieldErrorsOf(error),
    };
  }
  logger.error('unhandled action error', {
    context,
    error: (error as Error)?.message,
    stack: (error as Error)?.stack?.split('\n').slice(0, 4).join(' | '),
  });
  return { status: 'error', message: 'Une erreur est survenue. Réessayez dans un instant.' };
}
