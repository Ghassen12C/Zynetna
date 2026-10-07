import type { Metadata } from 'next';
import { translate } from '@/i18n/server';
import { LegalText } from '../LegalText';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return {
    title: m.legal.termsTitle,
    description: m.legal.termsDescription,
    alternates: { canonical: '/legal/terms' },
  };
}

export default async function TermsPage() {
  const { m, locale, path } = await translate();

  return (
    <div className="z-section">
      <article className="z-container z-legal">
        <h1>{m.legal.termsTitle}</h1>
        <p className="z-help">{m.legal.lastUpdated}</p>
        {/* The French text is the reference; translations say so up front. */}
        {locale === 'fr' ? null : <p className="z-legal__notice">{m.legal.bindingNotice}</p>}
        <LegalText blocks={m.legal.terms} localize={path} />
      </article>
    </div>
  );
}
