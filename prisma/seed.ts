import { PrismaClient, type Prisma } from '@prisma/client';
import { hashPassword } from '../src/server/auth/hash';
import { generateReference } from '../src/domain/booking/reference';
import { CATEGORY_TREE, FEATURE_FLAGS, GOVERNORATES, PLANS, PLATFORM_SETTINGS } from './seed-data';

/**
 * Development seed.
 *
 * Fictional businesses and people in real Tunisian cities. Reservations are
 * created through the same constraints production uses, so the seeded data is
 * guaranteed conflict-free rather than merely plausible.
 */
// This seed starts by deleting every table. It must never reach a shared or
// production database, so it refuses anything that is not on this machine.
// Production uses prisma/seed-production.ts, which only adds reference data.
const databaseHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname;
  } catch {
    return '';
  }
})();
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1', 'db'].includes(databaseHost)) {
  console.error(
    `Refusing to run the development seed against "${databaseHost || 'an unknown host'}": it deletes all data. ` +
      'Use `npm run db:seed:prod` for a production database.',
  );
  process.exit(1);
}

const db = new PrismaClient();

const PASSWORD = 'Zynetna2026!';

/** Deterministic pseudo-random so a reseed is reproducible. */
let seedState = 42;
function rand(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

type BusinessBlueprint = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  citySlug: string;
  categorySlug: string;
  servedGender: 'WOMEN' | 'MEN' | 'EVERYONE';
  verified: boolean;
  address: string;
  staff: string[];
  services: { name: string; price: number; minutes: number; buffer?: number; category: string }[];
  /** Fixed-price bundles of the services above (weddings, events…). */
  packs?: { name: string; price: number; minutes: number; includes: string[]; description: string }[];
};

