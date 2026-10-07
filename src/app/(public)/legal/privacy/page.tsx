import type { Metadata } from 'next';
import { translate } from '@/i18n/server';
import { LegalText } from '../LegalText';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return {
    title: m.legal.privacyTitle,
    description: m.legal.privacyDescription,
    alternates: { canonical: '/legal/privacy' },
  };
}

export default async function PrivacyPage() {
  const { m, locale, path } = await translate();

  return (
    <div className="z-section">
      <article className="z-container z-legal">
        <h1>{m.legal.privacyTitle}</h1>
        <p className="z-help">{m.legal.lastUpdated}</p>
        {/* The French text is the reference; translations say so up front. */}
        {locale === 'fr' ? null : <p className="z-legal__notice">{m.legal.bindingNotice}</p>}
        <LegalText blocks={m.legal.privacy} localize={path} />
      </article>
    </div>
  );
}
