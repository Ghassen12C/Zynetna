import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getActor } from '@/server/auth/session';
import { primaryBusinessId } from '@/server/auth/guard';
import { OnboardingWizard } from '@/components/pro/OnboardingWizard';

export const metadata: Metadata = { title: 'Créer mon établissement', robots: { index: false } };

export default async function OnboardingPage() {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/pro/onboarding');

  // Already has a business — onboarding is done.
  const existing = await primaryBusinessId(actor);
  if (existing) redirect('/pro/dashboard');

  const [categories, cities, plan] = await Promise.all([
    db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, icon: true },
    }),
    db.city.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, governorate: { select: { name: true } } },
    }),
    db.subscriptionPlan.findFirst({ where: { isDefault: true } }),
  ]);

  return (
    <OnboardingWizard
      categories={categories}
      cities={cities.map((c) => ({ id: c.id, label: `${c.name} (${c.governorate.name})` }))}
      trialDays={plan?.trialDays ?? 60}
      price={plan ? Number(plan.priceAmount) : 30}
      currency={plan?.currency ?? 'TND'}
    />
  );
}
