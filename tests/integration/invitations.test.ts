import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  acceptInvitation,
  inviteToTeam,
  listInvitations,
  peekInvitation,
  revokeInvitation,
} from '@/server/services/invitations';
import { makeBusiness, makeCustomer, resetDatabase, testDb } from '../setup';
import type { Actor } from '@/domain/identity/actor';

function actorOf(user: { id: string; email: string }, roles: Actor['globalRoles'] = ['CUSTOMER']): Actor {
  return {
    userId: user.id,
    email: user.email,
    firstName: 'Test',
    lastName: 'Person',
    locale: 'fr',
    globalRoles: roles,
    businessRoles: {},
  };
}

/**
 * Team invitations.
 *
 * An invitation grants standing access to a business's calendar and customer
 * list, so the interesting cases are all the ways one could be misused: a
 * forwarded link, a stale link, a link redeemed by the wrong person, or a link
 * that quietly rebuilds access after being withdrawn.
 */
describe('team invitations', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('grants the role only when the invitation is accepted', async () => {
    const { business, owner } = await makeBusiness({ slug: 'inv-a', ownerEmail: 'a@test.tn' });
    const employee = await makeCustomer('employee@test.tn');

    const { token } = await inviteToTeam({
      businessId: business.id,
      email: 'employee@test.tn',
      role: 'BUSINESS_EMPLOYEE',
      invitedBy: actorOf(owner, ['BUSINESS_OWNER']),
    });

    // Until acceptance, the person has no access at all.
    expect(
      await testDb.roleAssignment.count({
        where: { userId: employee.id, businessId: business.id },
      }),
    ).toBe(0);

    await acceptInvitation(token, actorOf(employee));

    const granted = await testDb.roleAssignment.findFirst({
      where: { userId: employee.id, businessId: business.id },
      select: { role: true },
    });
    expect(granted?.role).toBe('BUSINESS_EMPLOYEE');
  });

  it('cannot be redeemed twice', async () => {
    const { business, owner } = await makeBusiness({ slug: 'inv-b', ownerEmail: 'b@test.tn' });
    const employee = await makeCustomer('twice@test.tn');

    const { token } = await inviteToTeam({
      businessId: business.id,
      email: 'twice@test.tn',
      role: 'BUSINESS_EMPLOYEE',
      invitedBy: actorOf(owner, ['BUSINESS_OWNER']),
    });

    await acceptInvitation(token, actorOf(employee));
    await expect(acceptInvitation(token, actorOf(employee))).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('refuses an account other than the invited address', async () => {
    const { business, owner } = await makeBusiness({ slug: 'inv-c', ownerEmail: 'c@test.tn' });
    const intended = await makeCustomer('intended@test.tn');
    const stranger = await makeCustomer('stranger@test.tn');

    const { token } = await inviteToTeam({
      businessId: business.id,
      email: 'intended@test.tn',
      role: 'BUSINESS_EMPLOYEE',
      invitedBy: actorOf(owner, ['BUSINESS_OWNER']),
    });

    // A forwarded invitation must not put the wrong person on the roster.
    await expect(acceptInvitation(token, actorOf(stranger))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(
      await testDb.roleAssignment.count({
        where: { userId: stranger.id, businessId: business.id },
      }),
    ).toBe(0);

    // The intended recipient can still use it.
    await acceptInvitation(token, actorOf(intended));
    expect(
      await testDb.roleAssignment.count({
        where: { userId: intended.id, businessId: business.id },
      }),
    ).toBe(1);
  });

  it('refuses an expired invitation', async () => {
    const { business, owner } = await makeBusiness({ slug: 'inv-d', ownerEmail: 'd@test.tn' });
    const employee = await makeCustomer('late@test.tn');

    const { token, id } = await inviteToTeam({
      businessId: business.id,
      email: 'late@test.tn',
      role: 'BUSINESS_EMPLOYEE',
      invitedBy: actorOf(owner, ['BUSINESS_OWNER']),
    });
    await testDb.staffInvitation.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(acceptInvitation(token, actorOf(employee))).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('refuses an invitation that was withdrawn', async () => {
    const { business, owner } = await makeBusiness({ slug: 'inv-e', ownerEmail: 'e@test.tn' });
    const employee = await makeCustomer('withdrawn@test.tn');

    const { token, id } = await inviteToTeam({
      businessId: business.id,
      email: 'withdrawn@test.tn',
      role: 'BUSINESS_EMPLOYEE',
      invitedBy: actorOf(owner, ['BUSINESS_OWNER']),
    });
    await revokeInvitation(business.id, id);

    await expect(acceptInvitation(token, actorOf(employee))).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('stores the token only as a hash', async () => {
    const { business, owner } = await makeBusiness({ slug: 'inv-f', ownerEmail: 'f@test.tn' });
    const { token, id } = await inviteToTeam({
      businessId: business.id,
      email: 'hash@test.tn',
      role: 'BUSINESS_EMPLOYEE',
      invitedBy: actorOf(owner, ['BUSINESS_OWNER']),
    });

    const row = await testDb.staffInvitation.findUniqueOrThrow({
      where: { id },
      select: { tokenHash: true },
    });
    // A leaked row must not be redeemable.
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('will not let one business revoke another business’s invitation', async () => {
    const a = await makeBusiness({ slug: 'inv-g', ownerEmail: 'g@test.tn' });
    const b = await makeBusiness({ slug: 'inv-h', ownerEmail: 'h@test.tn' });

    const { id } = await inviteToTeam({
      businessId: a.business.id,
      email: 'target@test.tn',
      role: 'BUSINESS_EMPLOYEE',
      invitedBy: actorOf(a.owner, ['BUSINESS_OWNER']),
    });

    await expect(revokeInvitation(b.business.id, id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('allows only one outstanding invitation per address', async () => {
    const { business, owner } = await makeBusiness({ slug: 'inv-i', ownerEmail: 'i@test.tn' });
    const invite = () =>
      inviteToTeam({
        businessId: business.id,
        email: 'dup@test.tn',
        role: 'BUSINESS_EMPLOYEE',
        invitedBy: actorOf(owner, ['BUSINESS_OWNER']),
      });

    const first = await invite();
    await expect(invite()).rejects.toMatchObject({ code: 'CONFLICT' });

    // Once withdrawn, the same person can be invited again.
    await revokeInvitation(business.id, first.id);
    await expect(invite()).resolves.toBeTruthy();
  });

  it('links the account to its staff row on acceptance', async () => {
    const { business, owner, staff } = await makeBusiness({
      slug: 'inv-j',
      ownerEmail: 'j@test.tn',
    });
    const employee = await makeCustomer('linked@test.tn');

    const { token } = await inviteToTeam({
      businessId: business.id,
      email: 'linked@test.tn',
      role: 'BUSINESS_EMPLOYEE',
      staffMemberId: staff.id,
      invitedBy: actorOf(owner, ['BUSINESS_OWNER']),
    });
    await acceptInvitation(token, actorOf(employee));

    const linked = await testDb.staffMember.findUniqueOrThrow({
      where: { id: staff.id },
      select: { userId: true },
    });
    expect(linked.userId).toBe(employee.id);
  });

  it('refuses to hand out a role it has no business granting', async () => {
    const { business, owner } = await makeBusiness({ slug: 'inv-k', ownerEmail: 'k@test.tn' });
    await expect(
      inviteToTeam({
        businessId: business.id,
        email: 'admin@test.tn',
        // Escalation attempt: platform administrator is not a team role.
        role: 'SUPER_ADMIN',
        invitedBy: actorOf(owner, ['BUSINESS_OWNER']),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('shows the invitation before the visitor commits to anything', async () => {
    const { business, owner } = await makeBusiness({ slug: 'inv-l', ownerEmail: 'l@test.tn' });
    const { token } = await inviteToTeam({
      businessId: business.id,
      email: 'peek@test.tn',
      role: 'BUSINESS_EMPLOYEE',
      invitedBy: actorOf(owner, ['BUSINESS_OWNER']),
    });

    const peeked = await peekInvitation(token);
    expect(peeked).toMatchObject({ email: 'peek@test.tn', status: 'PENDING' });
    expect(await peekInvitation('not-a-real-token')).toBeNull();
  });

  it('lists invitations for the business that sent them', async () => {
    const { business, owner } = await makeBusiness({ slug: 'inv-m', ownerEmail: 'm@test.tn' });
    await inviteToTeam({
      businessId: business.id,
      email: 'listed@test.tn',
      role: 'BUSINESS_EMPLOYEE',
      invitedBy: actorOf(owner, ['BUSINESS_OWNER']),
    });

    const rows = await listInvitations(business.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: 'listed@test.tn', status: 'PENDING' });
  });
});
