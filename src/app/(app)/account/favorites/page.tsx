import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BusinessCard } from '@/components/business/BusinessCard';
import { EmptyState } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { getActor } from '@/server/auth/session';
import { favoriteBusinesses } from '@/server/services/account';

export const metadata: Metadata = { title: 'Favoris', robots: { index: false } };

export default async function FavoritesPage() {
  const actor = await getActor();
  if (!actor) redirect('/login?redirectTo=/account/favorites');

  const favorites = await favoriteBusinesses(actor);

  if (favorites.length === 0) {
    return (
      <EmptyState
        title="Aucun favori"
        body="Enregistrez vos établissements préférés pour les retrouver et réserver plus vite."
        action={<ButtonLink href="/search">Explorer les établissements</ButtonLink>}
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
