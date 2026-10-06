import { LOCALE_META, type Locale } from './config';

/** Tunisian dinar, which is a three-decimal currency. */
export function formatPrice(
  amount: number | string,
  locale: Locale = 'fr',
  currency = 'TND',
): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  return new Intl.NumberFormat(LOCALE_META[locale].intl, {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, locale: Locale = 'fr'): string {
  return new Intl.NumberFormat(LOCALE_META[locale].intl).format(value);
}

export function formatDuration(minutes: number, locale: Locale = 'fr'): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const unitH = locale === 'ar' ? 'س' : 'h';
  const unitM = locale === 'ar' ? 'د' : 'min';
  if (h === 0) return `${m} ${unitM}`;
  if (m === 0) return `${h} ${unitH}`;
  return `${h} ${unitH} ${m}`;
}

export function formatDate(
  date: Date,
  locale: Locale = 'fr',
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
  timeZone = 'Africa/Tunis',
): string {
  return new Intl.DateTimeFormat(LOCALE_META[locale].intl, { ...options, timeZone }).format(date);
}

export function formatTime(date: Date, locale: Locale = 'fr', timeZone = 'Africa/Tunis'): string {
  return new Intl.DateTimeFormat(LOCALE_META[locale].intl, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
}

export function formatDateTime(date: Date, locale: Locale = 'fr', timeZone = 'Africa/Tunis'): string {
  return new Intl.DateTimeFormat(LOCALE_META[locale].intl, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
}

export function formatRelative(date: Date, locale: Locale = 'fr', now = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE_META[locale].intl, { numeric: 'auto' });
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.round(diff / 1000), 'second');
}

/** Tunisian phone numbers: +216 XX XXX XXX. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('216') ? digits.slice(3) : digits;
  if (local.length !== 8) return phone;
  return `+216 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}
