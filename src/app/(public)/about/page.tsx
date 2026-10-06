import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { ButtonLink } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Primitives';

export const metadata: Metadata = {
  title: 'À propos',
  description:
    'Zynetna connecte les Tunisiens aux coiffeurs, barbiers, instituts et spas de leur quartier — et donne aux professionnels les outils pour gérer leur activité.',
  alternates: { canonical: '/about' },
};

export const revalidate = 3600;

export default async function AboutPage() {
  const [businesses, cities, reservations] = await Promise.all([
    db.business.count({ where: { status: 'ACTIVE' } }),
    db.city.count(),
    db.reservation.count(),
  ]);

  return (
    <>
      <section className="z-hero">
        <div className="z-container z-pitch__hero">
          <Eyebrow>À propos</Eyebrow>
          <h1 className="z-hero__title">
            La beauté tunisienne,
            <br />
            à portée de clic.
          </h1>
          <p className="z-hero__subtitle">
            Zynetna — « notre beauté » — est née d’un constat simple : trouver un bon coiffeur
            en Tunisie se fait au bouche-à-oreille, et réserver se fait au téléphone, entre
            deux clients, quand le salon décroche.
          </p>
        </div>
      </section>

      <section className="z-section">
        <div className="z-container">
          <div className="z-stats">
            <div className="z-stat">
              <span className="z-stat__value">{businesses}</span>
              <span className="z-stat__label">Établissements en ligne</span>
            </div>
            <div className="z-stat">
              <span className="z-stat__value">{cities}</span>
              <span className="z-stat__label">Villes couvertes</span>
            </div>
            <div className="z-stat">
              <span className="z-stat__value">{reservations}</span>
              <span className="z-stat__label">Rendez-vous réservés</span>
            </div>
          </div>
        </div>
      </section>

      <section className="z-section">
        <div className="z-container">
          <div className="z-pitch__row">
            <div>
              <Eyebrow>Pour les clients</Eyebrow>
              <h2 className="z-section__title">Trouver, comparer, réserver</h2>
            </div>
            <div className="z-prose">
              <p>
                Voir les prestations, les prix réels et les disponibilités réelles avant de se
                déplacer. Choisir son professionnel, pas seulement son salon. Réserver à 23 h
                un dimanche pour mardi matin, sans déranger personne.
              </p>
              <p>
                Les avis sont vérifiés : seul un client ayant honoré un rendez-vous peut en
                laisser un. Pas de faux avis, pas de notes achetées.
              </p>
            </div>
          </div>

          <div className="z-pitch__row">
            <div>
              <Eyebrow>Pour les professionnels</Eyebrow>
              <h2 className="z-section__title">Une vitrine, pas un annuaire</h2>
            </div>
            <div className="z-prose">
              <p>
                Beaucoup de salons tunisiens n’ont pas de site, et leur page Instagram ne
                prend pas de rendez-vous. Zynetna donne à chaque établissement une vraie page
                — photos, prestations, équipe, horaires — et un agenda qui se remplit pendant
                qu’il travaille.
              </p>
              <p>
                Sans commission sur les rendez-vous. Deux mois offerts, puis 30 TND par mois,
                sans engagement. Le client reste le client du salon.
              </p>
            </div>
          </div>

          <div className="z-pitch__row">
            <div>
              <Eyebrow>Notre engagement</Eyebrow>
              <h2 className="z-section__title">Un créneau réservé est un créneau tenu</h2>
            </div>
            <div className="z-prose">
              <p>
                Deux clients ne peuvent pas réserver la même chaise à la même heure. Ce n’est
                pas une promesse commerciale : c’est une contrainte au niveau de la base de
                données, qu’aucun bug applicatif ne peut contourner.
              </p>
              <p>
                Les données des clients ne sont pas revendues. Un établissement ne voit que
                ses propres clients, et uniquement ce qui est nécessaire au rendez-vous.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="z-section z-section--sunken">
        <div className="z-container" style={{ textAlign: 'center' }}>
          <h2 className="z-section__title">Rejoignez Zynetna</h2>
          <p className="z-section__lead" style={{ marginInline: 'auto' }}>
            Que vous cherchiez un rendez-vous ou que vous teniez un salon.
          </p>
          <div
            className="z-row"
            style={{ gap: 'var(--z-space-3)', justifyContent: 'center', marginTop: 'var(--z-space-6)', flexWrap: 'wrap' }}
          >
            <ButtonLink href="/search" size="lg">
              Trouver un professionnel
            </ButtonLink>
            <ButtonLink href="/pro" variant="secondary" size="lg">
              Inscrire mon établissement
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
