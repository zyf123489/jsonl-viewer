"use client";

import { Check, Minus, Plus } from "lucide-react";
import {
  FONT_SIZE_RANGE,
  LINE_HEIGHTS,
  resetReadingPreferences,
  setReadingPreference,
  type ReadingPreferences,
} from "./readingPreferences";
import styles from "./SettingsPanel.module.css";

export function PreferenceSwitch({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.preferenceSwitch}
      onClick={onChange}
    >
      <span>{label}</span>
      <span className={styles.switchState} aria-hidden="true">{checked ? "On" : "Off"}</span>
      <span className={`${styles.switchTrack} ${checked ? styles.switchOn : ""}`} aria-hidden="true">
        <span className={styles.switchThumb} />
      </span>
    </button>
  );
}

export default function ReadingSettings({ preferences }: { preferences: ReadingPreferences }) {
  return (
    <div className={styles.readingSettings} data-reading-controls>
      <fieldset className={styles.readingGroup}>
        <legend>Font Size</legend>
        <div className={styles.fontSizeControls}>
          <button
            type="button"
            className={styles.stepButton}
            aria-label="Decrease JSON font size"
            disabled={preferences.fontSize <= FONT_SIZE_RANGE.min}
            onClick={() => setReadingPreference("fontSize", Math.max(FONT_SIZE_RANGE.min, preferences.fontSize - 1))}
          >
            <Minus size={18} aria-hidden="true" />
          </button>
          <output className={styles.fontSizeValue} aria-label="JSON font size" aria-live="polite">
            {preferences.fontSize} px
          </output>
          <button
            type="button"
            className={styles.stepButton}
            aria-label="Increase JSON font size"
            disabled={preferences.fontSize >= FONT_SIZE_RANGE.max}
            onClick={() => setReadingPreference("fontSize", Math.min(FONT_SIZE_RANGE.max, preferences.fontSize + 1))}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      </fieldset>
      <fieldset className={styles.readingGroup}>
        <legend>Line Height</legend>
        <div className={styles.heightOptions}>
          {LINE_HEIGHTS.map((option) => (
            <label key={option.value} className={styles.heightOption}>
              <input
                type="radio"
                name="json-line-height"
                checked={preferences.lineHeight === option.value}
                onChange={() => setReadingPreference("lineHeight", option.value)}
                className={styles.radio}
              />
              <span>{option.label}</span>
              <span className={styles.heightCheck}>
                {preferences.lineHeight === option.value && <Check size={16} aria-hidden="true" />}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <PreferenceSwitch
        label="Wrap Long Lines"
        checked={preferences.wrapLongLines}
        onChange={() => setReadingPreference("wrapLongLines", !preferences.wrapLongLines)}
      />
      <button type="button" className={styles.resetButton} onClick={resetReadingPreferences}>
        Reset Reading Settings
      </button>
    </div>
  );
}
