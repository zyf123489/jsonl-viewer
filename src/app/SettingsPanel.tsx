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
  const [settingsPage, setSettingsPage] = useState<"home" | "theme" | "reading">("home");
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getDefaultTheme);
  const preferences = useSyncExternalStore(
    subscribeToReadingPreferences, getReadingPreferences, getDefaultReadingPreferences,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const themeEntryRef = useRef<HTMLButtonElement>(null);
  const readingEntryRef = useRef<HTMLButtonElement>(null);
  const homeFocus = useRef<"theme" | "reading">("theme");
  const backdropPointerDown = useRef(false);
  const currentTheme = THEMES.find((option) => option.value === theme)!;

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
      const entry = homeFocus.current === "reading" ? readingEntryRef : themeEntryRef;
      entry.current?.focus({ preventScroll: true });
    } else if (settingsPage === "theme") {
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
            Back
          </button>
        )}
        <h2 id="settings-title" className={styles.title}>
          {settingsPage === "home" ? "Settings" : settingsPage === "theme" ? "Theme" : "JSON Reading"}
        </h2>
        <button
          type="button"
          className={styles.closeButton}
          aria-label="Close settings"
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
              <span>Theme</span>
              <span className={styles.currentTheme}>{currentTheme.label}</span>
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
              <span>JSON Reading</span>
              <ChevronRight size={16} className={styles.entryArrow} aria-hidden="true" />
            </button>
            <PreferenceSwitch
              label="Show Record Sizes"
              checked={preferences.showRecordSizes}
              onChange={() => setReadingPreference("showRecordSizes", !preferences.showRecordSizes)}
            />
          </div>
        ) : settingsPage === "reading" ? (
          <ReadingSettings preferences={preferences} />
        ) : (
          <fieldset className={styles.themeGroup}>
            <legend className={styles.visuallyHidden}>Theme</legend>
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
                <span>{option.label}</span>
                {theme === option.value && <Check size={18} aria-hidden="true" />}
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </dialog>
  );
}
