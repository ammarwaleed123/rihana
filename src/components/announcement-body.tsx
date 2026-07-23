import type { ReactNode } from "react";

/**
 * A deliberately small, safe markdown renderer for announcement bodies.
 *
 * Announcements are written by staff, but "written by staff" is not "trusted to
 * emit HTML" — an account could be compromised, and the blast radius of raw HTML
 * in something shown to every family is the whole point of the CSP. So this
 * renders to **React elements only**: every piece of the text becomes a text
 * node or a known element, and React escapes text by default. There is no
 * `dangerouslySetInnerHTML` here and there never should be — which is also why
 * we did not pull in a markdown library, most of which hand you an HTML string.
 *
 * Supported, and nothing else: paragraphs, bullet lists, **bold**, *italic*, and
 * `[links](https://…)`. A link whose scheme is not http(s) is rendered as plain
 * text, so `javascript:` and friends cannot ride in.
 */

const SAFE_LINK = /^https?:\/\//i;
const INLINE =
  /(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const key = `${keyPrefix}-${i}`;

    if (match[1]) {
      const label = match[2];
      const url = match[3];
      nodes.push(
        SAFE_LINK.test(url) ? (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-leaf underline underline-offset-2"
          >
            {label}
          </a>
        ) : (
          // Unsafe scheme — never a link, just the text.
          label
        ),
      );
    } else if (match[4]) {
      nodes.push(<strong key={key}>{match[5]}</strong>);
    } else if (match[6]) {
      nodes.push(<em key={key}>{match[7]}</em>);
    }

    lastIndex = INLINE.lastIndex;
    i += 1;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function AnnouncementBody({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ");
    blocks.push(
      <p key={`p-${key}`} className="text-ink-soft">
        {renderInline(text, `p${key}`)}
      </p>,
    );
    key += 1;
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    const items = list;
    blocks.push(
      <ul key={`ul-${key}`} className="list-disc space-y-1 pl-5 text-ink-soft">
        {items.map((item, index) => (
          <li key={index}>{renderInline(item, `li${key}-${index}`)}</li>
        ))}
      </ul>,
    );
    key += 1;
    list = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flushParagraph();
      flushList();
    } else if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      list.push(trimmed.replace(/^[-*]\s+/, ""));
    } else {
      flushList();
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  flushList();

  return <div className="space-y-3 leading-relaxed">{blocks}</div>;
}
