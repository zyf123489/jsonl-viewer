import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import styles from "./FieldNotes.module.css";
import { useLanguage } from "./useLanguage";

export const DEFAULT_FIELD_NOTES_WIDTH = 88;
const MIN_WIDTH = 48;
const MAX_WIDTH = 320;

export default function FieldNotesLayout({ children, className, visible, width, onWidthChange, inset = 0 }: {
  children: ReactNode;
  className: string;
  visible: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  inset?: number;
}) {
  const { t } = useLanguage();
  const layoutRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ clientX: number; width: number } | null>(null);
  const [availableWidth, setAvailableWidth] = useState(MAX_WIDTH / 0.4);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [resizing, setResizing] = useState(false);
  const maximum = Math.max(0, Math.min(MAX_WIDTH, availableWidth * 0.4));
  const minimum = Math.min(MIN_WIDTH, maximum);
  const gutterWidth = Math.min(width, maximum);
  const clamp = (next: number) => Math.max(minimum, Math.min(maximum, next));

  useLayoutEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    const measure = () => setAvailableWidth(layout.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(layout);
    measure();
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={layoutRef}
      className={`${styles.notesLayout} ${className} ${resizing ? styles.resizing : ""}`}
      style={{ "--field-note-width": `${gutterWidth}px` } as CSSProperties}
      onScrollCapture={(event) => {
        if (event.target instanceof HTMLElement && event.target.dataset.readingScroll === "tree") {
          setScrollLeft(event.target.scrollLeft);
        }
      }}
    >
      {children}
      {visible && <div
        className={styles.notesResizer}
        style={{ left: gutterWidth + inset - 1 - scrollLeft }}
        role="separator"
        aria-label={t("Resize field notes")}
        aria-orientation="vertical"
        aria-valuemin={Math.round(minimum)}
        aria-valuemax={Math.round(maximum)}
        aria-valuenow={Math.round(gutterWidth)}
        tabIndex={0}
        title={t("Drag to resize field notes. Double-click to reset width.")}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { clientX: event.clientX, width: gutterWidth };
          setResizing(true);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          onWidthChange(clamp(drag.current.width + event.clientX - drag.current.clientX));
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          drag.current = null;
          setResizing(false);
        }}
        onLostPointerCapture={() => { drag.current = null; setResizing(false); }}
        onDoubleClick={() => onWidthChange(DEFAULT_FIELD_NOTES_WIDTH)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const next = event.key === "Home" ? minimum : event.key === "End" ? maximum : gutterWidth + (event.key === "ArrowLeft" ? -8 : 8);
          onWidthChange(clamp(next));
        }}
      />}
    </div>
  );
}
