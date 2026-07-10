import type { ReactNode } from 'react';

/**
 * Markdown-lite renderer for chat bubbles: links, bold, inline code, and
 * line structure. Builds React nodes — no HTML injection surface.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/)[^)\s]+\))/g;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(INLINE);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        const content = renderInline(bullet ? bullet[1] : line, String(i));
        return (
          <span key={i} style={{ display: 'block', paddingLeft: bullet ? 14 : 0 }}>
            {bullet && <span style={{ color: 'var(--beacon)', marginRight: 6 }}>·</span>}
            {content}
            {line === '' && ' '}
          </span>
        );
      })}
    </>
  );
}
