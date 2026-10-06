import type { PolicyDenial } from '@/domain/booking/policy';

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

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  /** Safe to show the user verbatim. */
  readonly expose: boolean;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
    this.expose = code !== 'INTERNAL';
  }
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

export const unauthenticated = (m = 'You must be signed in.') =>
  new AppError('UNAUTHENTICATED', m);
export const forbidden = (m = 'You do not have access to this resource.') =>
  new AppError('FORBIDDEN', m);
export const notFound = (m = 'Not found.') => new AppError('NOT_FOUND', m);
export const invalid = (m: string, details?: unknown) =>
  new AppError('VALIDATION_FAILED', m, details);
export const slotUnavailable = () =>
  new AppError(
    'SLOT_UNAVAILABLE',
    'This time slot is no longer available. Please choose another time.',
  );
export const conflict = (m: string) => new AppError('CONFLICT', m);
export const rateLimited = (m = 'Too many requests. Please slow down.') =>
  new AppError('RATE_LIMITED', m);

export function toErrorBody(error: unknown): {
  status: number;
  body: { error: { code: ErrorCode; message: string; details?: unknown } };
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
    };
  }
  return {
    status: 500,
    body: { error: { code: 'INTERNAL', message: 'Something went wrong on our side.' } },
  };
}
