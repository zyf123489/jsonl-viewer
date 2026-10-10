import { readPreference, resolvePreference, writePreference } from "./preferences";
import { captureReadingPosition, restoreReadingPosition } from "./readingPosition";
import type { Language } from "./i18n";

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "简体中文" },
] as const;
export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGE_STORAGE_KEY = "jsonlViewer.language";
const LANGUAGE_VALUES = LANGUAGES.map((language) => language.value);
const LANGUAGE_CHANGE_EVENT = "jsonlViewer.languageChange";

export function getLanguage(): Language {
  return resolvePreference(document.documentElement.lang, LANGUAGE_VALUES, DEFAULT_LANGUAGE);
}

export function getDefaultLanguage(): Language {
  return DEFAULT_LANGUAGE;
}

export function subscribeToLanguage(onChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== LANGUAGE_STORAGE_KEY && event.key !== null) return;
    document.documentElement.lang = resolvePreference(event.newValue, LANGUAGE_VALUES, DEFAULT_LANGUAGE);
    onChange();
  };
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function selectLanguage(language: Language): void {
  if (language === getLanguage()) return;
  const anchors = captureReadingPosition();
  document.documentElement.lang = language;
  writePreference(LANGUAGE_STORAGE_KEY, language);
  window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
  requestAnimationFrame(() => restoreReadingPosition(anchors));
}

export const languageInitializationScript =
  `document.documentElement.lang=(${resolvePreference.toString()})` +
  `((${readPreference.toString()})(${JSON.stringify(LANGUAGE_STORAGE_KEY)}),` +
  `${JSON.stringify(LANGUAGE_VALUES)},${JSON.stringify(DEFAULT_LANGUAGE)});`;
