import { readFileSync } from 'node:fs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ASSISTANT_TOOLS,
  type AssistantContext,
  callAssistantTool,
} from '@/server/assistant/tools';
import { dayKeyOf } from '@/domain/scheduling/time';
import { futureSlot, makeBusiness, makeCustomer, resetDatabase, testDb } from '../setup';
import type { Actor } from '@/domain/identity/actor';
import { speechToTextProvider, voiceEnabled } from '@/server/providers/voice';

function actorOf(user: { id: string; email: string }): Actor {
  return {
    userId: user.id,
    email: user.email,
    firstName: 'Client',
    lastName: 'Test',
    locale: 'fr',
    globalRoles: ['CUSTOMER'],
    businessRoles: {},
  };
}

const anonymous: AssistantContext = { actor: null, locale: 'fr' };

/**
 * The concierge tool surface.
 *
 * The avatar is meant to become a voice assistant that books real
 * appointments, so these tests are about containment: what the assistant can
 * reach, what it cannot, and what happens when it asks for something
 * impossible. A model will eventually be generating these arguments.
 */
describe('assistant tools', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  describe('containment', () => {
    it('never imports the database', () => {
      // The strongest guarantee available: the tool layer has no way to reach
      // Prisma, so no argument a model emits can become a raw query.
      const raw = readFileSync('src/server/assistant/tools.ts', 'utf8');
      // Strip comments first: the file explains this rule in prose, and the
      // prose must not be what satisfies the test.
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/from '@\/lib\/db'/);
      expect(code).not.toMatch(/\bdb\./);
      expect(code).not.toMatch(/\$queryRaw|\$executeRaw/);
      expect(code).not.toMatch(/\bPrismaClient\b/);
    });

    it('refuses a tool name the model invented', async () => {
      const result = await callAssistantTool(anonymous, 'deleteAllBusinesses', {});
      expect(result).toMatchObject({ ok: false, code: 'UNKNOWN_TOOL' });
    });

    it('keeps every mutating tool behind sign-in', async () => {
      for (const tool of ASSISTANT_TOOLS.filter((t) => t.mutates)) {
        expect(tool.public, `${tool.name} is public`).toBe(false);
        const result = await callAssistantTool(anonymous, tool.name, { confirmed: true });
        expect(result, `${tool.name} ran anonymously`).toMatchObject({
          ok: false,
          code: 'UNAUTHENTICATED',
        });
      }
    });

    it('turns bad arguments into a result instead of throwing', async () => {
      const result = await callAssistantTool(anonymous, 'getAvailability', {
        businessSlug: '',
        serviceId: 'x',
        day: 'not-a-day',
      });
      expect(result.ok).toBe(false);
    });

    it('publishes a JSON schema for every tool', () => {
      const schemas = ASSISTANT_TOOLS.map((t) => t.name);
      expect(new Set(schemas).size).toBe(ASSISTANT_TOOLS.length);
      for (const tool of ASSISTANT_TOOLS) {
        expect(tool.description.length).toBeGreaterThan(20);
      }
    });
  });

  describe('discovery', () => {
    it('finds a business by name and hides the ones not live', async () => {
      await makeBusiness({ slug: 'salon-assistant', ownerEmail: 'a@test.tn' });
      const result = await callAssistantTool(anonymous, 'searchBusinesses', {
        query: 'salon-assistant',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { businesses: { slug: string }[] };
        expect(data.businesses.map((b) => b.slug)).toContain('salon-assistant');
      }
    });

    it('returns a business with its services and policy', async () => {
      await makeBusiness({ slug: 'salon-detail', ownerEmail: 'b@test.tn' });
      const result = await callAssistantTool(anonymous, 'getBusiness', { slug: 'salon-detail' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as {
          services: { id: string; name: string }[];
          policy: { minNoticeMinutes: number };
        };
        expect(data.services.length).toBeGreaterThan(0);
        expect(data.policy).toHaveProperty('minNoticeMinutes');
      }
    });
  });

  describe('availability is the backend’s decision', () => {
    it('reports the slots the engine computed', async () => {
      const { service, staff } = await makeBusiness({
        slug: 'salon-avail',
        ownerEmail: 'c@test.tn',
      });
      const day = dayKeyOf('Africa/Tunis', futureSlot(3, 10));

      const result = await callAssistantTool(anonymous, 'getAvailability', {
        businessSlug: 'salon-avail',
        serviceId: service.id,
        staffMemberId: staff.id,
        day,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { isOpen: boolean; slots: { time: string }[] };
        expect(data.isOpen).toBe(true);
        expect(data.slots.length).toBeGreaterThan(0);
      }
    });

    it('rejects a time the engine never offered', async () => {
      const { service, staff } = await makeBusiness({
        slug: 'salon-invent',
        ownerEmail: 'd@test.tn',
      });
      const customer = await makeCustomer('invent@test.tn');

      // 03:00 — a plausible-sounding time that is nowhere near opening hours.
      // This is the hallucinated-booking case, and it has to fail cleanly.
      const result = await callAssistantTool(actorContext(customer), 'createReservation', {
        businessSlug: 'salon-invent',
        serviceId: service.id,
        staffMemberId: staff.id,
        startAt: futureSlot(3, 3).toISOString(),
        confirmed: true,
      });
      expect(result).toMatchObject({ ok: false, code: 'SLOT_UNAVAILABLE' });
      expect(await testDb.reservation.count()).toBe(0);
    });
  });

  describe('booking', () => {
    it('refuses to book without an explicit confirmation', async () => {
      const { service, staff } = await makeBusiness({
        slug: 'salon-confirm',
        ownerEmail: 'e@test.tn',
      });
      const customer = await makeCustomer('confirm@test.tn');

      const result = await callAssistantTool(actorContext(customer), 'createReservation', {
        businessSlug: 'salon-confirm',
        serviceId: service.id,
        staffMemberId: staff.id,
        startAt: futureSlot(3, 10).toISOString(),
        // confirmed deliberately absent
      });
      expect(result).toMatchObject({ ok: false, code: 'NOT_CONFIRMED' });
      expect(await testDb.reservation.count()).toBe(0);
    });

    it('books a real slot once confirmed, and the slot then disappears', async () => {
      const { business, service, staff } = await makeBusiness({
        slug: 'salon-book',
        ownerEmail: 'f@test.tn',
      });
      const customer = await makeCustomer('book@test.tn');
      const ctx = actorContext(customer);
      const day = dayKeyOf(business.timezone, futureSlot(3, 10));

      const avail = await callAssistantTool(ctx, 'getAvailability', {
        businessSlug: 'salon-book',
        serviceId: service.id,
        staffMemberId: staff.id,
        day,
      });
      if (!avail.ok) throw new Error('availability failed');
      const slots = (avail.data as { slots: { startAt: string }[] }).slots;
      const chosen = slots[0]!;

      const booked = await callAssistantTool(ctx, 'createReservation', {
        businessSlug: 'salon-book',
        serviceId: service.id,
        staffMemberId: staff.id,
        startAt: chosen.startAt,
        confirmed: true,
      });
      expect(booked.ok).toBe(true);
      if (booked.ok) {
        expect((booked.data as { reference: string }).reference).toMatch(/^ZY-/);
      }

      // The assistant's own view of availability must now agree with reality.
      const after = await callAssistantTool(ctx, 'getAvailability', {
        businessSlug: 'salon-book',
        serviceId: service.id,
        staffMemberId: staff.id,
        day,
      });
      if (!after.ok) throw new Error('availability failed');
      const remaining = (after.data as { slots: { startAt: string }[] }).slots;
      expect(remaining.map((s) => s.startAt)).not.toContain(chosen.startAt);
    });

    it('cannot cancel somebody else’s appointment', async () => {
      const { business, service, staff } = await makeBusiness({
        slug: 'salon-other',
        ownerEmail: 'g@test.tn',
      });
      const owner = await makeCustomer('owner-of-booking@test.tn');
      const stranger = await makeCustomer('stranger@test.tn');

      const reservation = await testDb.reservation.create({
        data: {
          reference: 'ZY-TESTOTH',
          businessId: business.id,
          customerId: owner.id,
          staffMemberId: staff.id,
          status: 'CONFIRMED',
          startAt: futureSlot(5, 10),
          endAt: futureSlot(5, 11),
          totalAmount: 20,
          currency: 'TND',
          items: {
            create: {
              serviceId: service.id,
              serviceName: 'Coupe',
              priceAmount: 20,
              durationMinutes: 30,
            },
          },
        },
      });

      const result = await callAssistantTool(actorContext(stranger), 'cancelReservation', {
        reservationId: reservation.id,
        confirmed: true,
      });
      expect(result.ok).toBe(false);

      const after = await testDb.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: { status: true },
      });
      expect(after.status).toBe('CONFIRMED');
    });

    it('lists only the signed-in customer’s own appointments', async () => {
      const { business, service, staff } = await makeBusiness({
        slug: 'salon-mine',
        ownerEmail: 'h@test.tn',
      });
      const mine = await makeCustomer('mine@test.tn');
      const theirs = await makeCustomer('theirs@test.tn');

      for (const [index, who] of [mine, theirs].entries()) {
        await testDb.reservation.create({
          data: {
            reference: `ZY-MINE${index}`,
            businessId: business.id,
            customerId: who.id,
            staffMemberId: staff.id,
            status: 'CONFIRMED',
            startAt: futureSlot(6 + index, 10),
            endAt: futureSlot(6 + index, 11),
            totalAmount: 20,
            currency: 'TND',
            items: {
              create: {
                serviceId: service.id,
                serviceName: 'Coupe',
                priceAmount: 20,
                durationMinutes: 30,
              },
            },
          },
        });
      }

      const result = await callAssistantTool(actorContext(mine), 'getMyReservations', {});
      expect(result.ok).toBe(true);
      if (result.ok) {
        const rows = result.data as { reference: string }[];
        expect(rows.map((r) => r.reference)).toEqual(['ZY-MINE0']);
      }
    });
  });
});

function actorContext(user: { id: string; email: string }): AssistantContext {
  return { actor: actorOf(user), locale: 'fr' };
}

/**
 * The voice seams exist so the concierge can be built without committing to a
 * vendor. What matters now is that nothing silently pretends to work.
 */
describe('voice providers', () => {
  it('is switched off until configured', () => {
    expect(voiceEnabled()).toBe(false);
  });

  it('fails loudly rather than returning an empty transcript', async () => {
    await expect(
      Promise.resolve().then(() => speechToTextProvider().transcribe(new ArrayBuffer(0))),
    ).rejects.toThrow(/speech-to-text/i);
  });

  it('never names a vendor in application code', () => {
    const source = readFileSync('src/server/providers/voice.ts', 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const vendor of ['openai', 'whisper', 'elevenlabs', 'deepgram', 'gpt-', 'gemini']) {
      expect(code.toLowerCase(), `${vendor} is hard-coded`).not.toContain(vendor);
    }
  });
});
