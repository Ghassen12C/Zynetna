import type { RoleName } from '@prisma/client';
import { ROLE_PERMISSIONS, type Permission, isTenantScoped } from './permissions';

/**
 * The authenticated caller, resolved once per request.
 *
 * `businessRoles` maps businessId → roles held there. Platform-wide roles
 * (SUPER_ADMIN, CUSTOMER) live in `globalRoles`. Every authorization answer in
 * the application is derived from this object.
 */
export type Actor = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: string;
  globalRoles: RoleName[];
  businessRoles: Record<string, RoleName[]>;
};

export const ANONYMOUS = null;
export type MaybeActor = Actor | null;

export function isSuperAdmin(actor: MaybeActor): boolean {
  return actor?.globalRoles.includes('SUPER_ADMIN') ?? false;
}

/** Businesses where the actor holds any role. */
export function tenantIds(actor: MaybeActor): string[] {
  return actor ? Object.keys(actor.businessRoles) : [];
}

export function rolesIn(actor: MaybeActor, businessId: string): RoleName[] {
  return actor?.businessRoles[businessId] ?? [];
}

/**
 * The single authorization question in the application.
 *
 * A tenant-scoped permission REQUIRES a businessId and is only granted through
 * a role held *in that business*. A super admin is allowed everywhere; nobody
 * else can reach across a tenant boundary, because the only roles consulted
 * are the ones recorded for that exact business.
 */
export function can(
  actor: MaybeActor,
  permission: Permission,
  scope?: { businessId?: string | null },
): boolean {
  if (!actor) return false;
  if (isSuperAdmin(actor)) return true;

  if (isTenantScoped(permission)) {
    const businessId = scope?.businessId;
    if (!businessId) return false;
    const roles = actor.businessRoles[businessId];
    if (!roles || roles.length === 0) return false;
    return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
  }

  return actor.globalRoles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

/** Every permission the actor holds in a given business — for UI gating. */
export function permissionsIn(actor: MaybeActor, businessId: string): Permission[] {
  if (!actor) return [];
  if (isSuperAdmin(actor)) return [...ROLE_PERMISSIONS.SUPER_ADMIN];
  const roles = actor.businessRoles[businessId] ?? [];
  return [...new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r]))];
}

export function displayName(actor: Actor): string {
  return `${actor.firstName} ${actor.lastName}`.trim();
}

export function initials(actor: Actor): string {
  return `${actor.firstName[0] ?? ''}${actor.lastName[0] ?? ''}`.toUpperCase();
}
