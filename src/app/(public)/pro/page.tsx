import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, Eyebrow } from '@/components/ui/Primitives';
import { db } from '@/lib/db';
import { formatPrice } from '@/i18n/format';

export const metadata: Metadata = {
  title: 'Pour les professionnels',
  description:
    'Mettez votre salon, barbershop ou institut en ligne sur Zynetna. Réservation en ligne, gestion d’équipe, statistiques. Deux mois offerts, puis 30 TND par mois.',
  alternates: { canonical: '/pro' },
};

export const revalidate = 3600;

const PILLARS = [
  {
    title: 'Votre vitrine digitale',
    body: 'Une page complète comme un mini-site : photos, prestations, équipe, horaires, avis. Partageable sur Instagram, WhatsApp ou avec un QR code.',
    points: ['Photos de la devanture, de l’intérieur et de vos réalisations', 'Catalogue avec prix et durées', 'Profils de votre équipe', 'Lien et QR code à partager'],
  },
  {
    title: 'Des réservations 24 h/24',
    body: 'Vos clients réservent quand ils y pensent — le soir, le dimanche, pendant que vous travaillez. Plus d’appels manqués.',
    points: ['Disponibilités calculées automatiquement', 'Aucun double rendez-vous possible', 'Rappels envoyés avant chaque RDV', 'Annulation et report encadrés par vos règles'],
  },
  {
    title: 'Votre établissement, piloté',
    body: 'Agenda, fiche client, chiffre d’affaires, prestations qui marchent. Tout ce qu’il faut pour décider, sans tableur.',
    points: ['Agenda jour et semaine', 'Historique et fidélité de vos clients', 'Chiffre d’affaires et évolution', 'Taux d’annulation et d’absence'],
  },
];

const FAQ = [
  {
    q: 'Combien ça coûte ?',
    a: 'Les deux premiers mois sont offerts. Ensuite, 30 TND par mois, sans engagement — vous arrêtez quand vous voulez.',
  },
  {
    q: 'Faut-il être à l’aise avec l’informatique ?',
    a: 'Non. Si vous savez utiliser WhatsApp, vous saurez utiliser Zynetna. La création de votre page prend trois questions.',
  },
  {
    q: 'Et si deux clients réservent le même créneau ?',
    a: 'C’est impossible. Le créneau est verrouillé à la première réservation confirmée ; le second client voit immédiatement les horaires restants.',
  },
  {
    q: 'Est-ce que je garde mes clients ?',
    a: 'Oui. Vos clients sont vos clients. Vous voyez leur historique, vous les contactez directement.',
  },
  {
    q: 'Puis-je garder mes réservations par téléphone ?',
    a: 'Bien sûr. Zynetna s’ajoute à votre fonctionnement actuel, il ne le remplace pas.',
  },
];

export default async function ProPitchPage() {
  const [plan, businessCount] = await Promise.all([
    db.subscriptionPlan.findFirst({ where: { isDefault: true } }),
    db.business.count({ where: { status: 'ACTIVE' } }),
  ]);

  const price = plan ? formatPrice(Number(plan.priceAmount), 'fr', plan.currency) : '30 DT';
  const trialMonths = Math.round((plan?.trialDays ?? 60) / 30);

  return (
    <>
      <section className="z-hero">
        <div className="z-container z-pitch__hero">
          <Badge tone="gold">{trialMonths} mois offerts</Badge>
          <h1 className="z-hero__title">
            Votre salon mérite
            <br />
            d’être trouvé.
          </h1>
          <p className="z-hero__subtitle">
            Zynetna met votre établissement en ligne, prend vos réservations pendant que vous
            travaillez, et vous donne enfin une vue claire sur votre activité.
          </p>
          <div className="z-row" style={{ gap: 'var(--z-space-3)', flexWrap: 'wrap' }}>
            <ButtonLink href="/register/pro" size="lg">
              Créer mon établissement
            </ButtonLink>
            <ButtonLink href="/search" variant="secondary" size="lg">
              Voir la marketplace
            </ButtonLink>
          </div>
          <p className="z-policy">
            {trialMonths} mois offerts, puis {price} par mois. Sans engagement.
            {businessCount > 0 ? ` Déjà ${businessCount} établissements sur Zynetna.` : ''}
          </p>
        </div>
      </section>

      <section className="z-section">
        <div className="z-container">
          {PILLARS.map((pillar, index) => (
            <div key={pillar.title} className="z-pitch__row">
              <div>
                <Eyebrow>0{index + 1}</Eyebrow>
                <h2 className="z-section__title">{pillar.title}</h2>
                <p className="z-section__lead">{pillar.body}</p>
              </div>
              <ul className="z-procta__list z-pitch__points">
                {pillar.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="z-section z-section--sunken">
        <div className="z-container">
          <div className="z-section__head">
            <div>
              <Eyebrow>Tarif</Eyebrow>
              <h2 className="z-section__title">Un prix, tout compris</h2>
              <p className="z-section__lead">
                Pas de commission sur vos rendez-vous. Pas de frais cachés. Vous gardez ce que
                vous gagnez.
              </p>
            </div>
          </div>

          <div className="z-pricing">
            <div className="z-pricing__card">
              <Eyebrow>Zynetna Pro</Eyebrow>
              <p className="z-pricing__free">{trialMonths} mois offerts</p>
              <p className="z-pricing__then">puis {price} / mois</p>
              <ul className="z-procta__list">
                <li>Page publique complète</li>
                <li>Réservation en ligne illimitée</li>
                <li>Prestations et équipe illimitées</li>
                <li>Agenda, clients, statistiques</li>
                <li>Avis vérifiés et réponses</li>
                <li>Rappels automatiques</li>
                <li>Aucune commission</li>
              </ul>
              <ButtonLink href="/register/pro" size="lg" block>
                Commencer gratuitement
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="z-section">
        <div className="z-container">
          <div className="z-section__head">
            <div>
              <Eyebrow>Questions</Eyebrow>
              <h2 className="z-section__title">Ce qu’on nous demande</h2>
            </div>
          </div>
          <div className="z-faq">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
