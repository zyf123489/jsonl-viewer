import { readPreference, resolvePreference, writePreference } from "./preferences";

export const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "warm", label: "Warm" },
] as const;

export type Theme = (typeof THEMES)[number]["value"];

export const DEFAULT_THEME: Theme = "dark";
export const THEME_STORAGE_KEY = "jsonlViewer.theme";
const THEME_VALUES = THEMES.map((theme) => theme.value);
const THEME_CHANGE_EVENT = "jsonlViewer.themeChange";

export function getTheme(): Theme {
  return resolvePreference(
    document.documentElement.dataset.theme,
    THEME_VALUES,
    DEFAULT_THEME,
  );
}

export function getDefaultTheme(): Theme {
  return DEFAULT_THEME;
}

export function subscribeToTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

export function selectTheme(theme: Theme): void {
  if (theme === getTheme()) return;
  document.documentElement.dataset.theme = theme;
  writePreference(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export const themeInitializationScript =
  `document.documentElement.dataset.theme=(${resolvePreference.toString()})` +
  `((${readPreference.toString()})(${JSON.stringify(THEME_STORAGE_KEY)}),` +
  `${JSON.stringify(THEME_VALUES)},${JSON.stringify(DEFAULT_THEME)});`;
