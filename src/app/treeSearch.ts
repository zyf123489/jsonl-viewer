import { createSearchQuery, findTextMatches, tokenizeJson, type SearchQuery, type TextMatch } from "./search";

export type TreePath = (string | number)[];

export interface TreeMatch extends TextMatch {
  nodeId: string;
  kind: "key" | "value";
}

export interface TreeSearchNode {
  id: string;
  path: TreePath;
  parentId: string | null;
  label: string;
  isField: boolean;
  value: unknown;
  children: TreeSearchNode[];
  expandable: boolean;
  keyMatches: TreeMatch[];
  valueMatches: TreeMatch[];
  previewMatches: TextMatch[];
  preview: string;
  fullText: string;
}

export interface TreeSearchModel {
  root: TreeSearchNode;
  nodes: Map<string, TreeSearchNode>;
  matches: TreeMatch[];
}

export function unescapeTreeString(text: string): string {
  return text.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
    .replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

export function formatTreeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return unescapeTreeString(value);
  if (typeof value === "object") {
    try { return unescapeTreeString(JSON.stringify(value, null, 2)); }
    catch { return String(value); }
  }
  return String(value);
}

function valuePreview(value: unknown): string {
  if (typeof value === "string") return `"${value.length > 50 ? value.slice(0, 50) + "..." : value}"`;
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).length} keys}`;
  return String(value);
}

function unescapedOffsets(source: string): { starts: number[]; ends: number[] } {
  let text = source;
  let starts = Array.from({ length: text.length }, (_, index) => index);
  let ends = starts.map((index) => index + 1);
  const replacements: [RegExp, string][] = [
    [/\\n/g, "\n"], [/\\r/g, "\r"], [/\\t/g, "\t"], [/\\"/g, '"'], [/\\\\/g, "\\"],
  ];
  for (const [pattern, replacement] of replacements) {
    const chunks: string[] = [];
    const nextStarts: number[] = [];
    const nextEnds: number[] = [];
    let position = 0;
    let found: RegExpExecArray | null;
    while ((found = pattern.exec(text))) {
      chunks.push(text.slice(position, found.index), replacement);
      for (let index = position; index < found.index; index++) {
        nextStarts.push(starts[index]);
        nextEnds.push(ends[index]);
      }
      nextStarts.push(starts[found.index]);
      nextEnds.push(ends[found.index + found[0].length - 1]);
      position = found.index + found[0].length;
    }
    chunks.push(text.slice(position));
    for (let index = position; index < text.length; index++) {
      nextStarts.push(starts[index]);
      nextEnds.push(ends[index]);
    }
    text = chunks.join("");
    starts = nextStarts;
    ends = nextEnds;
  }
  return { starts, ends };
}

function serializedStringOffsets(text: string): { starts: number[]; ends: number[] } {
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 1;
  while (offset < text.length - 1) {
    starts.push(offset);
    offset += text[offset] === "\\" ? text[offset + 1] === "u" ? 6 : 2 : 1;
    ends.push(offset);
  }
  return { starts, ends };
}

function lowerBound(offsets: number[], target: number, strict = false): number {
  let lower = 0;
  let upper = offsets.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (offsets[middle] < target || (strict && offsets[middle] === target)) lower = middle + 1;
    else upper = middle;
  }
  return lower;
}

function tokenMatches(node: TreeSearchNode, kind: TreeMatch["kind"], token: string, displayed: string): TextMatch[] {
  const matches = kind === "key" ? node.keyMatches : node.valueMatches;
  if (!matches.length) return [];
  const text = kind === "key" ? node.label : node.fullText;
  if (kind === "value" && typeof node.value !== "string") {
    return token === text ? matches : [];
  }
  const source = kind === "key" ? node.label : node.value as string;
  const originalOffsets = kind === "value" && source.includes("\\") ? unescapedOffsets(source) : undefined;
  const serializedOffsets = token.includes("\\") ? serializedStringOffsets(token) : undefined;
  const displayedOffsets = serializedOffsets ? unescapedOffsets(token) : undefined;
  return matches.flatMap((match) => {
    const sourceStart = originalOffsets ? originalOffsets.starts[match.start] : match.start;
    const sourceEnd = originalOffsets ? originalOffsets.ends[match.end - 1] : match.end;
    const serializedStart = serializedOffsets ? serializedOffsets.starts[sourceStart] : sourceStart + 1;
    const serializedEnd = serializedOffsets ? serializedOffsets.ends[sourceEnd - 1] : sourceEnd + 1;
    const start = Math.max(1, displayedOffsets ? lowerBound(displayedOffsets.ends, serializedStart, true) : serializedStart);
    const end = Math.min(displayed.length - 1, displayedOffsets ? lowerBound(displayedOffsets.starts, serializedEnd) : serializedEnd);
    const visibleMatches = findTextMatches(displayed.slice(start, end), createSearchQuery(text.slice(match.start, match.end)));
    if (visibleMatches.length !== 1) return [];
    return [{ id: match.id, start: start + visibleMatches[0].start, end: start + visibleMatches[0].end }];
  });
}

export function formatTreeNodeValue(node: TreeSearchNode): { text: string; matches: TextMatch[] } {
  if (!node.expandable) return { text: node.fullText, matches: node.valueMatches };
  const sources: { node: TreeSearchNode; kind: TreeMatch["kind"] }[] = [];
  const pending = [...node.children].reverse();
  while (pending.length) {
    const child = pending.pop()!;
    if (child.isField) sources.push({ node: child, kind: "key" });
    if (!child.expandable) sources.push({ node: child, kind: "value" });
    else for (let index = child.children.length - 1; index >= 0; index--) pending.push(child.children[index]);
  }
  if (!sources.some((source) => source.kind === "key" ? source.node.keyMatches.length : source.node.valueMatches.length)) {
    return { text: formatTreeValue(node.value), matches: [] };
  }
  let serialized: string;
  try { serialized = JSON.stringify(node.value, null, 2); }
  catch { return { text: String(node.value), matches: [] }; }
  const matches: TextMatch[] = [];
  let sourceIndex = 0;
  let displayOffset = 0;
  let previousEnd = 0;
  for (const token of tokenizeJson(serialized)) {
    const displayed = unescapeTreeString(token.value);
    if (["key", "string", "number", "boolean", "null"].includes(token.type)) {
      const source = sources[sourceIndex++];
      if (source) {
        for (const match of tokenMatches(source.node, source.kind, token.value, displayed)) {
          const start = displayOffset + match.start;
          const end = displayOffset + match.end;
          if (start >= previousEnd) {
            matches.push({ id: match.id, start, end });
            previousEnd = end;
          }
        }
      }
    }
    displayOffset += displayed.length;
  }
  return { text: unescapeTreeString(serialized), matches };
}

function createNode(value: unknown, path: TreePath, parentId: string | null, label: string, isField: boolean): TreeSearchNode {
  const expandable = value !== null && typeof value === "object";
  return {
    id: JSON.stringify(path), path, parentId, label, isField, value, expandable,
    children: [], keyMatches: [], valueMatches: [], previewMatches: [],
    preview: valuePreview(value), fullText: expandable ? "" : formatTreeValue(value),
  };
}

export function buildTreeSearchModel(data: unknown, query: SearchQuery | null): TreeSearchModel {
  const root = createNode(data, [], null, "root", false);
  const model: TreeSearchModel = { root, nodes: new Map(), matches: [] };
  const pending = [root];
  while (pending.length) {
    const node = pending.pop()!;
    model.nodes.set(node.id, node);
    if (node.isField) {
      node.keyMatches = findTextMatches(node.label, query, `${node.id}:key`)
        .map((match) => ({ ...match, nodeId: node.id, kind: "key" }));
      for (const match of node.keyMatches) model.matches.push(match);
    }
    if (!node.expandable) {
      node.valueMatches = findTextMatches(node.fullText, query, `${node.id}:value`)
        .map((match) => ({ ...match, nodeId: node.id, kind: "value" }));
      for (const match of node.valueMatches) model.matches.push(match);
      if (typeof node.value === "string") {
        const source = node.value;
        const offsets = node.valueMatches.length && source.includes("\\") ? unescapedOffsets(source) : undefined;
        const visibleEnd = Math.min(50, source.length);
        node.previewMatches = node.valueMatches.flatMap((match) => {
          const start = offsets ? offsets.starts[match.start] : match.start;
          const end = offsets ? offsets.ends[match.end - 1] : match.end;
          if (end > visibleEnd || source.slice(start, end).toLowerCase() !== node.fullText.slice(match.start, match.end).toLowerCase()) return [];
          return [{ id: match.id, start: start + 1, end: end + 1 }];
        });
      } else {
        node.previewMatches = node.valueMatches;
      }
    } else {
      const entries: [string | number, unknown][] = Array.isArray(node.value)
        ? node.value.map((value, index) => [index, value])
        : Object.entries(node.value as Record<string, unknown>);
      node.children = entries.map(([key, value]) => createNode(
        value, [...node.path, key], node.id,
        typeof key === "number" ? `[${key}]` : key, typeof key === "string",
      ));
      for (let index = node.children.length - 1; index >= 0; index--) pending.push(node.children[index]);
    }
  }
  return model;
}

export function ancestorIds(model: TreeSearchModel, nodeId: string): string[] {
  const ancestors: string[] = [];
  let parentId = model.nodes.get(nodeId)?.parentId;
  while (parentId !== null && parentId !== undefined) {
    ancestors.push(parentId);
    parentId = model.nodes.get(parentId)?.parentId;
  }
  return ancestors;
}

export function treePathLabel(path: TreePath): string {
  return path.reduce<string>((label, key) => {
    if (typeof key === "number") return `${label}[${key}]`;
    return /^[A-Za-z_$][\w$]*$/.test(key) ? `${label}.${key}` : `${label}[${JSON.stringify(key)}]`;
  }, "root");
}
