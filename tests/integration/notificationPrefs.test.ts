import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ALWAYS_IN_APP,
  getPreferences,
  setPreference,
  typesFor,
} from '@/server/services/notificationPrefs';
import { dispatch } from '@/server/services/notifications';
import { makeBusiness, makeCustomer, resetDatabase, testDb } from '../setup';
import type { Actor } from '@/domain/identity/actor';

function actorOf(user: { id: string; email: string }, businessRoles = {}): Actor {
  return {
    userId: user.id,
    email: user.email,
    firstName: 'Client',
    lastName: 'Test',
    locale: 'fr',
    globalRoles: ['CUSTOMER'],
    businessRoles,
  };
}

/**
 * Notification preferences.
 *
 * Preferences are only real if switching something off actually stops it being
 * delivered, so these go through `dispatch` rather than asserting on rows.
 */
describe('notification preferences', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('is on by default, without storing a row for every type', async () => {
    const user = await makeCustomer('default@test.tn');
    const rows = await getPreferences(actorOf(user));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.inApp && r.email)).toBe(true);
    // Sparse storage: a new notification type is on for everyone with no backfill.
    expect(await testDb.notificationPreference.count()).toBe(0);
  });

  it('stops an email once it is switched off', async () => {
    const user = await makeCustomer('optout@test.tn');
    const actor = actorOf(user);

    await dispatch({
      recipient: { userId: user.id, email: user.email, phone: null },
      type: 'RESERVATION_COMPLETED',
      title: 'Avant',
      body: 'x',
    });
    expect(await testDb.notification.count({ where: { userId: user.id } })).toBe(1);

    // Turn the in-app copy off; the next dispatch must not create one.
    await setPreference({
      actor,
      type: 'RESERVATION_COMPLETED',
      channel: 'IN_APP',
      enabled: false,
    });
    await dispatch({
      recipient: { userId: user.id, email: user.email, phone: null },
      type: 'RESERVATION_COMPLETED',
      title: 'Après',
      body: 'x',
    });
    expect(await testDb.notification.count({ where: { userId: user.id } })).toBe(1);

    // Other types are untouched.
    await dispatch({
      recipient: { userId: user.id, email: user.email, phone: null },
      type: 'RESERVATION_REMINDER',
      title: 'Rappel',
      body: 'x',
    });
    expect(await testDb.notification.count({ where: { userId: user.id } })).toBe(2);
  });

  it('refuses to silence the notices someone must not miss', async () => {
    const user = await makeCustomer('critical@test.tn');
    const actor = actorOf(user);

    for (const type of ALWAYS_IN_APP) {
      const result = await setPreference({ actor, type, channel: 'IN_APP', enabled: false });
      expect(result.changed, `${type} was silenced`).toBe(false);

      // And it still arrives.
      await dispatch({
        recipient: { userId: user.id, email: user.email, phone: null },
        type,
        title: 'Important',
        body: 'x',
      });
    }
    expect(await testDb.notification.count({ where: { userId: user.id } })).toBe(
      ALWAYS_IN_APP.length,
    );

    // Email for the same notice is still the person's to decide.
    const email = await setPreference({
      actor,
      type: ALWAYS_IN_APP[0]!,
      channel: 'EMAIL',
      enabled: false,
    });
    expect(email.changed).toBe(true);
  });

  it('ignores a type the person does not receive', async () => {
    const user = await makeCustomer('scope@test.tn');
    const actor = actorOf(user);

    // A plain customer has no business notifications, so a crafted request to
    // write one is dropped rather than stored.
    const result = await setPreference({
      actor,
      type: 'SUBSCRIPTION_EXPIRED',
      channel: 'EMAIL',
      enabled: false,
    });
    expect(result.changed).toBe(false);
    expect(await testDb.notificationPreference.count()).toBe(0);
  });

  it('offers a business owner the business notifications too', async () => {
    const { business, owner } = await makeBusiness({ slug: 'prefs-a', ownerEmail: 'po@test.tn' });
    const customerTypes = typesFor(actorOf(owner));
    const ownerTypes = typesFor(actorOf(owner, { [business.id]: ['BUSINESS_OWNER'] }));

    expect(ownerTypes.length).toBeGreaterThan(customerTypes.length);
    expect(ownerTypes).toContain('RESERVATION_CREATED');
    expect(customerTypes).not.toContain('RESERVATION_CREATED');
  });

  it('reports back what was actually stored', async () => {
    const user = await makeCustomer('roundtrip@test.tn');
    const actor = actorOf(user);

    await setPreference({ actor, type: 'RESERVATION_REMINDER', channel: 'EMAIL', enabled: false });
    const rows = await getPreferences(actor);
    const reminder = rows.find((r) => r.type === 'RESERVATION_REMINDER');

    expect(reminder).toMatchObject({ inApp: true, email: false });

    // And switching it back on updates the same row rather than adding one.
    await setPreference({ actor, type: 'RESERVATION_REMINDER', channel: 'EMAIL', enabled: true });
    expect(await testDb.notificationPreference.count({ where: { userId: user.id } })).toBe(1);
    const after = await getPreferences(actor);
    expect(after.find((r) => r.type === 'RESERVATION_REMINDER')?.email).toBe(true);
  });
});

/**
 * Notification text is persisted and emailed, so it has to be written in the
 * recipient's language at dispatch time — there is no interface to re-render
 * an email in.
 */
describe('notification language', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('writes the notification in the recipient’s own language', async () => {
    const french = await testDb.user.create({
      data: { email: 'fr@test.tn', passwordHash: 'x', firstName: 'Amine', lastName: 'B', locale: 'fr' },
    });
    const arabic = await testDb.user.create({
      data: { email: 'ar@test.tn', passwordHash: 'x', firstName: 'Khaoula', lastName: 'B', locale: 'ar' },
    });

    for (const user of [french, arabic]) {
      await dispatch({
        recipient: { userId: user.id, email: user.email, phone: null, locale: user.locale },
        type: 'RESERVATION_CONFIRMED',
        render: (m, t) => ({
          title: t(m.notify.confirmedTitle, { business: 'Salon Yasmine' }),
          body: t(m.notify.confirmedBody, { when: 'X', reference: 'ZY-TEST' }),
        }),
      });
    }

    const frRow = await testDb.notification.findFirstOrThrow({ where: { userId: french.id } });
    const arRow = await testDb.notification.findFirstOrThrow({ where: { userId: arabic.id } });

    expect(frRow.title).toContain('Rendez-vous confirmé');
    // Arabic script, and no Latin prose leaking through.
    expect(arRow.title).toContain('تأكيد الموعد');
    expect(arRow.title).not.toMatch(/Rendez|Appointment/);
    expect(arRow.body).toMatch(/[؀-ۿ]/);

    // The placeholders were filled in both.
    for (const row of [frRow, arRow]) {
      expect(row.title).not.toContain('{');
      expect(row.body).not.toContain('{');
      expect(row.body).toContain('ZY-TEST');
    }
  });

  it('falls back to the default language when the locale is unknown', async () => {
    const user = await makeCustomer('nolocale@test.tn');
    await dispatch({
      recipient: { userId: user.id, email: user.email, phone: null, locale: 'xx' },
      type: 'RESERVATION_CONFIRMED',
      render: (m) => ({ title: m.notify.updatedTitle, body: m.notify.updatedBody }),
    });

    const row = await testDb.notification.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.title).toBe('Mise à jour de votre rendez-vous');
  });
});
