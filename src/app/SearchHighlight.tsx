import { useMemo } from "react";
import type { ReactNode } from "react";
import { tokenizeJson, type TextMatch } from "./search";
import styles from "./page.module.css";

interface SearchTextProps {
  text: string;
  matches: TextMatch[];
  activeId?: string;
  offset?: number;
}

export function SearchText({ text, matches, activeId, offset = 0 }: SearchTextProps) {
  const children: ReactNode[] = [];
  const limit = offset + text.length;
  let lower = 0;
  let upper = matches.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (matches[middle].end <= offset) lower = middle + 1;
    else upper = middle;
  }
  let position = offset;
  for (let index = lower; index < matches.length && matches[index].start < limit; index++) {
    const match = matches[index];
    const start = Math.max(offset, match.start);
    const end = Math.min(limit, match.end);
    if (start > position) children.push(text.slice(position - offset, start - offset));
    children.push(
      <mark
        key={match.id}
        className={`${styles.searchMatch} ${activeId === match.id ? styles.searchMatchActive : ""}`}
        data-search-match={match.id}
        data-search-active={activeId === match.id ? "true" : undefined}
      >
        {text.slice(start - offset, end - offset)}
      </mark>,
    );
    position = end;
  }
  if (position < limit) children.push(text.slice(position - offset));
  return <>{children}</>;
}

export function JsonSyntaxHighlight({ json, matches, activeId, fieldPaths, onFieldHover }: {
  json: string;
  matches: TextMatch[];
  activeId?: string;
  fieldPaths?: ReadonlyMap<number, string>;
  onFieldHover?: (path: string | null) => void;
}) {
  const tokens = useMemo(() => tokenizeJson(json), [json]);
  return (
    <pre className={`${styles.prettyContent} mono`} data-json-body>
      {tokens.map((token) => (
        <span
          key={token.start}
          className={styles[`token${token.type.charAt(0).toUpperCase() + token.type.slice(1)}`]}
          data-field-path={fieldPaths?.get(token.start)}
          onMouseEnter={fieldPaths?.has(token.start) ? () => onFieldHover?.(fieldPaths.get(token.start)!) : undefined}
          onMouseLeave={fieldPaths?.has(token.start) ? () => onFieldHover?.(null) : undefined}
        >
          <SearchText text={token.value} matches={matches} activeId={activeId} offset={token.start} />
        </span>
      ))}
    </pre>
  );
}

export function revealSearchElement(container: HTMLElement, element: HTMLElement): void {
  const bounds = Array.from(element.getClientRects()).find((rectangle) => rectangle.height > 0);
  if (!bounds) return;
  const viewport = container.getBoundingClientRect();
  const margin = 12;
  if (bounds.top < viewport.top + margin || bounds.bottom > viewport.bottom - margin) {
    container.scrollTop += bounds.top - viewport.top - margin;
  }
  if (bounds.left < viewport.left + margin || bounds.right > viewport.right - margin) {
    container.scrollLeft += bounds.left - viewport.left - margin;
  }
}

export function revealTextMatch(container: HTMLElement, id: string): boolean {
  const element = container.querySelector<HTMLElement>(`[data-search-match="${CSS.escape(id)}"]`);
  if (!element) return false;
  revealSearchElement(container, element);
  return true;
}
