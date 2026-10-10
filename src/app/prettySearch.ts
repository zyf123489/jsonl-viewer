import { findTextMatches, tokenizeJson, type JsonToken, type SearchQuery, type TextMatch } from "./search";

type JsonPath = (string | number)[];

interface LocatedToken {
  token: JsonToken;
  end: number;
  address: string;
}

interface ContainerFrame {
  type: "object" | "array";
  path: JsonPath;
  state: "key" | "colon" | "value" | "comma";
  property: string | null;
  index: number;
  hasValue: boolean;
}

export interface PrettyMapping {
  raw: string;
  pretty: string;
  rawTokens: LocatedToken[];
  prettyTokens: LocatedToken[];
  targets: (number | undefined)[];
}

function valuePath(frame: ContainerFrame): JsonPath {
  return [...frame.path, frame.type === "array" ? frame.index : frame.property!];
}

function locateTokens(text: string): LocatedToken[] | null {
  const tokens: LocatedToken[] = [];
  const stack: ContainerFrame[] = [];
  let rootConsumed = false;
  const add = (token: JsonToken, path: JsonPath, role: string) => {
    tokens.push({ token, end: token.start + token.value.length, address: JSON.stringify([path, role]) });
  };
  try {
    for (const token of tokenizeJson(text)) {
      if (token.type === "whitespace") continue;
      const frame = stack[stack.length - 1];
      if (frame && token.value === (frame.type === "object" ? "}" : "]")) {
        const emptyState = frame.type === "object" ? "key" : "value";
        if (frame.state !== "comma" && (frame.hasValue || frame.state !== emptyState)) return null;
        add(token, frame.path, "close");
        stack.pop();
        continue;
      }
      if (frame?.state === "key") {
        if (token.type !== "key") return null;
        const property: unknown = JSON.parse(token.value);
        if (typeof property !== "string") return null;
        frame.property = property;
        add(token, valuePath(frame), "key");
        frame.state = "colon";
        continue;
      }
      if (frame?.state === "colon") {
        if (token.value !== ":") return null;
        add(token, valuePath(frame), "colon");
        frame.state = "value";
        continue;
      }
      if (frame?.state === "comma") {
        if (token.value !== ",") return null;
        add(token, valuePath(frame), "comma");
        frame.state = frame.type === "object" ? "key" : "value";
        frame.property = null;
        frame.index++;
        continue;
      }
      if (!frame && rootConsumed) return null;
      const path = frame ? valuePath(frame) : [];
      const container = token.value === "{" ? "object" : token.value === "[" ? "array" : null;
      if (!container && !["string", "number", "boolean", "null"].includes(token.type)) return null;
      add(token, path, container ? "open" : "value");
      if (frame) {
        frame.state = "comma";
        frame.hasValue = true;
      } else rootConsumed = true;
      if (container) stack.push({
        type: container, path, state: container === "object" ? "key" : "value",
        property: null, index: 0, hasValue: false,
      });
    }
  } catch { return null; }
  return rootConsumed && stack.length === 0 ? tokens : null;
}

function uniqueAddresses(tokens: LocatedToken[]): Map<string, number | null> {
  const addresses = new Map<string, number | null>();
  tokens.forEach((token, index) => addresses.set(token.address, addresses.has(token.address) ? null : index));
  return addresses;
}

export function createPrettyMapping(raw: string, pretty: string): PrettyMapping | null {
  const rawTokens = locateTokens(raw);
  const prettyTokens = locateTokens(pretty);
  if (!rawTokens || !prettyTokens) return null;
  const rawAddresses = uniqueAddresses(rawTokens);
  const prettyAddresses = uniqueAddresses(prettyTokens);
  const targets = rawTokens.map((source) => {
    if (rawAddresses.get(source.address) === null) return undefined;
    const targetIndex = prettyAddresses.get(source.address);
    if (targetIndex === undefined || targetIndex === null) return undefined;
    const target = prettyTokens[targetIndex];
    return target.token.type === source.token.type && target.token.value === source.token.value
      ? targetIndex : undefined;
  });
  return { raw, pretty, rawTokens, prettyTokens, targets };
}

function mapMatch(mapping: PrettyMapping, match: TextMatch): TextMatch | null {
  const { rawTokens, prettyTokens, targets } = mapping;
  let lower = 0;
  let upper = rawTokens.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (rawTokens[middle].end <= match.start) lower = middle + 1;
    else upper = middle;
  }
  const firstIndex = lower;
  if (firstIndex >= rawTokens.length || rawTokens[firstIndex].token.start >= match.end) return null;
  const targetIndex = targets[firstIndex];
  if (targetIndex === undefined) return null;
  let lastIndex = firstIndex;
  while (lastIndex + 1 < rawTokens.length && rawTokens[lastIndex + 1].token.start < match.end) lastIndex++;
  for (let index = firstIndex; index <= lastIndex; index++) {
    if (targets[index] !== targetIndex + index - firstIndex) return null;
  }
  const first = rawTokens[firstIndex];
  const last = rawTokens[lastIndex];
  const firstTarget = prettyTokens[targetIndex];
  const lastTarget = prettyTokens[targetIndex + lastIndex - firstIndex];
  let start = firstTarget.token.start + match.start - first.token.start;
  let end = lastTarget.token.start + match.end - last.token.start;
  if (match.start < first.token.start) {
    const prefix = mapping.raw.slice(match.start, first.token.start);
    start = firstTarget.token.start - prefix.length;
    if (start < 0 || mapping.pretty.slice(start, firstTarget.token.start) !== prefix) return null;
  }
  if (match.end > last.end) {
    const suffix = mapping.raw.slice(last.end, match.end);
    end = lastTarget.end + suffix.length;
    if (mapping.pretty.slice(lastTarget.end, end) !== suffix) return null;
  }
  return { id: `pretty:${start}:${end}`, start, end };
}

export function findPrettyMatches(pretty: string, query: SearchQuery | null, mapping: PrettyMapping | null): TextMatch[] {
  if (!query) return [];
  const candidates = findTextMatches(pretty, query, "pretty");
  if (mapping) {
    for (const match of findTextMatches(mapping.raw, query)) {
      const mapped = mapMatch(mapping, match);
      if (mapped) candidates.push(mapped);
    }
  }
  candidates.sort((first, second) => first.start - second.start || first.end - second.end);
  const matches: TextMatch[] = [];
  for (const match of candidates) {
    const previous = matches[matches.length - 1];
    if (!previous || match.start >= previous.end) matches.push(match);
  }
  return matches;
}
