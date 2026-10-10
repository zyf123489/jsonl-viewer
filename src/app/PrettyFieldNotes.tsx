import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { JsonSyntaxHighlight } from "./SearchHighlight";
import { locateJsonTokens } from "./prettySearch";
import { fieldPathKey, type FieldNoteMap, type FieldPath } from "./fieldNotes";
import type { TextMatch } from "./search";
import styles from "./FieldNotes.module.css";
import FieldNotesLayout from "./FieldNotesLayout";
import { useLanguage } from "./useLanguage";

interface FieldPosition {
  key: string;
  top: number;
}

export default function PrettyFieldNotes({ json, matches, activeId, notes, visible, width, onWidthChange, onEdit }: {
  json: string;
  matches: TextMatch[];
  activeId?: string;
  notes: FieldNoteMap;
  visible: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onEdit: (path: FieldPath) => void;
}) {
  const { t } = useLanguage();
  const layoutRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<FieldPosition[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fields = useMemo(() => {
    const paths = new Map<string, FieldPath>();
    const offsets = new Map<number, string>();
    for (const entry of locateJsonTokens(json) ?? []) {
      if (entry.role !== "key") continue;
      const key = fieldPathKey(entry.path);
      paths.set(key, entry.path);
      offsets.set(entry.token.start, key);
    }
    return { paths, offsets };
  }, [json]);
  const handleHover = useCallback((key: string | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (key === null) hoverTimer.current = setTimeout(() => setHovered(null), 180);
    else setHovered(key);
  }, []);
  useLayoutEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);
  useLayoutEffect(() => {
    const layout = layoutRef.current;
    const pre = layout?.querySelector<HTMLPreElement>("[data-json-body]");
    if (!layout || !pre) return;
    let frame = 0;
    let disposed = false;
    const measure = () => {
      frame = 0;
      if (disposed) return;
      const origin = layout.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(pre).lineHeight);
      const next: FieldPosition[] = [];
      for (const anchor of pre.querySelectorAll<HTMLElement>("[data-field-path]")) {
        const bounds = Array.from(anchor.getClientRects()).find((rectangle) => rectangle.height > 0);
        if (bounds) next.push({
          key: anchor.dataset.fieldPath!,
          top: bounds.top - origin.top - (lineHeight - bounds.height) / 2,
        });
      }
      setPositions((previous) => previous.length === next.length && previous.every((position, index) =>
        position.key === next[index].key && Math.abs(position.top - next[index].top) < 0.1,
      ) ? previous : next);
    };
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(layout);
    resize.observe(pre);
    const preferences = new MutationObserver(schedule);
    preferences.observe(document.documentElement, { attributes: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    document.fonts.ready.then(schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      preferences.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  }, [json, fields, visible, matches]);
  if (fields.paths.size === 0) return <JsonSyntaxHighlight json={json} matches={matches} activeId={activeId} />;
  return (
    <FieldNotesLayout className={styles.prettyNotesLayout} visible={visible} width={width} onWidthChange={onWidthChange}>
      <div ref={layoutRef} className={`${styles.prettyLayout} ${visible ? "" : styles.notesHidden}`} onMouseLeave={() => handleHover(null)}>
        <div className={styles.noteColumn} aria-label={t("Field notes")}>
          {visible && positions.map(({ key, top }) => {
            const entry = notes.get(key);
            if (!entry) return null;
            return <button
              type="button"
              key={key}
              className={`${styles.noteText} ${styles.positioned}`}
              style={{ top }}
              data-field-note={key}
              title={entry.note}
              aria-label={t("Edit field note {path}", { path: key })}
              onClick={() => onEdit(entry.path)}
            >{entry.note.replace(/\s+/g, " ")}</button>;
          })}
        </div>
        <div className={styles.controlColumn}>
          {positions.map(({ key, top }) => <button
            key={key}
            type="button"
            className={`${styles.editIcon} ${styles.positioned} ${hovered === key ? styles.active : ""}`}
            style={{ top }}
            aria-label={t(notes.has(key) ? "Edit field note {path}" : "Add field note {path}", { path: key })}
            title={t(notes.has(key) ? "Edit field note {path}" : "Add field note {path}", { path: key })}
            onMouseEnter={() => handleHover(key)}
            onMouseLeave={() => handleHover(null)}
            onClick={() => onEdit(fields.paths.get(key)!)}
          ><MessageSquare size={12} aria-hidden="true" /></button>)}
        </div>
        <JsonSyntaxHighlight json={json} matches={matches} activeId={activeId} fieldPaths={fields.offsets} onFieldHover={handleHover} />
      </div>
    </FieldNotesLayout>
  );
}
