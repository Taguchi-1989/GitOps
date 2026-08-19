/**
 * FlowOps - ヘルプ記事の簡易 Markdown 表示
 *
 * ヘルプ記事で実際に使う記法（見出し・段落・箇条書き・強調）だけを扱う。
 * 汎用の Markdown レンダラではないため、記事側で凝った記法は使わない。
 */

import React from 'react';

/** `**強調**` のみインライン展開する */
function renderInline(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-gray-900 dark:text-gray-100">
        {part}
      </strong>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    )
  );
}

export function HelpMarkdown({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let paragraph: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems;
    const ordered = listOrdered;
    listItems = [];
    blocks.push(
      React.createElement(
        ordered ? 'ol' : 'ul',
        {
          key: `list-${blocks.length}`,
          className: `${ordered ? 'list-decimal' : 'list-disc'} space-y-1.5 pl-5 text-gray-700 dark:text-gray-300`,
        },
        items.map((item, index) => <li key={index}>{renderInline(item)}</li>)
      )
    );
  };

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    paragraph = [];
    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-relaxed text-gray-700 dark:text-gray-300">
        {renderInline(text)}
      </p>
    );
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const isSection = heading[1].length === 2;
      blocks.push(
        React.createElement(
          isSection ? 'h2' : 'h3',
          {
            key: `h-${blocks.length}`,
            className: isSection
              ? 'mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100'
              : 'mt-4 text-base font-semibold text-gray-900 dark:text-gray-100',
          },
          renderInline(heading[2])
        )
      );
      continue;
    }

    // 箇条書き（`-` と `1.` の両方）
    const listItem = trimmed.match(/^([-*]|\d+\.)\s+(.*)$/);
    if (listItem) {
      flushParagraph();
      const ordered = listItem[1].endsWith('.');
      if (listItems.length > 0 && ordered !== listOrdered) {
        flushList();
      }
      listOrdered = ordered;
      listItems.push(listItem[2]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return <div className="space-y-3">{blocks}</div>;
}
