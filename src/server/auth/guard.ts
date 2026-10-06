import type { Actor } from '@/domain/identity/actor';
import { can, isSuperAdmin } from '@/domain/identity/actor';
import type { Permission } from '@/domain/identity/permissions';
import { db } from '@/lib/db';
import { forbidden, notFound, unauthenticated } from '@/lib/errors';
import { getActor } from './session';

/**
 * Authorization guards — the ONLY sanctioned way feature code reaches a
 * business-scoped record.
 *
 * Tenant isolation lives here rather than in each route, so there is one place
 * to audit and one place that can be wrong. A business owner physically cannot
 * read another business's reservations, customers, staff, services, media,
 * analytics or settings: every path below resolves the tenant from the actor's
 * own role assignments before any query runs.
 */

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw unauthenticated();
  return actor;
}

/** Require a platform-wide permission. */
export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor();
  if (!can(actor, permission)) throw forbidden();
  return actor;
}

export async function requireSuperAdmin(): Promise<Actor> {
  const actor = await requireActor();
  if (!isSuperAdmin(actor)) throw forbidden();
  return actor;
}

/**
 * Require a permission *inside a specific business*.
 *
 * Returns 404 rather than 403 when the actor holds no role in the business, so
 * that probing IDs cannot be used to discover which businesses exist.
 */
export async function requireBusinessAccess(
  businessId: string,
  permission: Permission,
): Promise<{ actor: Actor; businessId: string }> {
  const actor = await requireActor();

  if (!isSuperAdmin(actor)) {
    const roles = actor.businessRoles[businessId];
    if (!roles || roles.length === 0) throw notFound();
  }

  if (!can(actor, permission, { businessId })) throw forbidden();
  return { actor, businessId };
}

/**
 * Resolve the business the actor manages, by slug, with a permission check.
 * Used by every /pro route.
 */
export async function requireBusinessBySlug(
  slug: string,
  permission: Permission,
): Promise<{ actor: Actor; businessId: string }> {
  // Authenticate before the lookup, so an anonymous probe cannot learn
  // whether a slug exists.
  await requireActor();

  const business = await db.business.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!business) throw notFound();

  return requireBusinessAccess(business.id, permission);
}

/**
 * The businesses an actor may act on. A super admin gets `undefined`, meaning
 * "no tenant filter"; everyone else gets an explicit list, which callers must
 * put into their `where` clause.
 */
export function tenantFilter(actor: Actor): { in: string[] } | undefined {
  if (isSuperAdmin(actor)) return undefined;
  return { in: Object.keys(actor.businessRoles) };
}

/**
 * The actor's primary business — the one a professional dashboard defaults to.
 * Prefers an owned business over one where they are only an employee.
 */
export async function primaryBusinessId(actor: Actor): Promise<string | null> {
  const owned = Object.entries(actor.businessRoles).find(([, roles]) =>
    roles.includes('BUSINESS_OWNER'),
  );
  if (owned) return owned[0];
  const any = Object.keys(actor.businessRoles)[0];
  return any ?? null;
}

/**
 * Assert that a record belongs to a business the actor may act on.
 * Used for nested resources (a service, a staff member, a reservation) where
 * the ID arrives from the client and must never be trusted.
 */
export async function assertOwnedBy(
  actor: Actor,
  businessId: string,
  permission: Permission,
): Promise<void> {
  if (isSuperAdmin(actor)) return;
  const roles = actor.businessRoles[businessId];
  if (!roles || roles.length === 0) throw notFound();
  if (!can(actor, permission, { businessId })) throw forbidden();
}