const BUSINESSES: BusinessBlueprint[] = [
  {
    slug: 'barber-el-medina-tunis', name: 'Barber El Medina',
    tagline: 'Coupe nette, barbe soignée, café offert.',
    description:
      'Au cœur de la médina de Tunis, Barber El Medina perpétue le rasage traditionnel au coupe-chou tout en maîtrisant les dégradés les plus actuels. Trois fauteuils, une playlist et un café à l’arrivée.',
    citySlug: 'tunis', categorySlug: 'barbier', servedGender: 'MEN', verified: true,
    address: '14 rue Sidi Ben Arous, Médina',
    staff: ['Ahmed Trabelsi', 'Mohamed Gharbi', 'Yassine Khelifi'],
    services: [
      { name: 'Coupe homme', price: 15, minutes: 30, category: 'coupe-homme' },
      { name: 'Barbe', price: 8, minutes: 15, category: 'barbe' },
      { name: 'Coupe + Barbe', price: 20, minutes: 45, category: 'coupe-homme' },
      { name: 'Rasage traditionnel', price: 12, minutes: 30, buffer: 10, category: 'rasage' },
    ],
    packs: [
      {
        name: 'Pack Marié', price: 30, minutes: 75,
        includes: ['Coupe homme', 'Barbe', 'Rasage traditionnel'],
        description: 'Le jour J : coupe, barbe taillée et rasage au coupe-chou, serviette chaude comprise.',
      },
    ],
  },
  {
    slug: 'salon-yasmine-la-marsa', name: 'Salon Yasmine',
    tagline: 'Couleur, soin et brushing face à la mer.',
    description:
      'Un salon lumineux à deux pas de la plage de La Marsa. Spécialistes de la coloration végétale et du soin profond pour cheveux fragilisés par le sel et le soleil.',
    citySlug: 'la-marsa', categorySlug: 'coiffure-femme', servedGender: 'WOMEN', verified: true,
    address: '27 avenue Habib Bourguiba',
    staff: ['Sarah Ben Amor', 'Amel Jlassi', 'Ines Mabrouk'],
    services: [
      { name: 'Brushing', price: 20, minutes: 45, category: 'brushing' },
      { name: 'Coupe femme', price: 35, minutes: 60, category: 'coupe-femme' },
      { name: 'Coloration', price: 90, minutes: 120, buffer: 15, category: 'coloration' },
      { name: 'Soin profond', price: 45, minutes: 45, category: 'soin-cheveux' },
    ],
    packs: [
      {
        name: 'Pack Mariée', price: 140, minutes: 210,
        includes: ['Soin profond', 'Coloration', 'Brushing'],
        description: 'Préparation complète avant le mariage. Un essai peut être convenu ensemble à la confirmation.',
      },
    ],
  },
  {
    slug: 'nails-studio-ariana', name: 'Nails Studio',
    tagline: 'Des ongles impeccables, sans rendez-vous interminable.',
    description:
      'Studio dédié à la beauté des mains et des pieds à Ariana. Gel, semi-permanent, nail art sur mesure et hygiène irréprochable — stérilisation à chaque passage.',
    citySlug: 'ariana', categorySlug: 'ongles', servedGender: 'WOMEN', verified: false,
    address: '8 rue de l’Indépendance',
    staff: ['Rania Chaabane', 'Nour Belhadj'],
    services: [
      { name: 'Manucure simple', price: 25, minutes: 40, category: 'manucure' },
      { name: 'Pose gel', price: 55, minutes: 75, category: 'manucure' },
      { name: 'Pédicure', price: 30, minutes: 45, category: 'pedicure' },
      { name: 'Nail art', price: 15, minutes: 25, category: 'manucure' },
    ],
  },
  {
    slug: 'hammam-el-andalous-sousse', name: 'Hammam El Andalous',
    tagline: 'Le hammam traditionnel, revisité.',
    description:
      'Gommage au savon noir, rhassoul, massage à l’huile d’argan. Un hammam centenaire de Sousse restauré avec ses zelliges d’origine, ouvert aux hommes et aux femmes sur créneaux séparés.',
    citySlug: 'sousse', categorySlug: 'bien-etre', servedGender: 'EVERYONE', verified: true,
    address: '3 rue El Aghalba, Médina de Sousse',
    staff: ['Leila Mansouri', 'Karim Bouazizi'],
    services: [
      { name: 'Hammam + gommage', price: 40, minutes: 60, buffer: 15, category: 'hammam' },
      { name: 'Massage relaxant', price: 70, minutes: 60, buffer: 15, category: 'massage' },
      { name: 'Massage profond', price: 90, minutes: 60, buffer: 15, category: 'massage' },
      { name: 'Rituel complet', price: 140, minutes: 120, buffer: 20, category: 'spa' },
    ],
  },
  {
    slug: 'atelier-beaute-sfax', name: 'Atelier Beauté',
    tagline: 'Maquillage mariée et soins du visage.',
    description:
      'Institut de beauté à Sfax spécialisé dans le maquillage de mariée et les soins du visage sur mesure. Essai maquillage offert pour toute réservation de mariage.',
    citySlug: 'sfax', categorySlug: 'esthetique', servedGender: 'WOMEN', verified: true,
    address: '52 avenue Hedi Chaker',
    staff: ['Mouna Kacem', 'Fatma Sellami', 'Hiba Zouari'],
    services: [
      { name: 'Maquillage jour', price: 50, minutes: 45, category: 'maquillage' },
      { name: 'Maquillage mariée', price: 250, minutes: 150, buffer: 30, category: 'maquillage' },
      { name: 'Extension de cils', price: 80, minutes: 90, category: 'cils' },
      { name: 'Restructuration sourcils', price: 20, minutes: 20, category: 'sourcils' },
      { name: 'Soin du visage', price: 65, minutes: 60, category: 'soin-visage' },
    ],
  },
  {
    slug: 'le-salon-hammamet', name: 'Le Salon Hammamet',
    tagline: 'Hommes et femmes, deux étages, une adresse.',
    description:
      'Salon mixte sur deux niveaux à Hammamet : barbier au rez-de-chaussée, coiffure et esthétique à l’étage. Ouvert sept jours sur sept en saison.',
    citySlug: 'hammamet', categorySlug: 'coiffure-femme', servedGender: 'EVERYONE', verified: false,
    address: '19 avenue des Nations Unies',
    staff: ['Sonia Hamdi', 'Walid Jebali', 'Emna Riahi'],
    services: [
      { name: 'Coupe femme', price: 30, minutes: 50, category: 'coupe-femme' },
      { name: 'Coupe homme', price: 15, minutes: 30, category: 'coupe-homme' },
      { name: 'Brushing', price: 18, minutes: 40, category: 'brushing' },
      { name: 'Manucure', price: 22, minutes: 35, category: 'manucure' },
    ],
  },
  {
    slug: 'spa-djerba-essence', name: 'Djerba Essence Spa',
    tagline: 'Thalasso et bien-être au bord de la lagune.',
    description:
      'Espace bien-être à Houmt Souk : massages aux huiles essentielles de l’île, enveloppements à l’argile et parcours de relaxation. Linge et peignoir fournis.',
    citySlug: 'djerba', categorySlug: 'bien-etre', servedGender: 'EVERYONE', verified: true,
    address: 'Route touristique, Houmt Souk',
    staff: ['Najla Ben Salah', 'Tarek Mejri'],
    services: [
      { name: 'Massage aux huiles', price: 85, minutes: 60, buffer: 15, category: 'massage' },
      { name: 'Enveloppement argile', price: 70, minutes: 45, buffer: 15, category: 'spa' },
      { name: 'Parcours spa', price: 120, minutes: 90, buffer: 20, category: 'spa' },
    ],
  },
  {
    slug: 'coiffure-monastir-rivage', name: 'Rivage Coiffure',
    tagline: 'Le brushing qui tient jusqu’au soir.',
    description:
      'Salon familial de Monastir, ouvert depuis 1998. Trois générations de coiffeuses, une clientèle fidèle et des tarifs qui n’ont pas suivi la mode.',
    citySlug: 'monastir', categorySlug: 'coiffure-femme', servedGender: 'WOMEN', verified: false,
    address: '11 rue de la République',
    staff: ['Dalila Oueslati', 'Syrine Toumi'],
    services: [
      { name: 'Brushing', price: 16, minutes: 40, category: 'brushing' },
      { name: 'Coupe + brushing', price: 32, minutes: 70, category: 'coupe-femme' },
      { name: 'Coloration racines', price: 55, minutes: 90, buffer: 15, category: 'coloration' },
    ],
  },
  {
    slug: 'gentlemen-bizerte', name: 'Gentlemen Bizerte',
    tagline: 'Barbier de quartier, exigence de salon.',
    description:
      'Deux fauteuils, pas de musique forte, et un dégradé net. Gentlemen Bizerte travaille sans rendez-vous le matin et sur réservation l’après-midi.',
    citySlug: 'bizerte', categorySlug: 'barbier', servedGender: 'MEN', verified: false,
    address: '6 rue Thaalbi',
    staff: ['Hatem Zouaoui', 'Bilel Ferchichi'],
    services: [
      { name: 'Coupe homme', price: 13, minutes: 30, category: 'coupe-homme' },
      { name: 'Coupe enfant', price: 9, minutes: 25, category: 'coupe-homme' },
      { name: 'Barbe + contours', price: 10, minutes: 20, category: 'barbe' },
    ],
  },
  {
    slug: 'studio-cils-nabeul', name: 'Studio Cils & Sourcils',
    tagline: 'Le regard, c’est tout.',
    description:
      'Spécialiste de l’extension de cils et du restructuring de sourcils à Nabeul. Technique cil à cil, volume russe, et teinture végétale.',
    citySlug: 'nabeul', categorySlug: 'esthetique', servedGender: 'WOMEN', verified: false,
    address: '24 avenue Habib Thameur',
    staff: ['Asma Gharbi'],
    services: [
      { name: 'Extension cil à cil', price: 75, minutes: 90, category: 'cils' },
      { name: 'Volume russe', price: 110, minutes: 120, buffer: 15, category: 'cils' },
      { name: 'Sourcils + teinture', price: 28, minutes: 30, category: 'sourcils' },
    ],
  },
];

