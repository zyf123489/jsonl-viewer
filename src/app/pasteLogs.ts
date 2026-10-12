export type RecordKind = "json" | "invalid" | "text";
export type PasteFormat = "json" | "jsonl" | "text";

export interface JsonLine {
  id: number;
  raw: string;
  parsed: unknown | null;
  size: number;
  recordKind: RecordKind;
  error?: string;
}

export type SourceInfo =
  | { kind: "file" }
  | { kind: "paste"; format: PasteFormat; originalText: string };

export interface PasteInput {
  format: PasteFormat;
  originalText: string;
  records: JsonLine[];
}

export interface PastePreview {
  lineNumber: number;
  recordKind: "json" | "invalid";
  summary: string;
}

export type PasteAnalysis =
  | { format: "json"; records: JsonLine[] }
  | {
    format: "jsonl";
    records: JsonLine[];
    previews: PastePreview[];
    validCount: number;
    invalidCount: number;
    blankCount: number;
  };

export const PASTE_SIZE_WARNING_BYTES = 5 * 1024 * 1024;
export const PASTE_PREVIEW_LIMIT = 10;
const PASTE_PREVIEW_LENGTH = 160;

export function utf8Size(text: string): number {
  return new TextEncoder().encode(text).length;
}

function parseRecord(raw: string, id: number): JsonLine {
  const size = utf8Size(raw);
  try {
    return { id, raw, parsed: JSON.parse(raw), size, recordKind: "json" };
  } catch {
    return { id, raw, parsed: null, size, recordKind: "invalid", error: "Invalid JSON" };
  }
}

export function analyzePaste(draft: string): PasteAnalysis {
  const wholeRecord = parseRecord(draft, 1);
  if (wholeRecord.recordKind === "json") return { format: "json", records: [wholeRecord] };

  const records: JsonLine[] = [];
  const previews: PastePreview[] = [];
  let validCount = 0;
  let blankCount = 0;
  const rawLines = draft.split("\n");
  rawLines.forEach((raw, index) => {
    if (!raw.trim()) {
      blankCount += 1;
      return;
    }
    const record = parseRecord(raw, records.length + 1);
    records.push(record);
    if (record.recordKind === "json") validCount += 1;
    if (previews.length < PASTE_PREVIEW_LIMIT) {
      previews.push({
        lineNumber: index + 1,
        recordKind: record.recordKind as "json" | "invalid",
        summary: raw.length > PASTE_PREVIEW_LENGTH ? raw.slice(0, PASTE_PREVIEW_LENGTH) + "…" : raw,
      });
    }
  });
  return { format: "jsonl", records, previews, validCount, invalidCount: records.length - validCount, blankCount };
}

export function createTextPaste(draft: string): PasteInput {
  return {
    format: "text",
    originalText: draft,
    records: [{ id: 1, raw: draft, parsed: null, size: utf8Size(draft), recordKind: "text" }],
  };
}
