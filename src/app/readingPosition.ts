interface ReadingAnchor {
  container: HTMLElement;
  verticalProgress: number;
  horizontalProgress: number;
  offsetTop: number;
  offsetLeft: number;
  range?: Range;
  element?: HTMLElement;
  elementHeight?: number;
}

function characterRange(text: Text, offset: number): Range {
  const range = document.createRange();
  range.setStart(text, offset);
  range.setEnd(text, Math.min(offset + 1, text.length));
  return range;
}

function firstOffset(start: number, end: number, matches: (offset: number) => boolean): number {
  let lower = start;
  let upper = end;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (matches(middle)) upper = middle;
    else lower = middle + 1;
  }
  return lower;
}

function visibleTextRange(pre: HTMLElement, viewport: DOMRect): Range | undefined {
  const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (node.length > 0) {
      const wholeRange = document.createRange();
      wholeRange.selectNodeContents(node);
      const bounds = wholeRange.getBoundingClientRect();
      if (bounds.bottom > viewport.top + 1 && bounds.top < viewport.bottom &&
          bounds.right > viewport.left && bounds.left < viewport.right) {
        const text = node;
        let offset = firstOffset(0, text.length, (position) =>
          characterRange(text, position).getBoundingClientRect().bottom > viewport.top + 1,
        );
        if (offset < text.length) {
          const firstBounds = characterRange(text, offset).getBoundingClientRect();
          const lineEnd = firstOffset(offset, text.length, (position) =>
            characterRange(text, position).getBoundingClientRect().top > firstBounds.top + 1,
          );
          if (firstBounds.right <= viewport.left) {
            offset = firstOffset(offset, lineEnd, (position) =>
              characterRange(text, position).getBoundingClientRect().right > viewport.left,
            );
          }
          if (offset < text.length) {
            const range = characterRange(text, offset);
            const rectangle = range.getBoundingClientRect();
            if (rectangle.height > 0 && rectangle.bottom > viewport.top && rectangle.top < viewport.bottom) {
              return range;
            }
          }
        }
      }
    }
    node = walker.nextNode() as Text | null;
  }
  return undefined;
}

export function captureReadingPosition(): ReadingAnchor[] {
  const anchors: ReadingAnchor[] = [];
  const containers = document.querySelectorAll<HTMLElement>("[data-json-reader] [data-reading-scroll]");
  for (const container of containers) {
    const viewport = container.getBoundingClientRect();
    const anchor: ReadingAnchor = {
      container,
      verticalProgress: container.scrollTop / Math.max(1, container.scrollHeight - container.clientHeight),
      horizontalProgress: container.scrollLeft / Math.max(1, container.scrollWidth - container.clientWidth),
      offsetTop: 0,
      offsetLeft: 0,
    };
    if (container.dataset.readingScroll === "tree") {
      const rows = container.querySelectorAll<HTMLElement>("[data-reading-path]");
      for (const row of rows) {
        const bounds = row.getBoundingClientRect();
        if (bounds.bottom > viewport.top + 1 && bounds.top < viewport.bottom) {
          anchor.element = row;
          anchor.elementHeight = bounds.height;
          anchor.offsetTop = bounds.top - viewport.top;
          break;
        }
      }
    } else {
      const pre = container.querySelector<HTMLElement>("pre");
      if (!pre || pre.closest("[data-reading-scroll]") !== container) continue;
      anchor.range = visibleTextRange(pre, viewport);
      if (anchor.range) {
        const bounds = anchor.range.getBoundingClientRect();
        anchor.offsetTop = bounds.top - viewport.top;
        anchor.offsetLeft = bounds.left - viewport.left;
      }
    }
    anchors.push(anchor);
  }
  return anchors;
}

export function restoreReadingPosition(anchors: ReadingAnchor[]): void {
  for (const anchor of anchors) {
    const container = anchor.container;
    if (!container.isConnected) continue;
    const viewport = container.getBoundingClientRect();
    if (anchor.element?.isConnected) {
      const bounds = anchor.element.getBoundingClientRect();
      const scale = bounds.height / Math.max(1, anchor.elementHeight ?? bounds.height);
      container.scrollTop += bounds.top - viewport.top - anchor.offsetTop * scale;
      container.scrollLeft = anchor.horizontalProgress * Math.max(0, container.scrollWidth - container.clientWidth);
    } else if (anchor.range?.startContainer.isConnected) {
      const bounds = anchor.range.getBoundingClientRect();
      container.scrollTop += bounds.top - viewport.top - anchor.offsetTop;
      container.scrollLeft += bounds.left - viewport.left - anchor.offsetLeft;
    } else {
      container.scrollTop = anchor.verticalProgress * Math.max(0, container.scrollHeight - container.clientHeight);
      container.scrollLeft = anchor.horizontalProgress * Math.max(0, container.scrollWidth - container.clientWidth);
    }
  }
}
