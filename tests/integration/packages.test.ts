import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createReservation } from '@/server/services/booking';
import { getDayAvailability } from '@/server/services/availability';
import { resolvePackItems, setPackItems } from '@/server/services/packages';
import { dayKeyOf } from '@/domain/scheduling/time';
import { futureSlot, makeBusiness, makeCustomer, resetDatabase, testDb } from '../setup';

/**
 * Packs (wedding, events…) are services that bundle other services. They go
 * through the same booking engine, with two rules of their own: they can open
 * further ahead than the business's usual horizon, and the business can insist
 * on confirming each request.
 */

async function addService(businessId: string, staffId: string, name: string, extra = {}) {
  const service = await testDb.service.create({
    data: { businessId, name, priceAmount: 10, durationMinutes: 30, ...extra },
  });
  await testDb.staffService.create({ data: { staffMemberId: staffId, serviceId: service.id } });
  return service;
}

describe('packs', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('bundles only regular services of the same business', async () => {
    const a = await makeBusiness({ slug: 'pack-a', ownerEmail: 'pack-a@test.tn' });
    const b = await makeBusiness({ slug: 'pack-b', ownerEmail: 'pack-b@test.tn' });
    const barbe = await addService(a.business.id, a.staff.id, 'Barbe');
    const otherPack = await addService(a.business.id, a.staff.id, 'Autre pack', { isPackage: true });
    const pack = await addService(a.business.id, a.staff.id, 'Pack Marié', { isPackage: true });

    // Another business's service, another pack and the pack itself are dropped.
    const included = await resolvePackItems(a.business.id, pack.id, [
      a.service.id,
      b.service.id,
      otherPack.id,
      pack.id,
      barbe.id,
      barbe.id,
    ]);
    expect(included).toEqual([a.service.id, barbe.id]);

    await setPackItems(pack.id, included);
    const rows = await testDb.servicePackageItem.findMany({
      where: { packageId: pack.id },
      orderBy: { position: 'asc' },
    });
    expect(rows.map((r) => r.serviceId)).toEqual([a.service.id, barbe.id]);
  });

  it('refuses a pack that would bundle fewer than two of its own services', async () => {
    const a = await makeBusiness({ slug: 'pack-c', ownerEmail: 'pack-c@test.tn' });
    const b = await makeBusiness({ slug: 'pack-d', ownerEmail: 'pack-d@test.tn' });

    // One own service plus one foreign one is a pack of one: refused.
    await expect(
      resolvePackItems(a.business.id, null, [a.service.id, b.service.id]),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('stays pending when it asks for confirmation, even if the business auto-confirms', async () => {
    const { business, staff } = await makeBusiness({ slug: 'pack-e', ownerEmail: 'pack-e@test.tn' });
    const pack = await addService(business.id, staff.id, 'Pack Mariée', {
      isPackage: true,
      requiresConfirmation: true,
    });
    const customer = await makeCustomer('bride@test.tn');

    const reservation = await createReservation({
      businessId: business.id,
      serviceId: pack.id,
      staffMemberId: staff.id,
      startAt: futureSlot(5, 10),
      customerId: customer.id,
    });
    expect(business.autoConfirm).toBe(true);
    expect(reservation.status).toBe('PENDING');
  });

  it('opens as far ahead as the service allows, past the business horizon', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'pack-f',
      ownerEmail: 'pack-f@test.tn',
    });
    await testDb.business.update({ where: { id: business.id }, data: { maxAdvanceDays: 30 } });
    const pack = await addService(business.id, staff.id, 'Pack Henné', {
      isPackage: true,
      maxAdvanceDays: 200,
    });
    const customer = await makeCustomer('henna@test.tn');
    const farAway = futureSlot(90, 11);
    const day = dayKeyOf(business.timezone, farAway);

    // The everyday service still follows the business's 30 days…
    const everyday = await getDayAvailability({ businessId: business.id, serviceId: service.id, day });
    expect(everyday.closedReason).toBe('TOO_FAR');
    await expect(
      createReservation({
        businessId: business.id,
        serviceId: service.id,
        staffMemberId: staff.id,
        startAt: farAway,
        customerId: customer.id,
      }),
    ).rejects.toThrow();

    // …while the pack opens 90 days ahead.
    const packDay = await getDayAvailability({ businessId: business.id, serviceId: pack.id, day });
    expect(packDay.slots.length).toBeGreaterThan(0);
    const booked = await createReservation({
      businessId: business.id,
      serviceId: pack.id,
      staffMemberId: staff.id,
      startAt: farAway,
      customerId: customer.id,
    });
    expect(booked.status).toBe('CONFIRMED');
  });
});
