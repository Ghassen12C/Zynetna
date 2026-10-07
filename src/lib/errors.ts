import type { PolicyDenial } from '@/domain/booking/policy';
import { LOCALE_META, type Locale, type PluralForms } from '@/i18n/config';
import { formatCount, policyMessage } from '@/i18n/format';
import { interpolate } from '@/i18n/interpolate';
import type { Messages } from '@/i18n/messages/fr';
import { feedbackEn } from '@/i18n/messages/feedback/en';

/**
 * One error vocabulary for the whole application. Every API route and server
 * action converts failures into these, so the client always receives the same
 * envelope: { error: { code, message, details? } }.
 */
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'SLOT_UNAVAILABLE'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA'
  | 'SUBSCRIPTION_INACTIVE'
  | 'BUSINESS_UNAVAILABLE'
  | 'ILLEGAL_TRANSITION'
  | 'POLICY_VIOLATION'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  SLOT_UNAVAILABLE: 409,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  SUBSCRIPTION_INACTIVE: 403,
  BUSINESS_UNAVAILABLE: 409,
  ILLEGAL_TRANSITION: 409,
  POLICY_VIOLATION: 422,
  INTERNAL: 500,
};

export type Feedback = Messages['feedback'];
export type FeedbackErrorKey = keyof Feedback['errors'];
export type FeedbackPartKey = keyof Feedback['parts'];

/**
 * Parameters of a localized message. A number fills `{name}` and, as `count`,
 * picks the plural form; a list of part keys is translated and joined the way
 * the locale joins lists ("a, b et c" / "a, b and c" / "a وb وc").
 */
export type MessageParams = Record<string, string | number | readonly FeedbackPartKey[]>;

/** What `toFormState` needs to say an AppError in the visitor's language. */
export type LocalizedMessage = { key: FeedbackErrorKey; params?: MessageParams };

/**
 * Render one feedback entry — a template or a set of plural forms — with its
 * parameters, in one locale. Pure, so it is shared by the server actions, the
 * API envelope and the tests.
 */
export function renderFeedback(
  entry: string | PluralForms,
  params: MessageParams | undefined,
  feedback: Feedback,
  locale: Locale,
): string {
  const flat: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') {
      flat[name] = value;
    } else {
      const items = value.map((key) => feedback.parts[key]);
      const list = new Intl.ListFormat(LOCALE_META[locale].intl, { type: 'conjunction' });
      flat[name] = list.format(items);
    }
  }
  const template =
    typeof entry === 'string' ? entry : formatCount(entry, Number(flat.count ?? 0), locale);
  return interpolate(template, flat);
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  /** Safe to show the user verbatim. */
  readonly expose: boolean;
  /**
   * The user-facing sentence as a dictionary key. `message` is its English
   * rendering, for logs and API clients; the visitor reads this one, rendered
   * in their own language by `toFormState`.
   */
  readonly i18n?: LocalizedMessage;

  constructor(code: ErrorCode, message: string, details?: unknown, i18n?: LocalizedMessage) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
    this.expose = code !== 'INTERNAL';
    this.i18n = i18n;
  }
}

/** An exposed error whose sentence lives in `m.feedback.errors[key]`. */
export function localized(
  code: ErrorCode,
  key: FeedbackErrorKey,
  params?: MessageParams,
  details?: unknown,
): AppError {
  const english = renderFeedback(feedbackEn.errors[key], params, feedbackEn, 'en');
  return new AppError(code, english, details, { key, params });
}

/**
 * A policy refusal, carrying the structured denial rather than a sentence.
 *
 * The `message` is for logs and for any client too old to read `details`; the
 * user-facing text is rendered from `details` in their own language by
 * `toFormState`.
 */
export function policyViolation(denial: PolicyDenial): AppError {
  return new AppError('POLICY_VIOLATION', `policy:${denial.code}`, denial);
}

/** Is this error's `details` a policy denial we can translate? */
export function policyDenialOf(error: unknown): PolicyDenial | null {
  if (!(error instanceof AppError) || error.code !== 'POLICY_VIOLATION') return null;
  const details = error.details;
  if (details && typeof details === 'object' && 'code' in details) {
    return details as PolicyDenial;
  }
  return null;
}

/**
 * The sentence an exposed AppError shows a visitor, in their language: a policy
 * denial from `m.policy`, a localized error from `m.feedback.errors`, and the
 * raw message only for an error thrown without a key.
 */
export function localizeError(
  error: AppError,
  messages: Pick<Messages, 'feedback' | 'policy'>,
  locale: Locale,
): string {
  const denial = policyDenialOf(error);
  if (denial) return policyMessage(denial, messages.policy);
  if (error.i18n) {
    const { key, params } = error.i18n;
    return renderFeedback(messages.feedback.errors[key], params, messages.feedback, locale);
  }
  return error.message;
}

export const unauthenticated = () => localized('UNAUTHENTICATED', 'unauthenticated');
export const forbidden = (key: FeedbackErrorKey = 'forbidden', params?: MessageParams) =>
  localized('FORBIDDEN', key, params);
export const notFound = (key: FeedbackErrorKey = 'notFound', params?: MessageParams) =>
  localized('NOT_FOUND', key, params);
export const invalid = (key: FeedbackErrorKey, params?: MessageParams, details?: unknown) =>
  localized('VALIDATION_FAILED', key, params, details);
export const slotUnavailable = () => localized('SLOT_UNAVAILABLE', 'slotUnavailable');
export const conflict = (key: FeedbackErrorKey, params?: MessageParams) =>
  localized('CONFLICT', key, params);
export const rateLimited = (key: FeedbackErrorKey = 'rateLimited', params?: MessageParams) =>
  localized('RATE_LIMITED', key, params);

/**
 * The JSON error envelope. Pass the visitor's messages and locale when the
 * response feeds our own UI, so the `message` is in their language; without
 * them it stays English, for API clients and logs.
 */
export function toErrorBody(
  error: unknown,
  i18n?: { messages: Pick<Messages, 'feedback' | 'policy'>; locale: Locale },
): {
  status: number;
  body: { error: { code: ErrorCode; message: string; details?: unknown } };
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message:
            i18n && error.expose ? localizeError(error, i18n.messages, i18n.locale) : error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
    };
  }
  const feedback = i18n?.messages.feedback ?? feedbackEn;
  return {
    status: 500,
    body: { error: { code: 'INTERNAL', message: feedback.errors.internal } },
  };
}
