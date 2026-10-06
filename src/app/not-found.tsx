import Link from 'next/link';
import { Mark } from '@/components/brand/Mark';
import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="z-errorpage">
      <Mark size={64} />
      <h1>Page introuvable</h1>
      <p>
        Le lien est peut-être erroné, ou la page a été déplacée. Essayez la recherche —
        votre professionnel y est sûrement.
      </p>
      <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <ButtonLink href="/">Retour à l’accueil</ButtonLink>
        <ButtonLink href="/search" variant="secondary">
          Rechercher un professionnel
        </ButtonLink>
      </div>
      <p className="z-help">
        Besoin d’aide ? <Link href="/pro">Espace professionnels</Link>
      </p>
    </div>
  );
}
