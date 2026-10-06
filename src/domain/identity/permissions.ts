import type { RoleName } from '@prisma/client';

/**
 * Permission-based authorization.
 *
 * Roles are never checked directly in feature code — callers ask for a
 * permission. That keeps authorization decisions in one auditable table
 * instead of scattered `if (role === 'SUPER_ADMIN')` branches, and makes a
 * new role a data change rather than a search-and-replace.
 */
export const PERMISSIONS = [
  // customer
  'reservation.create',
  'reservation.read.own',
  'reservation.cancel.own',
  'reservation.reschedule.own',
  'review.create',
  'review.update.own',
  'favorite.manage',
  'profile.manage.own',

  // business — scoped to one tenant
  'business.read',
  'business.update',
  'business.publish',
  'business.media.manage',
  'business.service.read',
  'business.service.write',
  'business.staff.read',
  'business.staff.write',
  'business.hours.write',
  'business.policy.write',
  'business.reservation.read',
  'business.reservation.write',
  'business.customer.read',
  'business.review.respond',
  'business.analytics.read',
  'business.subscription.read',
  'business.subscription.manage',
  'business.settings.write',

  // platform
  'admin.dashboard.read',
  'admin.user.read',
  'admin.user.write',
  'admin.business.read',
  'admin.business.moderate',
  'admin.category.write',
  'admin.reservation.read',
  'admin.review.moderate',
  'admin.report.handle',
  'admin.subscription.manage',
  'admin.payment.manage',
  'admin.audit.read',
  'admin.setting.write',
  'admin.flag.write',
  'admin.analytics.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const CUSTOMER: Permission[] = [
  'reservation.create',
  'reservation.read.own',
  'reservation.cancel.own',
  'reservation.reschedule.own',
  'review.create',
  'review.update.own',
  'favorite.manage',
  'profile.manage.own',
];

/** An employee manages their own work, not the business itself. */
const BUSINESS_EMPLOYEE: Permission[] = [
  'business.read',
  'business.service.read',
  'business.staff.read',
  'business.reservation.read',
  'business.reservation.write',
  'business.customer.read',
];

const BUSINESS_OWNER: Permission[] = [
  ...BUSINESS_EMPLOYEE,
  'business.update',
  'business.publish',
  'business.media.manage',
  'business.service.write',
  'business.staff.write',
  'business.hours.write',
  'business.policy.write',
  'business.review.respond',
  'business.analytics.read',
  'business.subscription.read',
  'business.subscription.manage',
  'business.settings.write',
];

const SUPER_ADMIN: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  CUSTOMER: CUSTOMER,
  BUSINESS_EMPLOYEE: BUSINESS_EMPLOYEE,
  BUSINESS_OWNER: BUSINESS_OWNER,
  SUPER_ADMIN: SUPER_ADMIN,
};

/** Permissions that only make sense inside one business. */
export function isTenantScoped(permission: Permission): boolean {
  return permission.startsWith('business.');
}
