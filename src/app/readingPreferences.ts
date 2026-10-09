import { readPreference, writePreference } from "./preferences";
import { captureReadingPosition, restoreReadingPosition } from "./readingPosition";

export const FONT_SIZE_RANGE = { min: 10, max: 24 } as const;
export const LINE_HEIGHTS = [
  { value: "compact", label: "Compact", ratio: 1.3 },
  { value: "standard", label: "Standard", ratio: 1.6 },
  { value: "relaxed", label: "Relaxed", ratio: 1.9 },
] as const;

export type LineHeight = (typeof LINE_HEIGHTS)[number]["value"];

export interface ReadingPreferences {
  fontSize: number;
  lineHeight: LineHeight;
  wrapLongLines: boolean;
  showRecordSizes: boolean;
}

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  fontSize: 13,
  lineHeight: "standard",
  wrapLongLines: true,
  showRecordSizes: true,
};

export const READING_STORAGE_KEYS = {
  fontSize: "jsonlViewer.jsonFontSize",
  lineHeight: "jsonlViewer.jsonLineHeight",
  wrapLongLines: "jsonlViewer.wrapLongLines",
  showRecordSizes: "jsonlViewer.showLineSize",
} as const;

const lineHeightRatios = Object.fromEntries(
  LINE_HEIGHTS.map((option) => [option.value, option.ratio]),
) as Record<LineHeight, number>;
const listeners = new Set<() => void>();
let currentPreferences: ReadingPreferences | undefined;

export function resolveReadingPreferences(
  stored: Record<keyof ReadingPreferences, string | null>,
  defaults: ReadingPreferences,
  fontRange: { min: number; max: number },
  allowedLineHeights: readonly string[],
): ReadingPreferences {
  const fontSize = stored.fontSize && /^[1-9]\d*$/.test(stored.fontSize)
    ? Number(stored.fontSize)
    : NaN;
  const booleanValue = (value: string | null, fallback: boolean) =>
    value === "true" || value === "false" ? value === "true" : fallback;
  return {
    fontSize: Number.isInteger(fontSize) && fontSize >= fontRange.min && fontSize <= fontRange.max
      ? fontSize
      : defaults.fontSize,
    lineHeight: allowedLineHeights.includes(stored.lineHeight ?? "")
      ? stored.lineHeight as LineHeight
      : defaults.lineHeight,
    wrapLongLines: booleanValue(stored.wrapLongLines, defaults.wrapLongLines),
    showRecordSizes: booleanValue(stored.showRecordSizes, defaults.showRecordSizes),
  };
}

function applyReadingStyles(
  preferences: ReadingPreferences,
  ratios: Record<LineHeight, number>,
): void {
  const root = document.documentElement;
  root.style.setProperty("--json-font-size", `${preferences.fontSize}px`);
  root.style.setProperty("--json-line-height", String(ratios[preferences.lineHeight]));
  root.dataset.jsonWrap = preferences.wrapLongLines ? "on" : "off";
}

export function getReadingPreferences(): ReadingPreferences {
  if (!currentPreferences) {
    currentPreferences = resolveReadingPreferences(
      {
        fontSize: readPreference(READING_STORAGE_KEYS.fontSize),
        lineHeight: readPreference(READING_STORAGE_KEYS.lineHeight),
        wrapLongLines: readPreference(READING_STORAGE_KEYS.wrapLongLines),
        showRecordSizes: readPreference(READING_STORAGE_KEYS.showRecordSizes),
      },
      DEFAULT_READING_PREFERENCES,
      FONT_SIZE_RANGE,
      LINE_HEIGHTS.map((option) => option.value),
    );
  }
  return currentPreferences;
}

export function getDefaultReadingPreferences(): ReadingPreferences {
  return DEFAULT_READING_PREFERENCES;
}

export function getShowRecordSizes(): boolean {
  return getReadingPreferences().showRecordSizes;
}

export function getDefaultShowRecordSizes(): boolean {
  return DEFAULT_READING_PREFERENCES.showRecordSizes;
}

export function subscribeToReadingPreferences(onChange: () => void): () => void {
  applyReadingStyles(getReadingPreferences(), lineHeightRatios);
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
}

function updateReadingPreferences(changes: Partial<ReadingPreferences>): void {
  const current = getReadingPreferences();
  const keys = (Object.keys(changes) as (keyof ReadingPreferences)[])
    .filter((key) => changes[key] !== current[key]);
  if (keys.length === 0) return;
  const readingChanged = keys.some((key) => key !== "showRecordSizes");
  const anchors = readingChanged ? captureReadingPosition() : [];
  currentPreferences = { ...current, ...changes };
  if (readingChanged) {
    applyReadingStyles(currentPreferences, lineHeightRatios);
    restoreReadingPosition(anchors);
  }
  for (const key of keys) {
    writePreference(READING_STORAGE_KEYS[key], String(currentPreferences[key]));
  }
  listeners.forEach((listener) => listener());
}

export function setReadingPreference<Key extends keyof ReadingPreferences>(
  key: Key,
  value: ReadingPreferences[Key],
): void {
  updateReadingPreferences({ [key]: value });
}

export function resetReadingPreferences(): void {
  updateReadingPreferences({
    fontSize: DEFAULT_READING_PREFERENCES.fontSize,
    lineHeight: DEFAULT_READING_PREFERENCES.lineHeight,
    wrapLongLines: DEFAULT_READING_PREFERENCES.wrapLongLines,
  });
}

export const readingInitializationScript =
  `(function(){const read=${readPreference.toString()};` +
  `const resolve=${resolveReadingPreferences.toString()};` +
  `const apply=${applyReadingStyles.toString()};` +
  `const preferences=resolve({` +
  Object.entries(READING_STORAGE_KEYS).map(([key, storageKey]) =>
    `${key}:read(${JSON.stringify(storageKey)})`,
  ).join(",") +
  `},${JSON.stringify(DEFAULT_READING_PREFERENCES)},${JSON.stringify(FONT_SIZE_RANGE)},` +
  `${JSON.stringify(LINE_HEIGHTS.map((option) => option.value))});` +
  `apply(preferences,${JSON.stringify(lineHeightRatios)});})();`;
