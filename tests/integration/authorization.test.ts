import { beforeEach, describe, expect, it } from 'vitest';
import { can, permissionsIn, tenantIds } from '@/domain/identity/actor';
import type { Actor } from '@/domain/identity/actor';
import { makeBusiness, makeCustomer, resetDatabase, testDb } from '../setup';

/**
 * Tenant isolation is the security property a marketplace lives or dies by.
 * These assert that a business owner's permissions stop at their own business.
 */

function actorFor(userId: string, businessRoles: Actor['businessRoles'], globalRoles: Actor['globalRoles'] = []): Actor {
  return {
    userId,
    email: `${userId}@test.tn`,
    firstName: 'Test',
    lastName: 'User',
    locale: 'fr',
    globalRoles,
    businessRoles,
  };
}

describe('authorization — tenant isolation', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('grants a business permission only inside the owner’s own business', async () => {
    const salonA = await makeBusiness({ slug: 'iso-a', ownerEmail: 'iso-a@test.tn' });
    const salonB = await makeBusiness({ slug: 'iso-b', ownerEmail: 'iso-b@test.tn' });

    const ownerA = actorFor(salonA.owner.id, { [salonA.business.id]: ['BUSINESS_OWNER'] });

    expect(can(ownerA, 'business.service.write', { businessId: salonA.business.id })).toBe(true);
    expect(can(ownerA, 'business.service.write', { businessId: salonB.business.id })).toBe(false);
    expect(can(ownerA, 'business.reservation.read', { businessId: salonB.business.id })).toBe(false);
    expect(can(ownerA, 'business.customer.read', { businessId: salonB.business.id })).toBe(false);
    expect(can(ownerA, 'business.analytics.read', { businessId: salonB.business.id })).toBe(false);
    expect(can(ownerA, 'business.media.manage', { businessId: salonB.business.id })).toBe(false);
  });

  it('denies a tenant-scoped permission when no business is named', async () => {
    const salon = await makeBusiness({ slug: 'iso-c', ownerEmail: 'iso-c@test.tn' });
    const owner = actorFor(salon.owner.id, { [salon.business.id]: ['BUSINESS_OWNER'] });

    // Without a businessId there is no tenant to check against, so the answer
    // must be no — never a silent yes.
    expect(can(owner, 'business.service.write')).toBe(false);
    expect(can(owner, 'business.update', { businessId: null })).toBe(false);
  });

  it('gives an employee a narrower set than the owner', async () => {
    const salon = await makeBusiness({ slug: 'iso-d', ownerEmail: 'iso-d@test.tn' });
    const id = salon.business.id;

    const employee = actorFor('emp', { [id]: ['BUSINESS_EMPLOYEE'] });
    const owner = actorFor('own', { [id]: ['BUSINESS_OWNER'] });

    expect(can(employee, 'business.reservation.read', { businessId: id })).toBe(true);
    expect(can(employee, 'business.reservation.write', { businessId: id })).toBe(true);

    // An employee runs appointments; they do not reshape the business.
    expect(can(employee, 'business.service.write', { businessId: id })).toBe(false);
    expect(can(employee, 'business.staff.write', { businessId: id })).toBe(false);
    expect(can(employee, 'business.subscription.manage', { businessId: id })).toBe(false);
    expect(can(employee, 'business.publish', { businessId: id })).toBe(false);
    expect(can(employee, 'business.analytics.read', { businessId: id })).toBe(false);

    expect(can(owner, 'business.service.write', { businessId: id })).toBe(true);
    expect(permissionsIn(owner, id).length).toBeGreaterThan(permissionsIn(employee, id).length);
  });

  it('gives a customer no business or admin permission anywhere', async () => {
    const salon = await makeBusiness({ slug: 'iso-e', ownerEmail: 'iso-e@test.tn' });
    const customer = await makeCustomer('cust-iso@test.tn');
    const actor = actorFor(customer.id, {}, ['CUSTOMER']);

    expect(can(actor, 'reservation.create')).toBe(true);
    expect(can(actor, 'review.create')).toBe(true);

    expect(can(actor, 'business.read', { businessId: salon.business.id })).toBe(false);
    expect(can(actor, 'business.reservation.read', { businessId: salon.business.id })).toBe(false);
    expect(can(actor, 'admin.business.moderate')).toBe(false);
    expect(can(actor, 'admin.user.write')).toBe(false);
    expect(can(actor, 'admin.setting.write')).toBe(false);
    expect(tenantIds(actor)).toEqual([]);
  });

  it('gives a super admin every permission, in every business', async () => {
    const salonA = await makeBusiness({ slug: 'iso-f', ownerEmail: 'iso-f@test.tn' });
    const salonB = await makeBusiness({ slug: 'iso-g', ownerEmail: 'iso-g@test.tn' });
    const admin = actorFor('admin', {}, ['SUPER_ADMIN']);

    expect(can(admin, 'business.update', { businessId: salonA.business.id })).toBe(true);
    expect(can(admin, 'business.update', { businessId: salonB.business.id })).toBe(true);
    expect(can(admin, 'admin.business.moderate')).toBe(true);
    expect(can(admin, 'admin.audit.read')).toBe(true);
  });

  it('refuses everything to an anonymous visitor', () => {
    expect(can(null, 'reservation.create')).toBe(false);
    expect(can(null, 'business.read', { businessId: 'anything' })).toBe(false);
    expect(can(null, 'admin.dashboard.read')).toBe(false);
    expect(tenantIds(null)).toEqual([]);
  });

  it('keeps a user’s two roles in two businesses apart', async () => {
    const salonA = await makeBusiness({ slug: 'iso-h', ownerEmail: 'iso-h@test.tn' });
    const salonB = await makeBusiness({ slug: 'iso-i', ownerEmail: 'iso-i@test.tn' });

    // Owns A, merely works at B.
    const actor = actorFor('multi', {
      [salonA.business.id]: ['BUSINESS_OWNER'],
      [salonB.business.id]: ['BUSINESS_EMPLOYEE'],
    });

    expect(can(actor, 'business.service.write', { businessId: salonA.business.id })).toBe(true);
    expect(can(actor, 'business.service.write', { businessId: salonB.business.id })).toBe(false);
    expect(can(actor, 'business.reservation.read', { businessId: salonB.business.id })).toBe(true);
    expect(tenantIds(actor).sort()).toEqual([salonA.business.id, salonB.business.id].sort());
  });
});

describe('authorization — data scoping', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('keeps each business’s reservations in its own tenant', async () => {
    const salonA = await makeBusiness({ slug: 'scope-a', ownerEmail: 'scope-a@test.tn' });
    const salonB = await makeBusiness({ slug: 'scope-b', ownerEmail: 'scope-b@test.tn' });
    const customer = await makeCustomer('scope-cust@test.tn');

    for (const [index, salon] of [salonA, salonB].entries()) {
      await testDb.reservation.create({
        data: {
          reference: `ZY-SCOPE${index}`,
          businessId: salon.business.id,
          customerId: customer.id,
          staffMemberId: salon.staff.id,
          status: 'CONFIRMED',
          startAt: new Date('2027-01-11T10:00:00Z'),
          endAt: new Date('2027-01-11T10:30:00Z'),
          totalAmount: 20,
        },
      });
    }

    // The tenant filter every business-scoped query must carry.
    const visibleToA = await testDb.reservation.findMany({
      where: { businessId: salonA.business.id },
    });
    expect(visibleToA).toHaveLength(1);
    expect(visibleToA[0]!.businessId).toBe(salonA.business.id);

    expect(await testDb.reservation.count()).toBe(2);
  });
});
