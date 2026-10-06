import { DEFAULT_LOCALE, type Locale } from './config';
import { type Messages, fr } from './messages/fr';
import { ar } from './messages/ar';
import { en } from './messages/en';
import { interpolate } from './interpolate';

export * from './config';
export * from './format';
export * from './interpolate';
export type { Messages };

const DICTIONARIES: Record<Locale, Messages> = { fr, ar, en };

export function messagesFor(locale: Locale): Messages {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
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
