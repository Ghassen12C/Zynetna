import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

/**
 * Render a legal body kept in the dictionaries as plain strings.
 *
 * Each entry is one block — `## ` a section heading, `### ` a sub-heading,
 * anything else a paragraph — and a paragraph may carry `[label](href)` links
 * and `**emphasis**`. That keeps the long texts translatable as whole
 * sentences while the markup stays out of the dictionaries.
 */
const INLINE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;

function inline(text: string, localize: (href: string) => string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const [, label, href, bold] = match;
    if (bold) {
      out.push(<strong key={index}>{bold}</strong>);
    } else if (href?.startsWith('mailto:')) {
      out.push(
        <a key={index} href={href} dir="ltr">
          {label}
        </a>,
      );
    } else if (href) {
      out.push(
        <Link key={index} href={localize(href)}>
          {label}
        </Link>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function LegalText({
  blocks,
  localize,
}: {
  blocks: string[];
  /** Prefix an internal link with the visitor's locale. */
  localize: (href: string) => string;
}) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.startsWith('### ')) return <h3 key={i}>{block.slice(4)}</h3>;
        if (block.startsWith('## ')) return <h2 key={i}>{block.slice(3)}</h2>;
        return <p key={i}>{inline(block, localize).map((node, j) => <Fragment key={j}>{node}</Fragment>)}</p>;
      })}
    </>
  );
}
