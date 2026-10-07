import 'server-only';
import { ZodError, type ZodType } from 'zod';
import {
  AppError,
  type Feedback,
  type MessageParams,
  localizeError,
  renderFeedback,
} from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { FormState } from '@/lib/formState';
import { fieldErrorsOf } from '@/lib/validation/messages';
import type { PluralForms } from '@/i18n/config';
import { getLocale } from '@/i18n/server';
import { messagesFor } from '@/i18n';

export type { FormState } from '@/lib/formState';
export { idle, fieldError } from '@/lib/formState';

/**
 * The visitor's feedback dictionary (`m.feedback`), plus `t` to render an entry
 * that takes parameters or plural forms. What every action uses for the
 * sentences it returns.
 */
export async function feedbackFor(): Promise<
  Feedback & { t: (entry: string | PluralForms, params?: MessageParams) => string }
> {
  const locale = await getLocale();
  const feedback = messagesFor(locale).feedback;
  return {
    ...feedback,
    t: (entry, params) => renderFeedback(entry, params, feedback, locale),
  };
}

/** A success message from `m.feedback.done`, in the visitor's language. */
export async function done(key: keyof Feedback['done'], params?: MessageParams): Promise<string> {
  const { t, done: messages } = await feedbackFor();
  return t(messages[key], params);
}

/** Parse FormData against a schema, returning the standard error shape. */
export async function parseForm<S extends ZodType>(
  schema: S,
  formData: FormData,
): Promise<{ ok: true; data: S['_output'] } | { ok: false; state: FormState<never> }> {
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

  // `reportInput` lets the translation tell an empty field from a wrong one.
  const result = schema.safeParse(raw, { reportInput: true });
  if (result.success) return { ok: true, data: result.data };

  const locale = await getLocale();
  const m = messagesFor(locale);
  return {
    ok: false,
    state: {
      status: 'error',
      message: m.errors.validation,
      fieldErrors: fieldErrorsOf(result.error, m.feedback, locale),
    },
  };
}

/**
 * Convert a thrown error into a form state. Known AppErrors are safe to show;
 * anything else becomes a generic message and is logged in full.
 */
export async function toFormState(
  error: unknown,
  context?: string,
): Promise<FormState<never>> {
  const locale = await getLocale();
  const m = messagesFor(locale);

  // A policy refusal or a localized error carries a code, so the sentence is
  // built here in the visitor's language rather than where it was thrown.
  if (error instanceof AppError && error.expose) {
    return { status: 'error', message: localizeError(error, m, locale) };
  }
  if (error instanceof ZodError) {
    return {
      status: 'error',
      message: m.errors.validation,
      fieldErrors: fieldErrorsOf(error, m.feedback, locale),
    };
  }
  logger.error('unhandled action error', {
    context,
    error: (error as Error)?.message,
    stack: (error as Error)?.stack?.split('\n').slice(0, 4).join(' | '),
  });
  return { status: 'error', message: m.errors.unexpected };
}
