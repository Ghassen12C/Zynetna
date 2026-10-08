import type { Messages } from '@/i18n/messages/fr';
import type { Permission } from './permissions';

/**
 * The professional dashboard's navigation.
 *
 * Kept as data, next to the permission catalogue, because the menu and the
 * page guards have to agree: offering an employee a link that answers "access
 * denied" is worse than not offering it, and the two drift apart the moment
 * the list lives inside a layout component.
 *
 * Each entry names the permission its page requires. The permission here must
 * match the one that page passes to `proContext`. The label is a key into
 * `m.dash.nav`, resolved by the layout in the visitor's language.
 */
export type ProNavLabel = keyof Messages['dash']['nav'];
export type ProNavItem = { href: string; labelKey: ProNavLabel; permission: Permission };

export const PRO_NAV: readonly ProNavItem[] = [
  { href: '/pro/dashboard', labelKey: 'overview', permission: 'business.analytics.read' },
  {
    href: '/pro/dashboard/calendar',
    labelKey: 'calendar',
    permission: 'business.reservation.read',
  },
  {
    href: '/pro/dashboard/reservations',
    labelKey: 'reservations',
    permission: 'business.reservation.read',
  },
  { href: '/pro/dashboard/services', labelKey: 'services', permission: 'business.service.read' },
  { href: '/pro/dashboard/team', labelKey: 'team', permission: 'business.staff.read' },
  { href: '/pro/dashboard/hours', labelKey: 'hours', permission: 'business.hours.write' },
  { href: '/pro/dashboard/gallery', labelKey: 'gallery', permission: 'business.media.manage' },
  { href: '/pro/dashboard/customers', labelKey: 'customers', permission: 'business.customer.read' },
  { href: '/pro/dashboard/reviews', labelKey: 'reviews', permission: 'business.review.respond' },
  {
    href: '/pro/dashboard/analytics',
    labelKey: 'analytics',
    permission: 'business.analytics.read',
  },
  { href: '/pro/dashboard/profile', labelKey: 'profile', permission: 'business.update' },
  {
    href: '/pro/dashboard/subscription',
    labelKey: 'subscription',
    permission: 'business.subscription.read',
  },
  // The person's own sign-in, not the business: every member has it.
  { href: '/pro/dashboard/security', labelKey: 'security', permission: 'business.read' },
];

/** The landing page for someone who cannot read the revenue overview. */
export const PRO_HOME_FALLBACK = '/pro/dashboard/calendar';
