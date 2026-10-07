import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BusinessCard } from '@/components/business/BusinessCard';
import { EmptyState } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { getActor } from '@/server/auth/session';
import { favoriteBusinesses } from '@/server/services/account';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.account.favorites, robots: { index: false } };
}

export default async function FavoritesPage() {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account/favorites');

  const [favorites, { m, path }] = await Promise.all([
    favoriteBusinesses(actor),
    translate(),
  ]);

  if (favorites.length === 0) {
    return (
      <EmptyState
        title={m.account.noFavorites}
        body={m.account.noFavoritesBodyLong}
        action={
          <ButtonLink href={path('/search')}>{m.account.exploreBusinesses}</ButtonLink>
        }
      />
    );
  }

  return (
    <div className="z-grid z-grid--3">
      {favorites.map((business) => (
        <BusinessCard key={business.slug} business={business} />
      ))}
    </div>
  );
}
