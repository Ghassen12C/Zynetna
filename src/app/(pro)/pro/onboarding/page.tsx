import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getActor } from '@/server/auth/session';
import { primaryBusinessId } from '@/server/auth/guard';
import { OnboardingWizard } from '@/components/pro/OnboardingWizard';
import { translate } from '@/i18n/server';
import { localizedName } from '@/i18n/format';
import { LOCALE_META } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dashSetup.onboarding.title, robots: { index: false } };
}

export default async function OnboardingPage() {
  const { m, locale, path } = await translate();
  const actor = await getActor();
  if (!actor) redirect(path(`/login?redirectTo=${encodeURIComponent('/pro/onboarding')}`));

  // Already has a business — onboarding is done.
  const existing = await primaryBusinessId(actor);
  if (existing) redirect(path('/pro/dashboard'));

  const [categories, cities, plan] = await Promise.all([
    db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { position: 'asc' },
      select: { id: true, slug: true, name: true, nameAr: true, nameEn: true, icon: true },
    }),
    db.city.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        nameAr: true,
        governorate: { select: { name: true, nameAr: true } },
      },
    }),
    db.subscriptionPlan.findFirst({ where: { isDefault: true } }),
  ]);

  // Place names carry their own translations; sort in the reader's alphabet.
  const collator = new Intl.Collator(LOCALE_META[locale].intl);
  const cityOptions = cities
    .map((c) => ({
      id: c.id,
      label: `${localizedName(c, locale)} (${localizedName(c.governorate, locale)})`,
    }))
    .sort((a, b) => collator.compare(a.label, b.label));

  return (
    <OnboardingWizard
      m={{ dashSetup: m.dashSetup, common: m.common, labels: m.labels }}
      locale={locale}
      categories={categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: localizedName(c, locale),
        icon: c.icon,
      }))}
      cities={cityOptions}
      trialDays={plan?.trialDays ?? 60}
      price={plan ? Number(plan.priceAmount) : 30}
      currency={plan?.currency ?? 'TND'}
    />
  );
}
