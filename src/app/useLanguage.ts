"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getDefaultLanguage, getLanguage, subscribeToLanguage } from "./language";
import { createTranslator } from "./i18n";

export function useLanguage() {
  const language = useSyncExternalStore(subscribeToLanguage, getLanguage, getDefaultLanguage);
  const translate = useMemo(() => createTranslator(language), [language]);
  return { language, t: translate };
}
