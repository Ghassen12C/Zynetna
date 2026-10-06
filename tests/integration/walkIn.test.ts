import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createReservation } from '@/server/services/booking';
import { getDayAvailability } from '@/server/services/availability';
import { dayKeyOf } from '@/domain/scheduling/time';
import { futureSlot, makeBusiness, makeCustomer, resetDatabase, testDb } from '../setup';

/**
 * Counter bookings — the walk-in and telephone appointments that make up most
 * of a Tunisian salon's day.
 *
 * The point of these tests is that a booking taken at the counter is a real
 * reservation: it occupies the slot, it collides with online bookings, and the
 * person it belongs to needs no account.
 */
describe('walk-in and phone bookings', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('books someone with no account from just a name', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'walkin-a',
      ownerEmail: 'a@test.tn',
    });

    const reservation = await createReservation({
      businessId: business.id,
      serviceId: service.id,
      staffMemberId: staff.id,
      startAt: futureSlot(2, 10),
      channel: 'WALK_IN',
      guestName: 'Leïla Ben Salah',
      guestPhone: '+21620123456',
      atCounter: true,
    });

    expect(reservation.customerId).toBeNull();
    expect(reservation.channel).toBe('WALK_IN');

    const stored = await testDb.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { guestName: true, guestPhone: true, customerId: true },
    });
    expect(stored.guestName).toBe('Leïla Ben Salah');
    expect(stored.customerId).toBeNull();
  });

  it('blocks the slot against an online customer', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'walkin-b',
      ownerEmail: 'b@test.tn',
    });
    const online = await makeCustomer('online@test.tn');
    const startAt = futureSlot(2, 11);

    await createReservation({
      businessId: business.id,
      serviceId: service.id,
      staffMemberId: staff.id,
      startAt,
      channel: 'PHONE',
      guestName: 'Appel comptoir',
      atCounter: true,
    });

    // The whole reason this feature exists: the phone booking must remove the
    // slot from the public site, or the salon gets two people at 11:00.
    await expect(
      createReservation({
        businessId: business.id,
        serviceId: service.id,
        staffMemberId: staff.id,
        startAt,
        customerId: online.id,
      }),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });

    const day = dayKeyOf(business.timezone, startAt);
    const availability = await getDayAvailability({
      businessId: business.id,
      serviceId: service.id,
      staffMemberId: staff.id,
      day,
    });
    expect(availability.slots.some((s) => s.startAt.getTime() === startAt.getTime())).toBe(false);
  });

  it('loses to an online booking that got there first', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'walkin-c',
      ownerEmail: 'c@test.tn',
    });
    const online = await makeCustomer('first@test.tn');
    const startAt = futureSlot(2, 12);

    await createReservation({
      businessId: business.id,
      serviceId: service.id,
      staffMemberId: staff.id,
      startAt,
      customerId: online.id,
    });

    // The counter has no privilege over the slot itself.
    await expect(
      createReservation({
        businessId: business.id,
        serviceId: service.id,
        staffMemberId: staff.id,
        startAt,
        channel: 'WALK_IN',
        guestName: 'Trop tard',
        atCounter: true,
      }),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
  });

  it('waives minimum notice at the counter but not online', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'walkin-d',
      ownerEmail: 'd@test.tn',
    });
    // Three days notice, so a slot two days out is inside the window no matter
    // what time of day this test runs.
    await testDb.business.update({
      where: { id: business.id },
      data: { minNoticeMinutes: 3 * 24 * 60 },
    });
    const customer = await makeCustomer('late@test.tn');
    const startAt = futureSlot(2, 10);
    const day = dayKeyOf(business.timezone, startAt);

    // The customer-facing engine hides it; the counter engine offers it.
    const onlineView = await getDayAvailability({
      businessId: business.id,
      serviceId: service.id,
      staffMemberId: staff.id,
      day,
    });
    expect(onlineView.slots.some((s) => s.startAt.getTime() === startAt.getTime())).toBe(false);

    const counterView = await getDayAvailability({
      businessId: business.id,
      serviceId: service.id,
      staffMemberId: staff.id,
      day,
      ignoreMinNotice: true,
    });
    expect(counterView.slots.some((s) => s.startAt.getTime() === startAt.getTime())).toBe(true);

    await expect(
      createReservation({
        businessId: business.id,
        serviceId: service.id,
        staffMemberId: staff.id,
        startAt,
        customerId: customer.id,
      }),
    ).rejects.toMatchObject({ code: 'POLICY_VIOLATION' });

    const counter = await createReservation({
      businessId: business.id,
      serviceId: service.id,
      staffMemberId: staff.id,
      startAt,
      channel: 'WALK_IN',
      guestName: 'Sur place',
      atCounter: true,
    });
    expect(counter.status).toBe('CONFIRMED');
  });

  it('confirms immediately even when the business reviews online requests', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'walkin-g',
      ownerEmail: 'g@test.tn',
      autoConfirm: false,
    });
    const customer = await makeCustomer('pending@test.tn');

    // An online request waits for the business.
    const online = await createReservation({
      businessId: business.id,
      serviceId: service.id,
      staffMemberId: staff.id,
      startAt: futureSlot(2, 15),
      customerId: customer.id,
    });
    expect(online.status).toBe('PENDING');

    // A booking the business took itself has nothing to approve.
    const counter = await createReservation({
      businessId: business.id,
      serviceId: service.id,
      staffMemberId: staff.id,
      startAt: futureSlot(2, 16),
      channel: 'WALK_IN',
      guestName: 'Sur place',
      atCounter: true,
    });
    expect(counter.status).toBe('CONFIRMED');
  });

  it('still refuses a time outside working hours', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'walkin-e',
      ownerEmail: 'e@test.tn',
    });

    // 03:00 — the counter flag waives notice, never the opening hours.
    await expect(
      createReservation({
        businessId: business.id,
        serviceId: service.id,
        staffMemberId: staff.id,
        startAt: futureSlot(2, 3),
        channel: 'WALK_IN',
        guestName: 'Nuit',
        atCounter: true,
      }),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
  });

  it('survives a race between the counter and the website', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'walkin-f',
      ownerEmail: 'f@test.tn',
    });
    const online = await makeCustomer('racer@test.tn');
    const startAt = futureSlot(3, 14);

    const results = await Promise.allSettled([
      createReservation({
        businessId: business.id,
        serviceId: service.id,
        staffMemberId: staff.id,
        startAt,
        channel: 'WALK_IN',
        guestName: 'Comptoir',
        atCounter: true,
      }),
      createReservation({
        businessId: business.id,
        serviceId: service.id,
        staffMemberId: staff.id,
        startAt,
        customerId: online.id,
      }),
    ]);

    const won = results.filter((r) => r.status === 'fulfilled');
    expect(won).toHaveLength(1);
    expect(await testDb.reservation.count({ where: { businessId: business.id } })).toBe(1);
  });
});
