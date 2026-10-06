import { DEFAULT_LOCALE, type Locale } from './config';
import { type Messages, fr } from './messages/fr';
import { ar } from './messages/ar';
import { en } from './messages/en';

export * from './config';
export * from './format';
export type { Messages };

const DICTIONARIES: Record<Locale, Messages> = { fr, ar, en };

export function messagesFor(locale: Locale): Messages {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * Interpolate `{name}` placeholders. Typed against the French dictionary, so a
 * missing or misspelled key is a compile error rather than a blank UI string.
 */
export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export type Translator = {
  locale: Locale;
  m: Messages;
  t: (template: string, params?: Record<string, string | number>) => string;
};

export function translator(locale: Locale): Translator {
  return {
    locale,
    m: messagesFor(locale),
    t: interpolate,
  };
}
