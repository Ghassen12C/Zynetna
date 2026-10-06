import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createReservation, transitionReservation } from '@/server/services/booking';
import { getDayAvailability } from '@/server/services/availability';
import { AppError } from '@/lib/errors';
import { dayKeyOf } from '@/domain/scheduling/time';
import {
  futureSlot,
  makeBusiness,
  makeCustomer,
  resetDatabase,
  testDb,
} from '../setup';

/**
 * The guarantee the whole product rests on, exercised against a real Postgres:
 * two customers cannot hold the same professional at the same time.
 */
describe('booking engine — double-booking protection', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('accepts the first booking and rejects the second for the same slot', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'salon-a',
      ownerEmail: 'a@test.tn',
    });
    const alice = await makeCustomer('alice@test.tn');
    const bob = await makeCustomer('bob@test.tn');
    const startAt = futureSlot(3, 15);

    const first = await createReservation({
      businessId: business.id,
      serviceId: service.id,
      staffMemberId: staff.id,
      startAt,
      customerId: alice.id,
    });
    expect(first.status).toBe('CONFIRMED');

    await expect(
      createReservation({
        businessId: business.id,
        serviceId: service.id,
        staffMemberId: staff.id,
        startAt,
        customerId: bob.id,
      }),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });

    expect(await testDb.reservation.count({ where: { businessId: business.id } })).toBe(1);
  });

  it('rejects an overlapping — not identical — slot', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'salon-b',
      ownerEmail: 'b@test.tn',
      serviceMinutes: 60,
    });
    const alice = await makeCustomer('alice2@test.tn');
    const bob = await makeCustomer('bob2@test.tn');

    await createReservation({
      businessId: business.id,
      serviceId: service.id,
      staffMemberId: staff.id,
      startAt: futureSlot(3, 15),
      customerId: alice.id,
    });

    // 15:30 starts inside the 15:00–16:00 appointment.
    await expect(
      createReservation({
        businessId: business.id,
        serviceId: service.id,
        staffMemberId: staff.id,
        startAt: futureSlot(3, 15, 30),
        customerId: bob.id,
      }),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
  });

  it('allows an adjacent slot', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'salon-c',
      ownerEmail: 'c@test.tn',
    });
    const alice = await makeCustomer('alice3@test.tn');
    const bob = await makeCustomer('bob3@test.tn');

    await createReservation({
      businessId: business.id, serviceId: service.id, staffMemberId: staff.id,
      startAt: futureSlot(3, 15), customerId: alice.id,
    });

    const second = await createReservation({
      businessId: business.id, serviceId: service.id, staffMemberId: staff.id,
      startAt: futureSlot(3, 15, 30), customerId: bob.id,
    });
    expect(second.status).toBe('CONFIRMED');
  });

  it('frees the slot when the first reservation is cancelled', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'salon-d',
      ownerEmail: 'd@test.tn',
    });
    const alice = await makeCustomer('alice4@test.tn');
    const bob = await makeCustomer('bob4@test.tn');
    const startAt = futureSlot(3, 15);

    const first = await createReservation({
      businessId: business.id, serviceId: service.id, staffMemberId: staff.id,
      startAt, customerId: alice.id,
    });

    await transitionReservation({
      reservationId: first.id,
      to: 'CANCELLED_BY_CUSTOMER',
      reason: 'test',
    });

    const second = await createReservation({
      businessId: business.id, serviceId: service.id, staffMemberId: staff.id,
      startAt, customerId: bob.id,
    });
    expect(second.id).not.toBe(first.id);
  });

  it('survives a concurrent race: exactly one of many simultaneous bookings wins', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'salon-race',
      ownerEmail: 'race@test.tn',
    });
    const customers = await Promise.all(
      Array.from({ length: 6 }, (_, i) => makeCustomer(`racer${i}@test.tn`)),
    );
    const startAt = futureSlot(4, 11);

    // All six fire at once, with no coordination between them.
    const results = await Promise.allSettled(
      customers.map((customer) =>
        createReservation({
          businessId: business.id,
          serviceId: service.id,
          staffMemberId: staff.id,
          startAt,
          customerId: customer.id,
        }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(5);
    // Every loser gets the actionable message, not a stack trace.
    for (const result of rejected) {
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(AppError);
      expect((result as PromiseRejectedResult).reason.code).toBe('SLOT_UNAVAILABLE');
    }
    expect(
      await testDb.reservation.count({
        where: { staffMemberId: staff.id, status: { in: ['PENDING', 'CONFIRMED'] } },
      }),
    ).toBe(1);
  });
});

describe('booking engine — availability reflects reality', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('removes a booked slot from the offered times', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'salon-av',
      ownerEmail: 'av@test.tn',
    });
    const customer = await makeCustomer('av-cust@test.tn');
    const startAt = futureSlot(5, 14);
    const day = dayKeyOf('Africa/Tunis', startAt);

    const before = await getDayAvailability({
      businessId: business.id,
      serviceId: service.id,
      day,
    });
    expect(before.slots.map((s) => s.time)).toContain('14:00');

    await createReservation({
      businessId: business.id, serviceId: service.id, staffMemberId: staff.id,
      startAt, customerId: customer.id,
    });

    const after = await getDayAvailability({
      businessId: business.id,
      serviceId: service.id,
      day,
    });
    expect(after.slots.map((s) => s.time)).not.toContain('14:00');
    expect(after.slots.map((s) => s.time)).toContain('14:30');
  });

  it('refuses a time the engine never offered', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'salon-closed',
      ownerEmail: 'closed@test.tn',
    });
    const customer = await makeCustomer('closed-cust@test.tn');

    // 03:00 is outside the 09:00–19:00 window — a hand-crafted request.
    await expect(
      createReservation({
        businessId: business.id, serviceId: service.id, staffMemberId: staff.id,
        startAt: futureSlot(5, 3), customerId: customer.id,
      }),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
  });

  it('refuses a professional who does not perform the service', async () => {
    const { business, service } = await makeBusiness({
      slug: 'salon-wrong-staff',
      ownerEmail: 'ws@test.tn',
    });
    const customer = await makeCustomer('ws-cust@test.tn');

    const otherStaff = await testDb.staffMember.create({
      data: { businessId: business.id, displayName: 'Autre', isBookable: true },
    });

    await expect(
      createReservation({
        businessId: business.id, serviceId: service.id, staffMemberId: otherStaff.id,
        startAt: futureSlot(5, 10), customerId: customer.id,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
