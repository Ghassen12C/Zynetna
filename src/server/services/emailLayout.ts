import { env } from '@/lib/env';
import { LOCALE_META, type Locale } from '@/i18n/config';
import { messagesFor } from '@/i18n';

/**
 * The one look every Zynetna email shares: a Medina-blue band with the logo, a
 * jasmin rule, a white card on chaux, one blue button, and a quiet footer.
 *
 * Email clients are not browsers: no stylesheets, no flexbox, no SVG in Gmail,
 * no web fonts in Outlook. So the layout is tables with inline styles, the logo
 * is a PNG served from the site, and type falls back to system fonts that carry
 * Arabic (Segoe UI, Tahoma). Arabic mail is laid out right to left.
 *
 * Every string is HTML-escaped: names and business names come from users.
 * The plain-text part is built from the same content, so the two never drift.
 */

export type EmailContent = {
  locale: Locale;
  /** Shown as the card's title; usually the subject. */
  heading: string;
  /** Paragraphs above the button. */
  paragraphs: string[];
  action?: { label: string; url: string };
  /** Paragraphs under the button: validity, "ignore if this was not you"… */
  after?: string[];
  /** Adds a link to the notification settings in the footer. */
  manageNotifications?: boolean;
  /** Why this person gets the email; defaults to "you have a Zynetna account". */
  footer?: string;
};

const C = {
  medina: '#0e3b66',
  medinaDeep: '#07213a',
  chaux: '#f5f1e8',
  jasmin: '#e0a94e',
  encre: '#0a1c2e',
  slate: '#44566b',
  card: '#fffdf8',
  border: '#ded7c8',
};
const FONT = "'Segoe UI', Tahoma, Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only absolute http(s) links go into an href. */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : '#';
}

function paragraph(text: string, align: string, opts: { muted?: boolean } = {}): string {
  const html = escapeHtml(text).replace(/\n/g, '<br>');
  const color = opts.muted ? C.slate : C.encre;
  const size = opts.muted ? 14 : 16;
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:${size}px;line-height:1.6;color:${color};text-align:${align};">${html}</p>`;
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const { email } = messagesFor(content.locale).feedback;
  const dir = LOCALE_META[content.locale].dir;
  const align = dir === 'rtl' ? 'right' : 'left';
  const lang = content.locale;
  const logo = `${env.APP_URL}/email/logo.png`;
  const settings = `${env.APP_URL}/${content.locale}/account/notifications`;

  const button = content.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
        <tr><td align="center" bgcolor="${C.medina}" style="border-radius:10px;">
          <a href="${safeUrl(content.action.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(content.action.label)}</a>
        </td></tr>
      </table>
      <p style="margin:0 0 20px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.slate};text-align:${align};">${escapeHtml(email.layout.fallback)}<br><a href="${safeUrl(content.action.url)}" style="color:${C.medina};word-break:break-all;" dir="ltr">${escapeHtml(content.action.url)}</a></p>`
    : '';

  const footerLinks = content.manageNotifications
    ? `<br><a href="${safeUrl(settings)}" style="color:${C.slate};text-decoration:underline;">${escapeHtml(email.layout.manage)}</a>`
    : '';

  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.chaux};" dir="${dir}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.paragraphs[0] ?? content.heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.chaux}" style="background:${C.chaux};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;" dir="${dir}">
      <tr><td bgcolor="${C.medina}" style="background:${C.medina};border-radius:16px 16px 0 0;padding:22px 28px;" align="${align}">
        <a href="${safeUrl(env.APP_URL)}" target="_blank" style="text-decoration:none;"><img src="${safeUrl(logo)}" width="223" height="48" alt="Zynetna" style="display:block;border:0;outline:none;width:223px;height:48px;color:${C.chaux};font-family:${FONT};font-size:22px;font-weight:700;letter-spacing:3px;"></a>
      </td></tr>
      <tr><td bgcolor="${C.jasmin}" style="background:${C.jasmin};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
      <tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-top:0;border-radius:0 0 16px 16px;padding:32px 28px 12px;" align="${align}">
        <h1 style="margin:0 0 20px;font-family:${FONT};font-size:22px;line-height:1.35;font-weight:700;color:${C.medina};text-align:${align};">${escapeHtml(content.heading)}</h1>
        ${content.paragraphs.map((p) => paragraph(p, align)).join('\n        ')}
        ${button}
        ${(content.after ?? []).map((p) => paragraph(p, align, { muted: true })).join('\n        ')}
        <p style="margin:8px 0 20px;padding-top:16px;border-top:1px solid ${C.border};font-family:${FONT};font-size:14px;line-height:1.5;font-weight:700;color:${C.medina};text-align:${align};">${escapeHtml(email.signature)}</p>
      </td></tr>
      <tr><td style="padding:20px 28px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.slate};" align="center">
        ${escapeHtml(content.footer ?? email.layout.footer)}${footerLinks}<br>
        <a href="${safeUrl(env.APP_URL)}" style="color:${C.medina};text-decoration:none;font-weight:700;" dir="ltr">zynetna.tn</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    ...content.paragraphs,
    '',
    ...(content.action ? [content.action.label, content.action.url, ''] : []),
    ...(content.after ?? []),
    '',
    email.signature,
    ...(content.manageNotifications ? ['', email.layout.manage, settings] : []),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { html, text };
}
