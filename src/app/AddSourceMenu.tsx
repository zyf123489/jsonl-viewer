"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, FileUp, ClipboardPaste } from "lucide-react";
import { useLanguage } from "./useLanguage";
import styles from "./page.module.css";

export default function AddSourceMenu({ onOpenFile, onPaste }: {
  onOpenFile: () => void;
  onPaste: (trigger: HTMLElement | null) => void;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setExpanded(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      event.stopPropagation();
      setExpanded(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);
  return (
    <div className={styles.addSource} ref={container}>
      <button id="add-source-trigger" ref={trigger} type="button" className={styles.addFileBtn} aria-expanded={expanded} aria-controls={expanded ? "add-source-options" : undefined} onClick={() => setExpanded(!expanded)}>
        <Plus size={16} aria-hidden="true" />{t("Add File")}
      </button>
      {expanded && <div id="add-source-options" className={styles.addSourceOptions}>
        <button type="button" onClick={() => { setExpanded(false); onOpenFile(); }}><FileUp size={16} aria-hidden="true" />{t("Open File")}</button>
        <button type="button" aria-haspopup="dialog" onClick={() => { setExpanded(false); onPaste(trigger.current); }}><ClipboardPaste size={16} aria-hidden="true" />{t("Paste Logs")}</button>
      </div>}
    </div>
  );
}
