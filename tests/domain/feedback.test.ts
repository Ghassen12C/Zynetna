import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { messagesFor } from '@/i18n';
import { feedbackAr } from '@/i18n/messages/feedback/ar';
import { feedbackEn } from '@/i18n/messages/feedback/en';
import { feedbackFr } from '@/i18n/messages/feedback/fr';
import {
  conflict,
  invalid,
  localizeError,
  notFound,
  policyViolation,
  slotUnavailable,
  toErrorBody,
} from '@/lib/errors';
import { emailSchema } from '@/lib/validation/common';
import { v } from '@/lib/validation/keys';
import { englishIssueMessage, fieldErrorsOf } from '@/lib/validation/messages';

/** What toFormState does, minus the request: render in one locale. */
const say = (error: Parameters<typeof localizeError>[0], locale: 'fr' | 'en' | 'ar') =>
  localizeError(error, messagesFor(locale), locale);

describe('localized AppError', () => {
  it('keeps an English message for logs and carries the key', () => {
    const error = notFound('reservationNotFound');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Appointment not found.');
    expect(error.i18n).toEqual({ key: 'reservationNotFound', params: undefined });
  });

  it('renders in the visitor’s language', () => {
    const error = slotUnavailable();
    expect(say(error, 'fr')).toBe(feedbackFr.errors.slotUnavailable);
    expect(say(error, 'en')).toBe(feedbackEn.errors.slotUnavailable);
    expect(say(error, 'ar')).toBe(feedbackAr.errors.slotUnavailable);
  });

  it('fills parameters and picks plural forms per locale', () => {
    const error = invalid('staffHasUpcoming', { name: 'Amel', count: 2 });
    expect(say(error, 'fr')).toBe(
      'Amel a encore 2 rendez-vous à venir. Réaffectez-les ou désactivez le profil.',
    );
    expect(say(error, 'en')).toContain('Amel still has 2 upcoming appointments.');
    expect(say(error, 'ar')).toContain('موعدان قادمان');
    expect(say(invalid('staffHasUpcoming', { name: 'Amel', count: 1 }), 'en')).toContain(
      '1 upcoming appointment.',
    );
  });

  it('translates and joins list parameters', () => {
    const error = invalid('publishMissing', { items: ['missingAddress', 'missingHours'] });
    expect(say(error, 'fr')).toBe('Il manque encore une adresse et vos horaires d’ouverture.');
    expect(say(error, 'en')).toBe('Still missing: an address and your opening hours.');
    expect(say(error, 'ar')).toContain('عنوان');
  });

  it('still renders policy denials and untranslated errors', () => {
    const denial = policyViolation({ code: 'IN_THE_PAST' });
    expect(say(denial, 'en')).toBe(messagesFor('en').policy.IN_THE_PAST);
    expect(say(conflict('alreadyOnTeam'), 'ar')).toBe(feedbackAr.errors.alreadyOnTeam);
  });

  it('localizes the JSON envelope only when asked', () => {
    const error = conflict('invitationPending');
    expect(toErrorBody(error).body.error.message).toBe(feedbackEn.errors.invitationPending);
    const ar = toErrorBody(error, { messages: messagesFor('ar'), locale: 'ar' });
    expect(ar.status).toBe(409);
    expect(ar.body.error.message).toBe(feedbackAr.errors.invitationPending);
    const internal = toErrorBody(new Error('boom'), { messages: messagesFor('fr'), locale: 'fr' });
    expect(internal.body.error.message).toBe(feedbackFr.errors.internal);
  });
});

describe('fieldErrorsOf', () => {
  const schema = z.object({
    email: emailSchema,
    name: z.string().trim().min(3),
    note: z.string().max(5),
    age: z.coerce.number().int().min(18),
  });
  const parse = (input: Record<string, unknown>) => {
    const result = schema.safeParse(input, { reportInput: true });
    if (result.success) throw new Error('expected a failure');
    return result.error;
  };

  it('translates a v. key', () => {
    const error = parse({ email: 'not-an-email', name: 'abc', note: '', age: 20 });
    expect(fieldErrorsOf(error, feedbackFr, 'fr').email).toBe('Adresse e-mail invalide.');
    expect(fieldErrorsOf(error, feedbackEn, 'en').email).toBe('Invalid email address.');
    expect(fieldErrorsOf(error, feedbackAr, 'ar').email).toBe(feedbackAr.validation.emailInvalid);
  });

  it('never leaks zod’s English defaults', () => {
    const error = parse({ email: 'a@b.tn', name: 'ab', note: 'too long', age: 12 });
    const fr = fieldErrorsOf(error, feedbackFr, 'fr');
    expect(fr.name).toBe('Au moins 3 caractères.');
    expect(fr.note).toBe('5 caractères maximum.');
    expect(fr.age).toBe('La valeur minimale est 18.');
    const ar = fieldErrorsOf(error, feedbackAr, 'ar');
    expect(ar.name).toBe('3 أحرف على الأقل.');
    expect(Object.values(ar).join(' ')).not.toMatch(/[A-Za-z]{3,}/);
  });

  it('reports a missing field as required', () => {
    const error = parse({ email: 'a@b.tn', name: 'abc', age: 20 });
    expect(fieldErrorsOf(error, feedbackEn, 'en').note).toBe('Required.');
  });

  it('renders v. keys in English for machine readers', () => {
    const result = z.string().regex(/^x$/, v('dateFormat')).safeParse('y');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(englishIssueMessage(result.error.issues[0])).toBe('Invalid date (YYYY-MM-DD).');
    }
  });
});

describe('feedback dictionaries', () => {
  const keysOf = (value: object, prefix = ''): string[] =>
    Object.entries(value).flatMap(([key, child]) =>
      typeof child === 'object' && child !== null && !('other' in child)
        ? keysOf(child, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );

  it('have the same keys in every locale', () => {
    expect(keysOf(feedbackEn)).toEqual(keysOf(feedbackFr));
    expect(keysOf(feedbackAr)).toEqual(keysOf(feedbackFr));
  });
});
