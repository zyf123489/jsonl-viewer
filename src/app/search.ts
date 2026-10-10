export interface SearchQuery {
  text: string;
  folded: string;
}

export interface TextMatch {
  id: string;
  start: number;
  end: number;
}

export function createSearchQuery(text: string): SearchQuery | null {
  return text.trim() ? { text, folded: text.toLowerCase() } : null;
}

export function containsQuery(text: string, query: SearchQuery | null): boolean {
  return !query || text.toLowerCase().includes(query.folded);
}

export function findTextMatches(text: string, query: SearchQuery | null, prefix = "text"): TextMatch[] {
  if (!query) return [];
  const folded = text.toLowerCase();
  let starts: number[] | undefined;
  let ends: number[] | undefined;
  if (folded.length !== text.length) {
    starts = [];
    ends = [];
    let originalOffset = 0;
    for (const character of text) {
      for (let offset = 0; offset < character.toLowerCase().length; offset++) {
        starts.push(originalOffset);
        ends.push(originalOffset + character.length);
      }
      originalOffset += character.length;
    }
  }
  const matches: TextMatch[] = [];
  let offset = 0;
  let previousEnd = 0;
  while (offset <= folded.length - query.folded.length) {
    const found = folded.indexOf(query.folded, offset);
    if (found < 0) break;
    const foldedEnd = found + query.folded.length;
    const start = starts ? starts[found] : found;
    const end = ends ? ends[foldedEnd - 1] : foldedEnd;
    if (start >= previousEnd) {
      matches.push({ id: `${prefix}:${start}:${end}`, start, end });
      previousEnd = end;
    }
    offset = foldedEnd;
  }
  return matches;
}

export interface JsonToken {
  type: string;
  value: string;
  start: number;
}

export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let offset = 0;
  while (offset < text.length) {
    const start = offset;
    const character = text[offset];
    let type = "other";
    if (/\s/.test(character)) {
      type = "whitespace";
      while (offset < text.length && /\s/.test(text[offset])) offset++;
    } else if (character === '"') {
      offset++;
      while (offset < text.length && text[offset] !== '"') {
        if (text[offset] === "\\" && offset + 1 < text.length) offset++;
        offset++;
      }
      if (offset < text.length) offset++;
      let next = offset;
      while (next < text.length && /\s/.test(text[next])) next++;
      type = text[next] === ":" ? "key" : "string";
    } else if (/[-\d]/.test(character)) {
      type = "number";
      while (offset < text.length && /[-\d.eE+]/.test(text[offset])) offset++;
    } else if (text.startsWith("true", offset) || text.startsWith("false", offset)) {
      type = "boolean";
      offset += text.startsWith("true", offset) ? 4 : 5;
    } else if (text.startsWith("null", offset)) {
      type = "null";
      offset += 4;
    } else {
      type = "{}[],:".includes(character) ? "punctuation" : "other";
      offset++;
    }
    tokens.push({ type, value: text.slice(start, offset), start });
  }
  return tokens;
}