const CUSTOMERS = [
  ['Mariem', 'Bouzid'], ['Youssef', 'Dridi'], ['Khaoula', 'Slimani'],
  ['Anis', 'Hammami'], ['Salma', 'Chebbi'], ['Oussama', 'Nasri'],
  ['Hajer', 'Ayari'], ['Firas', 'Guesmi'], ['Chaima', 'Rekik'], ['Zied', 'Lahmar'],
];

const REVIEW_TEXTS = [
  'Accueil impeccable et résultat au top. Je reviens sans hésiter.',
  'Très professionnel, ponctuel, et le prix annoncé est le prix payé.',
  'Salon propre, équipe sympathique. Un peu d’attente mais ça valait le coup.',
  'Exactement ce que je voulais. Merci pour les conseils d’entretien.',
  'Bonne prestation dans l’ensemble, je recommande.',
  'Le meilleur de la ville, sans exagérer. Réservation en ligne très pratique.',
  'Correct, mais j’aurais aimé un peu plus de finition sur les contours.',
];

async function main() {
  console.log('Resetting…');
  // Order matters: children before parents.
  await db.$transaction([
    db.scheduledNotification.deleteMany(), db.notification.deleteMany(),
    db.notificationPreference.deleteMany(), db.reviewMedia.deleteMany(),
    db.reviewResponse.deleteMany(), db.contentReport.deleteMany(),
    db.review.deleteMany(), db.reservationEvent.deleteMany(),
    db.reservationItem.deleteMany(), db.reservation.deleteMany(),
    db.favorite.deleteMany(), db.staffService.deleteMany(),
    db.staffHours.deleteMany(), db.scheduleException.deleteMany(),
    db.staffMember.deleteMany(), db.serviceMedia.deleteMany(),
    db.service.deleteMany(), db.businessHours.deleteMany(),
    db.businessMedia.deleteMany(), db.businessCategory.deleteMany(),
    db.businessLocation.deleteMany(), db.payment.deleteMany(),
    db.subscriptionEvent.deleteMany(), db.subscription.deleteMany(),
    db.roleAssignment.deleteMany(), db.business.deleteMany(),
    db.subscriptionPlan.deleteMany(), db.mediaAsset.deleteMany(),
    db.session.deleteMany(), db.passwordResetToken.deleteMany(),
    db.verificationToken.deleteMany(), db.auditLog.deleteMany(),
    db.user.deleteMany(), db.category.deleteMany(),
    db.city.deleteMany(), db.governorate.deleteMany(),
    db.platformSetting.deleteMany(), db.featureFlag.deleteMany(),
    db.rateLimitBucket.deleteMany(),
  ]);

  const passwordHash = await hashPassword(PASSWORD);

  // ── Geography ───────────────────────────────────────────────────────────
  console.log('Seeding geography…');
  const cityBySlug = new Map<string, string>();
  for (const gov of GOVERNORATES) {
    const governorate = await db.governorate.create({
      data: { name: gov.name, nameAr: gov.nameAr, slug: gov.slug },
    });
    for (const city of gov.cities) {
      const row = await db.city.create({
        data: {
          governorateId: governorate.id,
          name: city.name, nameAr: city.nameAr, slug: city.slug,
          latitude: city.lat, longitude: city.lng,
        },
      });
      cityBySlug.set(city.slug, row.id);
    }
  }

  // ── Categories ──────────────────────────────────────────────────────────
  console.log('Seeding categories…');
  const categoryBySlug = new Map<string, string>();
  for (const [index, parent] of CATEGORY_TREE.entries()) {
    const row = await db.category.create({
      data: {
        slug: parent.slug, name: parent.name, nameAr: parent.nameAr,
        nameEn: parent.nameEn, icon: parent.icon,
        servedGender: parent.servedGender, position: index,
      },
    });
    categoryBySlug.set(parent.slug, row.id);
    for (const [childIndex, child] of parent.children.entries()) {
      const childRow = await db.category.create({
        data: {
          parentId: row.id, slug: child.slug, name: child.name,
          nameAr: child.nameAr, nameEn: child.nameEn,
          servedGender: child.servedGender, position: childIndex,
        },
      });
      categoryBySlug.set(child.slug, childRow.id);
    }
  }

  // ── Plans, settings and flags — shared with the production seed ────────
  console.log('Seeding subscription plans…');
  for (const plan of PLANS) await db.subscriptionPlan.create({ data: plan });
  const proPlan = await db.subscriptionPlan.findUniqueOrThrow({ where: { code: 'pro-monthly' } });
  await db.platformSetting.createMany({ data: PLATFORM_SETTINGS });
  await db.featureFlag.createMany({ data: FEATURE_FLAGS });

  // ── Users ───────────────────────────────────────────────────────────────
  console.log('Seeding users…');
  const admin = await db.user.create({
    data: {
      email: 'admin@zynetna.tn', passwordHash, firstName: 'Ghassen', lastName: 'Admin',
      phone: '+21620000001', locale: 'fr', emailVerified: new Date(),
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  });

  const customers = [];
  for (const [index, [first, last]] of CUSTOMERS.entries()) {
    // Spread signups across the past six months so growth charts are not a
    // single spike on seed day.
    const joinedAt = new Date(Date.now() - int(3, 180) * 86_400_000);
    customers.push(
      await db.user.create({
        data: {
          email: `${first!.toLowerCase()}.${last!.toLowerCase()}@example.tn`,
          passwordHash, firstName: first!, lastName: last!,
          phone: `+2169${String(1000000 + index * 37).slice(0, 7)}`,
          locale: index % 4 === 0 ? 'ar' : 'fr', emailVerified: joinedAt,
          createdAt: joinedAt,
          lastLoginAt: new Date(joinedAt.getTime() + int(0, 60) * 86_400_000),
          roles: { create: { role: 'CUSTOMER' } },
        },
      }),
    );
  }

  // ── Businesses ──────────────────────────────────────────────────────────
  console.log('Seeding businesses…');
  const createdBusinesses: { id: string; serviceIds: string[]; staffIds: string[]; tz: string }[] = [];

  for (const [index, blueprint] of BUSINESSES.entries()) {
    const owner = await db.user.create({
      data: {
        email: `owner${index + 1}@zynetna.tn`, passwordHash,
        firstName: blueprint.staff[0]!.split(' ')[0]!,
        lastName: blueprint.staff[0]!.split(' ')[1] ?? 'Propriétaire',
        phone: `+2165${String(2000000 + index * 53).slice(0, 7)}`,
        locale: 'fr', emailVerified: new Date(),
      },
    });

    const cityId = cityBySlug.get(blueprint.citySlug)!;
    const city = await db.city.findUniqueOrThrow({ where: { id: cityId } });

    const business = await db.business.create({
      data: {
        ownerId: owner.id, slug: blueprint.slug, name: blueprint.name,
        tagline: blueprint.tagline, description: blueprint.description,
        status: 'ACTIVE',
        verification: blueprint.verified ? 'VERIFIED' : 'UNVERIFIED',
        servedGender: blueprint.servedGender,
        phone: `+2167${String(3000000 + index * 71).slice(0, 7)}`,
        whatsapp: `+2167${String(3000000 + index * 71).slice(0, 7)}`,
        email: `contact@${blueprint.slug}.tn`,
        instagram: blueprint.slug.replace(/-/g, ''),
        autoConfirm: index % 3 !== 0,
        slotGranularityMinutes: 15,
        minNoticeMinutes: 120,
        maxAdvanceDays: 60,
        cancellationWindowHours: 12,
        cancellationPolicy:
          'Annulation gratuite jusqu’à 12 h avant le rendez-vous. Au-delà, merci de contacter directement l’établissement.',
        noShowPolicy:
          'Trois absences non annulées peuvent entraîner une restriction de réservation en ligne.',
        publishedAt: new Date(Date.now() - int(10, 180) * 86_400_000),
        location: {
          create: {
            cityId, addressLine1: blueprint.address,
            // Scatter pins realistically around the city centre.
            latitude: city.latitude + (rand() - 0.5) * 0.04,
            longitude: city.longitude + (rand() - 0.5) * 0.04,
            geocodedLat: city.latitude, geocodedLng: city.longitude,
          },
        },
        categories: {
          create: [{ categoryId: categoryBySlug.get(blueprint.categorySlug)!, isPrimary: true }],
        },
        roleGrants: { create: { userId: owner.id, role: 'BUSINESS_OWNER' } },
      },
    });

    // Trial for some, paid for others, one expired — so every subscription
    // state is represented in the admin dashboard.
    const now = new Date();
    if (index === 0) {
      const start = new Date(now.getTime() - 20 * 86_400_000);
      await db.subscription.create({
        data: {
          businessId: business.id, planId: proPlan.id, status: 'ACTIVE',
          trialStartAt: new Date(now.getTime() - 80 * 86_400_000),
          trialEndAt: new Date(now.getTime() - 20 * 86_400_000),
          currentStartAt: start,
          currentEndAt: new Date(start.getTime() + 30 * 86_400_000),
          graceEndAt: new Date(start.getTime() + 37 * 86_400_000),
          events: { create: { toStatus: 'ACTIVE', reason: 'Paiement enregistré' } },
          payments: {
            create: {
              amount: 30, currency: 'TND', status: 'SUCCEEDED', provider: 'manual',
              periodStart: start, periodEnd: new Date(start.getTime() + 30 * 86_400_000),
              paidAt: start,
            },
          },
        },
      });
    } else if (index === BUSINESSES.length - 1) {
      await db.subscription.create({
        data: {
          businessId: business.id, planId: proPlan.id, status: 'EXPIRED',
          trialStartAt: new Date(now.getTime() - 120 * 86_400_000),
          trialEndAt: new Date(now.getTime() - 60 * 86_400_000),
          graceEndAt: new Date(now.getTime() - 53 * 86_400_000),
          events: { create: { toStatus: 'EXPIRED', reason: 'Essai expiré sans paiement' } },
        },
      });
    } else {
      const trialStart = new Date(now.getTime() - int(1, 50) * 86_400_000);
      await db.subscription.create({
        data: {
          businessId: business.id, planId: proPlan.id, status: 'TRIALING',
          trialStartAt: trialStart,
          trialEndAt: new Date(trialStart.getTime() + 60 * 86_400_000),
          graceEndAt: new Date(trialStart.getTime() + 67 * 86_400_000),
          events: { create: { toStatus: 'TRIALING', reason: 'Essai de 2 mois' } },
        },
      });
    }

    // Opening hours: Mon–Sat with a lunch break, closed Sunday.
    const hours: Prisma.BusinessHoursCreateManyInput[] = [];
    for (let weekday = 1; weekday <= 6; weekday += 1) {
      hours.push({ businessId: business.id, weekday, startMin: 9 * 60, endMin: 13 * 60 });
      hours.push({ businessId: business.id, weekday, startMin: 14 * 60, endMin: 19 * 60 });
    }
    await db.businessHours.createMany({ data: hours });

    // Services
    const serviceIds: string[] = [];
    for (const [sIndex, service] of blueprint.services.entries()) {
      const row = await db.service.create({
        data: {
          businessId: business.id,
          categoryId: categoryBySlug.get(service.category) ?? null,
          name: service.name,
          description: `${service.name} — prestation réalisée par un professionnel de ${blueprint.name}.`,
          priceAmount: service.price, durationMinutes: service.minutes,
          bufferMinutes: service.buffer ?? 0, position: sIndex,
        },
      });
      serviceIds.push(row.id);
    }

    // Packs bundle the services above at a fixed price; they open a year
    // ahead and the business confirms each request itself.
    for (const [pIndex, pack] of (blueprint.packs ?? []).entries()) {
      const row = await db.service.create({
        data: {
          businessId: business.id,
          name: pack.name,
          description: pack.description,
          priceAmount: pack.price, durationMinutes: pack.minutes,
          position: blueprint.services.length + pIndex,
          isPackage: true, requiresConfirmation: true, maxAdvanceDays: 365,
          packageItems: {
            create: pack.includes.map((name, position) => ({
              serviceId: serviceIds[blueprint.services.findIndex((s) => s.name === name)]!,
              position,
            })),
          },
        },
      });
      serviceIds.push(row.id);
    }

    // Staff, each performing a realistic subset of services.
    const staffIds: string[] = [];
    for (const [stIndex, name] of blueprint.staff.entries()) {
      const member = await db.staffMember.create({
        data: {
          businessId: business.id, displayName: name,
          title: stIndex === 0 ? 'Responsable' : 'Professionnel·le',
          bio: `${name.split(' ')[0]} travaille chez ${blueprint.name} et accueille ses clients avec le sourire.`,
          specialties: blueprint.services.slice(0, 2).map((s) => s.name),
          position: stIndex,
        },
      });
      staffIds.push(member.id);

      // The lead performs everything; others a subset — which is exactly the
      // professional↔service relationship the booking engine must honour.
      const assigned =
        stIndex === 0
          ? serviceIds
          : serviceIds.filter((_, i) => (i + stIndex) % 2 === 0 || i === 0);
      await db.staffService.createMany({
        data: assigned.map((serviceId) => ({ staffMemberId: member.id, serviceId })),
      });
    }

    createdBusinesses.push({ id: business.id, serviceIds, staffIds, tz: business.timezone });
  }

  // ── A business awaiting approval, so the admin queue is not empty ───────
  const pendingOwner = await db.user.create({
    data: {
      email: 'owner-pending@zynetna.tn', passwordHash,
      firstName: 'Nizar', lastName: 'Messaoudi', locale: 'fr',
    },
  });
  const pendingBusiness = await db.business.create({
    data: {
      ownerId: pendingOwner.id, slug: 'coiffure-centre-ville-gabes',
      name: 'Coiffure Centre-Ville',
      tagline: 'Nouveau salon au centre de Gabès.',
      description: 'Salon mixte récemment ouvert, en attente de validation.',
      status: 'PENDING_REVIEW', verification: 'PENDING',
      roleGrants: { create: { userId: pendingOwner.id, role: 'BUSINESS_OWNER' } },
    },
  });
  await db.subscription.create({
    data: {
      businessId: pendingBusiness.id, planId: proPlan.id, status: 'TRIALING',
      trialStartAt: new Date(), trialEndAt: new Date(Date.now() + 60 * 86_400_000),
      graceEndAt: new Date(Date.now() + 67 * 86_400_000),
    },
  });

  // ── Reservations ────────────────────────────────────────────────────────
  // Built against the real exclusion constraint: a clash is skipped rather
  // than forced, so the seeded calendar is genuinely conflict-free.
  console.log('Seeding reservations…');
  let created = 0;
  let skipped = 0;

  for (const business of createdBusinesses) {
    const services = await db.service.findMany({
      where: { businessId: business.id, isPackage: false },
      select: { id: true, name: true, priceAmount: true, durationMinutes: true },
    });

    for (let dayOffset = -45; dayOffset <= 21; dayOffset += 1) {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() + dayOffset);
      if (date.getUTCDay() === 0) continue; // closed Sunday

      for (let n = 0; n < int(0, 4); n += 1) {
        const service = pick(services);
        const staffLink = await db.staffService.findFirst({
          where: { serviceId: service.id },
          select: { staffMemberId: true },
        });
        if (!staffLink) continue;

        // Business hours are 09:00–13:00 and 14:00–19:00 local (UTC+1).
        const slotMinutes = pick([
          9 * 60, 9 * 60 + 30, 10 * 60, 10 * 60 + 30, 11 * 60, 11 * 60 + 30,
          14 * 60, 14 * 60 + 30, 15 * 60, 15 * 60 + 30, 16 * 60, 17 * 60,
        ]);
        const startAt = new Date(date.getTime() + (slotMinutes - 60) * 60_000);
        const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);

        const past = dayOffset < 0;
        const status = past
          ? pick(['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED_BY_CUSTOMER', 'NO_SHOW'] as const)
          : pick(['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'PENDING'] as const);

        const customer = pick(customers);

        try {
          const reservation = await db.reservation.create({
            data: {
              reference: generateReference(),
              businessId: business.id,
              customerId: customer.id,
              staffMemberId: staffLink.staffMemberId,
              status, startAt, endAt,
              totalAmount: service.priceAmount, currency: 'TND',
              confirmedAt: status !== 'PENDING' ? startAt : null,
              completedAt: status === 'COMPLETED' ? endAt : null,
              cancelledAt: status.startsWith('CANCELLED') ? new Date(startAt.getTime() - 86_400_000) : null,
              // Customers book days in advance, not at the moment of the
              // appointment — the booking-trend charts depend on this.
              createdAt: new Date(startAt.getTime() - int(1, 14) * 86_400_000),
              items: {
                create: {
                  serviceId: service.id, serviceName: service.name,
                  priceAmount: service.priceAmount, durationMinutes: service.durationMinutes,
                },
              },
              events: { create: { toStatus: status, reason: 'Seed' } },
            },
          });
          created += 1;

          // Reviews only on completed appointments — the same rule the
          // application enforces.
          if (status === 'COMPLETED' && rand() > 0.45) {
            const rating = rand() > 0.22 ? int(4, 5) : int(2, 3);
            await db.review.create({
              data: {
                businessId: business.id, customerId: customer.id,
                reservationId: reservation.id, rating,
                comment: pick(REVIEW_TEXTS),
                createdAt: new Date(endAt.getTime() + int(1, 72) * 3_600_000),
              },
            });
          }
        } catch {
          // Overlapping slot — rejected by the exclusion constraint, as intended.
          skipped += 1;
        }
      }
    }
  }

  // ── Denormalised ratings, computed from the reviews actually written ────
  console.log('Computing ratings…');
  for (const business of createdBusinesses) {
    const stats = await db.review.aggregate({
      where: { businessId: business.id, status: 'PUBLISHED' },
      _avg: { rating: true }, _count: { rating: true },
    });
    await db.business.update({
      where: { id: business.id },
      data: {
        ratingAverage: Math.round((stats._avg.rating ?? 0) * 10) / 10,
        ratingCount: stats._count.rating,
      },
    });
  }

  // ── Favourites ──────────────────────────────────────────────────────────
  for (const customer of customers.slice(0, 6)) {
    const picks = createdBusinesses.slice(0, int(1, 4));
    await db.favorite.createMany({
      data: picks.map((b) => ({ userId: customer.id, businessId: b.id })),
      skipDuplicates: true,
    });
  }

  const counts = {
    users: await db.user.count(),
    businesses: await db.business.count(),
    services: await db.service.count(),
    staff: await db.staffMember.count(),
    reservations: created,
    conflictsRejected: skipped,
    reviews: await db.review.count(),
  };

  console.log('\nSeed complete');
  console.table(counts);
  console.log(`\nSign in with any of these (password: ${PASSWORD})`);
  console.log(`  super admin   ${admin.email}`);
  console.log('  professional  owner1@zynetna.tn … owner10@zynetna.tn');
  console.log(`  customer      ${customers[0]!.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
