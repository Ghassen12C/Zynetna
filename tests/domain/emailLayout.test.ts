import { describe, expect, it } from 'vitest';
import { escapeHtml, renderEmail } from '@/server/services/emailLayout';

describe('renderEmail', () => {
  const base = {
    heading: 'Rendez-vous confirmé',
    paragraphs: ['Bonjour Mariem,'],
    action: { label: 'Voir sur Zynetna', url: 'https://www.zynetna.tn/fr/reservations/1' },
    after: ['Ce lien est valable une heure.'],
  };

  it('escapes text that comes from users', () => {
    const { html } = renderEmail({ ...base, locale: 'fr', paragraphs: ['<img src=x onerror=alert(1)> & "co"'] });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;co&quot;');
  });

  it('lays Arabic out right to left and French left to right', () => {
    expect(renderEmail({ ...base, locale: 'ar' }).html).toContain('<html lang="ar" dir="rtl">');
    expect(renderEmail({ ...base, locale: 'fr' }).html).toContain('<html lang="fr" dir="ltr">');
  });

  it('puts only http(s) links in the button', () => {
    const { html } = renderEmail({ ...base, locale: 'fr', action: { label: 'Go', url: 'javascript:alert(1)' } });
    expect(html).not.toContain('href="javascript:');
  });

  it('builds the plain-text part from the same content', () => {
    const { text } = renderEmail({ ...base, locale: 'fr' });
    expect(text).toContain('Bonjour Mariem,');
    expect(text).toContain('https://www.zynetna.tn/fr/reservations/1');
    expect(text).toContain('Ce lien est valable une heure.');
    expect(text).not.toContain('<');
  });

  it('links the notification settings only when asked', () => {
    expect(renderEmail({ ...base, locale: 'fr', manageNotifications: true }).html).toContain('/fr/account/notifications');
    expect(renderEmail({ ...base, locale: 'fr' }).html).not.toContain('/account/notifications');
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});
