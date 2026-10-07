import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/auth/hash';
import { CATEGORY_TREE, FEATURE_FLAGS, GOVERNORATES, PLANS, PLATFORM_SETTINGS } from './seed-data';

/**
 * Production seed.
 *
 * Adds the reference data a fresh Zynetna needs — Tunisian geography, the
 * category tree, subscription plans, platform settings and feature flags —
 * and the first super-admin account. It never deletes and never creates a
 * business, a customer or a booking: the marketplace starts empty and real.
 *
 * Idempotent: every row is an upsert keyed on its natural key, so running it
 * again after a deploy is harmless. Existing settings, flags and plans are
 * left as an admin may have edited them; only missing ones are added.
 *
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_FIRST_NAME=… npm run db:seed:prod
 */
const db = new PrismaClient();

async function main() {
  console.log('Geography…');
  for (const gov of GOVERNORATES) {
    const governorate = await db.governorate.upsert({
      where: { slug: gov.slug },
      update: { name: gov.name, nameAr: gov.nameAr },
      create: { name: gov.name, nameAr: gov.nameAr, slug: gov.slug },
    });
    for (const city of gov.cities) {
      const data = {
        governorateId: governorate.id,
        name: city.name, nameAr: city.nameAr,
        latitude: city.lat, longitude: city.lng,
      };
      await db.city.upsert({ where: { slug: city.slug }, update: data, create: { ...data, slug: city.slug } });
    }
  }

  console.log('Categories…');
  for (const [index, parent] of CATEGORY_TREE.entries()) {
    const data = {
      name: parent.name, nameAr: parent.nameAr, nameEn: parent.nameEn,
      icon: parent.icon, servedGender: parent.servedGender, position: index,
    };
    const row = await db.category.upsert({
      where: { slug: parent.slug },
      update: data,
      create: { ...data, slug: parent.slug },
    });
    for (const [childIndex, child] of parent.children.entries()) {
      const childData = {
        parentId: row.id, name: child.name, nameAr: child.nameAr, nameEn: child.nameEn,
        servedGender: child.servedGender, position: childIndex,
      };
      await db.category.upsert({
        where: { slug: child.slug },
        update: childData,
        create: { ...childData, slug: child.slug },
      });
    }
  }

  console.log('Plans, settings and flags (missing ones only)…');
  for (const plan of PLANS) {
    await db.subscriptionPlan.upsert({ where: { code: plan.code }, update: {}, create: plan });
  }
  await db.platformSetting.createMany({ data: PLATFORM_SETTINGS, skipDuplicates: true });
  await db.featureFlag.createMany({ data: FEATURE_FLAGS, skipDuplicates: true });

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set: no admin account created.');
    return;
  }
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Never overwrite an existing password from a seed; only make sure the
    // account holds the super-admin role.
    const hasRole = await db.roleAssignment.findFirst({
      where: { userId: existing.id, role: 'SUPER_ADMIN' },
    });
    if (!hasRole) await db.roleAssignment.create({ data: { userId: existing.id, role: 'SUPER_ADMIN' } });
    console.log(`Admin ${email} already exists; password left unchanged.`);
    return;
  }
  await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      firstName: process.env.ADMIN_FIRST_NAME?.trim() || 'Admin',
      lastName: process.env.ADMIN_LAST_NAME?.trim() || 'Zynetna',
      locale: 'fr',
      emailVerified: new Date(),
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  });
  console.log(`Admin ${email} created.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
