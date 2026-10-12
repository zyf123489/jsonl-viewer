"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { analyzePaste, createTextPaste, PASTE_PREVIEW_LIMIT, PASTE_SIZE_WARNING_BYTES, utf8Size, type PasteAnalysis, type PasteInput } from "./pasteLogs";
import { useLanguage } from "./useLanguage";
import type { MessageKey } from "./i18n";
import styles from "./PasteLogs.module.css";

type PasteAction = "logs" | "text" | "lines";
type LineAnalysis = Extract<PasteAnalysis, { format: "jsonl" }>;

export default function PasteLogsDialog({ trigger, onOpen, onClose }: {
  trigger: HTMLElement | null;
  onOpen: (input: PasteInput) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<{ revision: number; analysis: LineAnalysis } | null>(null);
  const [warning, setWarning] = useState<PasteAction | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(false);
  const locked = useRef(false);
  const request = useRef(0);
  const revision = useRef(0);
  const sizeConsent = useRef<number | null>(null);
  const composing = useRef(false);
  const backdropPress = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const dialog = dialogRef.current;
    dialog?.showModal();
    inputRef.current?.focus();
    return () => {
      mounted.current = false;
      request.current += 1;
      dialog?.close();
      const returnFocus = trigger?.isConnected ? trigger : document.getElementById("add-source-trigger");
      returnFocus?.focus({ preventScroll: true });
    };
  }, [trigger]);

  const close = () => {
    mounted.current = false;
    request.current += 1;
    onClose();
  };

  const run = async (action: PasteAction, consent = false) => {
    if (locked.current || !mounted.current || composing.current) return;
    if (!draft.trim()) {
      setError("Paste some log content first.");
      inputRef.current?.focus();
      return;
    }
    locked.current = true;
    setBusy(true);
    setError(null);
    setWarning(null);
    const ticket = ++request.current;
    const draftRevision = revision.current;
    const isCurrent = () => mounted.current && request.current === ticket && revision.current === draftRevision;
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      if (!isCurrent()) return;
      if (consent) sizeConsent.current = draftRevision;
      if (sizeConsent.current !== draftRevision && utf8Size(draft) > PASTE_SIZE_WARNING_BYTES) {
        setWarning(action);
        return;
      }
      let input: PasteInput;
      if (action === "text") {
        input = createTextPaste(draft);
      } else if (action === "lines") {
        if (!preview || preview.revision !== draftRevision) return;
        input = { format: "jsonl", originalText: draft, records: preview.analysis.records };
      } else {
        const analysis = analyzePaste(draft);
        if (analysis.format === "jsonl") {
          if (isCurrent()) setPreview({ revision: draftRevision, analysis });
          return;
        }
        input = { format: "json", originalText: draft, records: analysis.records };
      }
      if (!isCurrent()) return;
      onOpen(input);
      close();
    } catch {
      if (isCurrent()) setError("Unable to open this content. No source was created. Try a smaller input.");
    } finally {
      if (isCurrent()) {
        locked.current = false;
        setBusy(false);
      }
    }
  };

  const outside = (clientX: number, clientY: number) => {
    const bounds = dialogRef.current?.getBoundingClientRect();
    return Boolean(bounds && (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom));
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-modal="true"
      aria-labelledby="paste-logs-title"
      aria-busy={busy}
      onCompositionStartCapture={() => { composing.current = true; }}
      onCompositionEndCapture={() => { composing.current = false; }}
      onKeyDownCapture={(event) => {
        if (event.key === "Tab") {
          const controls = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), textarea");
          const first = controls?.[0];
          const last = controls?.[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
        if ((event.key === "Escape" || (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement))) && (event.nativeEvent.isComposing || composing.current || event.keyCode === 229)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onCancel={(event) => { event.preventDefault(); if (!composing.current) close(); }}
      onPointerDown={(event) => {
        backdropPress.current = event.target === event.currentTarget && outside(event.clientX, event.clientY);
      }}
      onClick={(event) => {
        if (backdropPress.current && outside(event.clientX, event.clientY)) close();
        backdropPress.current = false;
      }}
      onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }}
      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); }}
    >
      <div className={styles.heading}>
        <h2 id="paste-logs-title">{t("Paste Logs")}</h2>
        <button type="button" onClick={close} aria-label={t("Close paste logs")}><X size={18} aria-hidden="true" /></button>
      </div>
      <label className={styles.label} htmlFor="paste-logs-input">{t("Log content")}</label>
      <textarea
        ref={inputRef}
        id="paste-logs-input"
        value={draft}
        readOnly={busy}
        rows={8}
        spellCheck={false}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "paste-logs-error paste-logs-hint" : "paste-logs-hint"}
        placeholder={t("Paste JSON, JSONL, or original log text here")}
        onChange={(event) => {
          revision.current += 1;
          request.current += 1;
          sizeConsent.current = null;
          locked.current = false;
          setBusy(false);
          setDraft(event.target.value);
          setPreview(null);
          setWarning(null);
          setError(null);
        }}
      />
      <p id="paste-logs-hint" className={styles.hint}>{t("Content is processed locally and stays in this page only. Refreshing or closing the source discards it. Logs are not repaired or completed.")}</p>
      {error && <p id="paste-logs-error" className={styles.error} role="alert">{t(error)}</p>}
      {preview && (
        <section className={styles.preview} aria-label={t("Line parsing preview")}>
          <p>{t("The whole input is not valid complete JSON.")}</p>
          <p role="status">{t("{total} non-empty records: {valid} valid, {invalid} invalid.", { total: preview.analysis.records.length, valid: preview.analysis.validCount, invalid: preview.analysis.invalidCount })}</p>
          <p className={styles.hint}>{t(preview.analysis.validCount === 0 ? "No records can be structurally parsed. Opening as text is recommended; opening all lines is still available." : "Invalid lines are preserved without repair. For incomplete multiline JSON, opening as text is recommended.")}</p>
          <p className={styles.hint}>{t("Only the first {count} candidate lines are previewed; all non-empty lines will be opened.", { count: PASTE_PREVIEW_LIMIT })}</p>
          <div className={styles.previewScroll}>
            <table>
              <thead><tr><th>{t("Source line")}</th><th>{t("Status")}</th><th>{t("Content summary")}</th></tr></thead>
              <tbody>{preview.analysis.previews.map((entry) => (
                <tr key={entry.lineNumber}>
                  <td>{entry.lineNumber}</td><td>{t(entry.recordKind === "json" ? "Valid" : "Invalid")}</td><td><code>{entry.summary}</code></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
      {warning && (
        <section className={styles.warning} role="alert">
          <p>{t("This input exceeds 5 MiB (UTF-8). Parsing may freeze the browser and use substantial memory. Nothing will be truncated. Continue with this draft?")}</p>
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={() => { setWarning(null); inputRef.current?.focus(); }}>{t("Return to editing")}</button>
            <button type="button" disabled={busy} onClick={() => void run(warning, true)}>{t("Continue opening")}</button>
          </div>
        </section>
      )}
      {busy && <p className={styles.hint} role="status">{t("Processing content…")}</p>}
      <div className={styles.actions}>
        <button type="button" onClick={close}>{t("Cancel")}</button>
        <button type="button" disabled={busy || warning !== null} onClick={() => void run("text")}>{t("Open as Text")}</button>
        <button type="button" className={styles.primaryButton} disabled={busy || warning !== null} onClick={() => void run(preview ? "lines" : "logs")}>{t(preview ? "Open Lines" : "Open Logs")}</button>
      </div>
    </dialog>
  );
}
