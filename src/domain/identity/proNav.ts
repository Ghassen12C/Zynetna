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
 * match the one that page passes to `proContext`.
 */
export type ProNavItem = { href: string; label: string; permission: Permission };

export const PRO_NAV: readonly ProNavItem[] = [
  { href: '/pro/dashboard', label: 'Vue d’ensemble', permission: 'business.analytics.read' },
  { href: '/pro/dashboard/calendar', label: 'Agenda', permission: 'business.reservation.read' },
  {
    href: '/pro/dashboard/reservations',
    label: 'Réservations',
    permission: 'business.reservation.read',
  },
  { href: '/pro/dashboard/services', label: 'Prestations', permission: 'business.service.read' },
  { href: '/pro/dashboard/team', label: 'Équipe', permission: 'business.staff.read' },
  { href: '/pro/dashboard/hours', label: 'Horaires', permission: 'business.hours.write' },
  { href: '/pro/dashboard/gallery', label: 'Photos', permission: 'business.media.manage' },
  { href: '/pro/dashboard/customers', label: 'Clients', permission: 'business.customer.read' },
  { href: '/pro/dashboard/reviews', label: 'Avis', permission: 'business.review.respond' },
  {
    href: '/pro/dashboard/analytics',
    label: 'Statistiques',
    permission: 'business.analytics.read',
  },
  { href: '/pro/dashboard/profile', label: 'Mon établissement', permission: 'business.update' },
  {
    href: '/pro/dashboard/subscription',
    label: 'Abonnement',
    permission: 'business.subscription.read',
  },
];

/** The landing page for someone who cannot read the revenue overview. */
export const PRO_HOME_FALLBACK = '/pro/dashboard/calendar';
