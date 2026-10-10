"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  getDefaultTheme,
  getTheme,
  selectTheme,
  subscribeToTheme,
  THEMES,
} from "./theme";
import styles from "./SettingsPanel.module.css";
import ReadingSettings, { PreferenceSwitch } from "./ReadingSettings";
import { LANGUAGES, selectLanguage } from "./language";
import { useLanguage } from "./useLanguage";
import {
  getReadingPreferences,
  getDefaultReadingPreferences,
  subscribeToReadingPreferences,
  setReadingPreference,
} from "./readingPreferences";

interface SettingsPanelProps {
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

export default function SettingsPanel({ onClose, triggerRef }: SettingsPanelProps) {
  const [settingsPage, setSettingsPage] = useState<"home" | "theme" | "reading" | "language">("home");
  const { language, t } = useLanguage();
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getDefaultTheme);
  const preferences = useSyncExternalStore(
    subscribeToReadingPreferences, getReadingPreferences, getDefaultReadingPreferences,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const themeEntryRef = useRef<HTMLButtonElement>(null);
  const readingEntryRef = useRef<HTMLButtonElement>(null);
  const languageEntryRef = useRef<HTMLButtonElement>(null);
  const homeFocus = useRef<"theme" | "reading" | "language">("theme");
  const backdropPointerDown = useRef(false);
  const currentTheme = THEMES.find((option) => option.value === theme)!;
  const currentLanguage = LANGUAGES.find((option) => option.value === language)!;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      dialog.close();
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [triggerRef]);

  useEffect(() => {
    if (settingsPage === "home") {
      const entry = { theme: themeEntryRef, reading: readingEntryRef, language: languageEntryRef }[homeFocus.current];
      entry.current?.focus({ preventScroll: true });
    } else if (settingsPage === "theme" || settingsPage === "language") {
      dialogRef.current
        ?.querySelector<HTMLInputElement>("input:checked")
        ?.focus({ preventScroll: true });
    } else {
      dialogRef.current
        ?.querySelector<HTMLButtonElement>("[data-reading-controls] button:not(:disabled)")
        ?.focus({ preventScroll: true });
    }
  }, [settingsPage]);

  const isOutsidePanel = (clientX: number, clientY: number) => {
    const bounds = dialogRef.current?.getBoundingClientRect();
    return (
      bounds && (
        clientX < bounds.left || clientX > bounds.right ||
        clientY < bounds.top || clientY > bounds.bottom
      )
    );
  };

  return (
    <dialog
      ref={dialogRef}
      id="settings-dialog"
      className={styles.panel}
      aria-labelledby="settings-title"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        backdropPointerDown.current = Boolean(
          event.target === event.currentTarget && isOutsidePanel(event.clientX, event.clientY),
        );
      }}
      onClick={(event) => {
        if (backdropPointerDown.current && isOutsidePanel(event.clientX, event.clientY)) {
          onClose();
        }
        backdropPointerDown.current = false;
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className={styles.header}>
        {settingsPage !== "home" && (
          <button
            type="button"
            className={styles.backButton}
            onClick={() => setSettingsPage("home")}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            {t("Back")}
          </button>
        )}
        <h2 id="settings-title" className={styles.title}>
          {t(({ home: "Settings", theme: "Theme", reading: "JSON Reading", language: "Language" } as const)[settingsPage])}
        </h2>
        <button
          type="button"
          className={styles.closeButton}
          aria-label={t("Close settings")}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.content}>
        {settingsPage === "home" ? (
          <div className={styles.homeEntries}>
            <button
              ref={themeEntryRef}
              type="button"
              className={styles.themeEntry}
              onClick={() => {
                homeFocus.current = "theme";
                setSettingsPage("theme");
              }}
            >
              <span>{t("Theme")}</span>
              <span className={styles.currentTheme}>{t(currentTheme.label)}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button
              ref={readingEntryRef}
              type="button"
              className={styles.themeEntry}
              onClick={() => {
                homeFocus.current = "reading";
                setSettingsPage("reading");
              }}
            >
              <span>{t("JSON Reading")}</span>
              <ChevronRight size={16} className={styles.entryArrow} aria-hidden="true" />
            </button>
            <button
              ref={languageEntryRef}
              type="button"
              className={styles.themeEntry}
              onClick={() => {
                homeFocus.current = "language";
                setSettingsPage("language");
              }}
            >
              <span>{t("Language")}</span>
              <span className={styles.currentTheme}>{currentLanguage.label}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <PreferenceSwitch
              label={t("Show Record Sizes")}
              checked={preferences.showRecordSizes}
              onChange={() => setReadingPreference("showRecordSizes", !preferences.showRecordSizes)}
            />
          </div>
        ) : settingsPage === "reading" ? (
          <ReadingSettings preferences={preferences} />
        ) : settingsPage === "language" ? (
          <>
            <fieldset className={styles.themeGroup}>
              <legend className={styles.visuallyHidden}>{t("Language")}</legend>
              {LANGUAGES.map((option) => (
                <label key={option.value} className={styles.themeOption}>
                  <input type="radio" name="language" value={option.value} checked={language === option.value} onChange={() => selectLanguage(option.value)} className={styles.radio} />
                  <span>{option.label}</span>
                  {language === option.value && <Check size={18} aria-hidden="true" />}
                </label>
              ))}
            </fieldset>
            <p className={styles.languageHint}>{t("Choose your interface language. Your choice is saved in this browser.")}</p>
          </>
        ) : (
          <fieldset className={styles.themeGroup}>
            <legend className={styles.visuallyHidden}>{t("Theme")}</legend>
            {THEMES.map((option) => (
              <label key={option.value} className={styles.themeOption}>
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={theme === option.value}
                  onChange={() => selectTheme(option.value)}
                  className={styles.radio}
                />
                <span>{t(option.label)}</span>
                {theme === option.value && <Check size={18} aria-hidden="true" />}
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </dialog>
  );
}
