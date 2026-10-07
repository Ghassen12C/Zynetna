import type { ZodError } from 'zod';
import type { Locale } from '@/i18n/config';
import { feedbackEn } from '@/i18n/messages/feedback/en';
import { type Feedback, type MessageParams, renderFeedback } from '@/lib/errors';
import { VALIDATION_PREFIX, type ValidationKey } from './keys';

type Issue = ZodError['issues'][number];

/**
 * Translate zod issues into one message per field, in the visitor's language.
 *
 * A schema's own message is a `v.<key>` (see `v()`); anything else is zod's
 * English default, which never reaches the visitor: it is replaced by a generic
 * message chosen from the issue code and its bounds.
 */
export function fieldErrorsOf(
  error: ZodError,
  feedback: Feedback,
  locale: Locale,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    out[key] ??= issueMessage(issue, feedback, locale);
  }
  return out;
}

export function issueMessage(issue: Issue, feedback: Feedback, locale: Locale): string {
  const [key, params] = keyOf(issue, feedback);
  return renderFeedback(feedback.validation[key], params, feedback, locale);
}

/**
 * One issue in English, for a machine reader (the assistant's model, an API
 * client): a `v.` key is rendered, a schema's own prose passes through as is.
 */
export function englishIssueMessage(issue: Issue | undefined): string {
  if (!issue) return feedbackEn.validation.invalid;
  return issue.message.startsWith(VALIDATION_PREFIX)
    ? issueMessage(issue, feedbackEn, 'en')
    : issue.message;
}

function keyOf(issue: Issue, feedback: Feedback): [ValidationKey, MessageParams?] {
  const bounds = boundsOf(issue);

  if (issue.message.startsWith(VALIDATION_PREFIX)) {
    const key = issue.message.slice(VALIDATION_PREFIX.length);
    if (key in feedback.validation) return [key as ValidationKey, bounds];
  }

  // Only present when the schema was parsed with `reportInput` (parseForm).
  const hasInput = 'input' in issue;
  const empty =
    hasInput && (issue.input === undefined || issue.input === null || issue.input === '');

  switch (issue.code) {
    case 'invalid_type':
      if (empty || (!hasInput && issue.expected !== 'number' && issue.expected !== 'int')) {
        return ['required'];
      }
      if (issue.expected === 'int') return ['notInteger'];
      if (issue.expected === 'number') return ['notANumber'];
      return ['invalid'];
    case 'too_small':
      if (issue.origin === 'string') {
        return Number(issue.minimum) <= 1 || empty ? ['required'] : ['minChars', bounds];
      }
      if (issue.origin === 'number') return ['minNumber', bounds];
      return empty ? ['required'] : ['invalid'];
    case 'too_big':
      if (issue.origin === 'string') return ['maxChars', bounds];
      if (issue.origin === 'number') return ['maxNumber', bounds];
      return ['invalid'];
    case 'invalid_format':
      if (issue.format === 'email') return ['emailInvalid'];
      if (issue.format === 'url') return ['urlInvalid'];
      if (issue.format === 'datetime' || issue.format === 'date') return ['dateInvalid'];
      return ['invalidFormat'];
    case 'invalid_value':
      return empty ? ['required'] : ['invalidChoice'];
    default:
      return ['invalid'];
  }
}

/** `{min}`, `{max}` and `{count}` (for plural forms) from a size issue. */
function boundsOf(issue: Issue): MessageParams | undefined {
  if (issue.code !== 'too_small' && issue.code !== 'too_big') return undefined;
  const bound = Number(issue.code === 'too_small' ? issue.minimum : issue.maximum);
  return issue.code === 'too_small' ? { min: bound, count: bound } : { max: bound, count: bound };
}

