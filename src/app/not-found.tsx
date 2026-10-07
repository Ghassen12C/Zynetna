import Link from 'next/link';
import { Mark } from '@/components/brand/Mark';
import { ButtonLink } from '@/components/ui/Button';
import { translate } from '@/i18n/server';

export default async function NotFound() {
  const { m, path } = await translate();

  return (
    <div className="z-errorpage">
      <Mark size={64} />
      <h1>{m.errors.notFound}</h1>
      <p>{m.errors.notFoundLong}</p>
      <div
        className="z-row"
        style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap', justifyContent: 'center' }}
      >
        <ButtonLink href={path('/')}>{m.errors.backHome}</ButtonLink>
        <ButtonLink href={path('/search')} variant="secondary">
          {m.account.findPro}
        </ButtonLink>
      </div>
      <p className="z-help">
        {m.errors.needHelp} <Link href={path('/pro')}>{m.nav.forPros}</Link>
      </p>
    </div>
  );
}
