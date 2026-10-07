import type { feedbackFr } from '@/i18n/messages/feedback/fr';

export type ValidationKey = keyof (typeof feedbackFr)['validation'];

/** The prefix that marks a zod message as a dictionary key rather than prose. */
export const VALIDATION_PREFIX = 'v.';

/**
 * A schema's custom message, as a stable key into `m.feedback.validation`.
 *
 * Schemas are shared and locale-blind, so they name the rule and the server
 * renders it in the visitor's language (`fieldErrorsOf`). Type-only import:
 * safe in any module, including ones a client component reaches.
 */
export const v = (key: ValidationKey): `v.${ValidationKey}` => `v.${key}`;
