import { LocalizedError } from "./i18n";

export type FieldPath = readonly (string | number)[];

export interface FieldNote {
  path: FieldPath;
  note: string;
}

export type FieldNoteMap = ReadonlyMap<string, FieldNote>;

export interface FieldNotesTemplateV1 {
  format: "jsonl-viewer-field-notes";
  version: 1;
  notes: FieldNote[];
}

export interface NoteMergeCounts {
  added: number;
  overwritten: number;
  retained: number;
  unchanged: number;
}

export const EMPTY_FIELD_NOTES: FieldNoteMap = new Map();

export function fieldPathKey(path: FieldPath): string {
  return JSON.stringify(path);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateFieldPath(value: unknown, location = "path"): asserts value is FieldPath {
  if (!Array.isArray(value) || value.length === 0) {
    throw new LocalizedError("{location}: expected a non-empty path array.", { location });
  }
  value.forEach((segment, index) => {
    if (typeof segment !== "string" &&
        !(typeof segment === "number" && Number.isSafeInteger(segment) && segment >= 0)) {
      throw new LocalizedError("{location}[{index}]: expected a string key or non-negative safe integer index.", { location, index });
    }
  });
  if (typeof value[value.length - 1] !== "string") {
    throw new LocalizedError("{location}: the last segment must be an object field name (string).", { location });
  }
}

export function hasFieldPath(value: unknown, path: FieldPath): boolean {
  let current = value;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || !Object.hasOwn(current, segment)) return false;
      current = current[segment];
    } else {
      if (!isObject(current) || !Object.hasOwn(current, segment)) return false;
      current = current[segment];
    }
  }
  return true;
}

function checkProperties(value: Record<string, unknown>, allowed: string[], location: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new LocalizedError("{location}.{key}: unsupported property in v1.", { location, key });
  }
}

export function parseFieldNotesTemplate(text: string): FieldNotesTemplateV1 {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new LocalizedError("Template: invalid JSON. Choose a complete JSON object, not JSONL."); }
  if (!isObject(value)) throw new LocalizedError("Template: expected a JSON object.");
  checkProperties(value, ["format", "version", "notes"], "Template");
  if (value.format !== "jsonl-viewer-field-notes") {
    throw new LocalizedError('format: expected "jsonl-viewer-field-notes".');
  }
  if (value.version !== 1) throw new LocalizedError("version: only numeric version 1 is supported.");
  if (!Array.isArray(value.notes) || value.notes.length === 0) {
    throw new LocalizedError("notes: expected a non-empty array.");
  }
  const seen = new Map<string, number>();
  const notes = value.notes.map((entry: unknown, index: number): FieldNote => {
    const location = `notes[${index}]`;
    if (!isObject(entry)) throw new LocalizedError("{location}: expected an object.", { location });
    checkProperties(entry, ["path", "note"], location);
    validateFieldPath(entry.path, `${location}.path`);
    if (typeof entry.note !== "string" || !entry.note.trim()) {
      throw new LocalizedError("{location}.note: expected a non-empty string.", { location });
    }
    const key = fieldPathKey(entry.path);
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new LocalizedError("{location}.path: duplicate of notes[{previous}].path ({path}).", { location, previous, path: key });
    }
    seen.set(key, index);
    return { path: [...entry.path], note: entry.note.trim() };
  });
  return { format: "jsonl-viewer-field-notes", version: 1, notes };
}

export function mergeFieldNotes(current: FieldNoteMap, notes: readonly FieldNote[], overwrite: boolean) {
  const next = new Map(current);
  const counts: NoteMergeCounts = { added: 0, overwritten: 0, retained: 0, unchanged: 0 };
  for (const entry of notes) {
    const key = fieldPathKey(entry.path);
    const existing = current.get(key);
    if (existing?.note === entry.note) counts.unchanged++;
    else if (existing && !overwrite) counts.retained++;
    else {
      next.set(key, { path: [...entry.path], note: entry.note });
      if (existing) counts.overwritten++;
      else counts.added++;
    }
  }
  return { notes: next as FieldNoteMap, counts };
}
