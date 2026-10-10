import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { fieldPathKey, parseFieldNotesTemplate, type FieldPath, type FieldNotesTemplateV1, type NoteMergeCounts } from "./fieldNotes";
import styles from "./FieldNotes.module.css";
import { useLanguage } from "./useLanguage";
import { translateError, type MessageKey } from "./i18n";

const EXAMPLE_TEMPLATE = JSON.stringify({
  format: "jsonl-viewer-field-notes",
  version: 1,
  notes: [
    { path: ["window_start"], note: "Window start time" },
    { path: ["processing", "duration_ms"], note: "Processing duration (ms)" },
    { path: ["reasons", 0, "type"], note: "First reason type" },
  ],
} satisfies FieldNotesTemplateV1, null, 2);

function downloadExampleTemplate() {
  const url = URL.createObjectURL(new Blob([EXAMPLE_TEMPLATE + "\n"], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "field-notes.example.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface NotesFile {
  id: string;
  name: string;
  displayName?: string;
}

export interface NotesApplyResult extends NoteMergeCounts {
  files: number;
}

function NotesDialog({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const composing = useRef(false);
  const backdropPress = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
    };
  }, []);
  const outside = (clientX: number, clientY: number) => {
    const bounds = dialogRef.current?.getBoundingClientRect();
    return Boolean(bounds && (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom));
  };
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-modal="true"
      aria-labelledby="field-notes-dialog-title"
      onCompositionStartCapture={() => { composing.current = true; }}
      onCompositionEndCapture={() => { composing.current = false; }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && (event.nativeEvent.isComposing || composing.current || event.keyCode === 229)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!composing.current) onClose();
      }}
      onPointerDown={(event) => {
        backdropPress.current = event.target === event.currentTarget && outside(event.clientX, event.clientY);
      }}
      onClick={(event) => {
        if (backdropPress.current && outside(event.clientX, event.clientY)) onClose();
        backdropPress.current = false;
      }}
      onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }}
      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); }}
    >
      <h2 id="field-notes-dialog-title">{title}</h2>
      {children}
    </dialog>
  );
}

export function FieldNoteEditor({ file, path, existingNote, onSave, onDelete, onClose }: {
  file: NotesFile;
  path: FieldPath;
  existingNote?: string;
  onSave: (note: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(existingNote ?? "");
  const [error, setError] = useState(false);
  const { t } = useLanguage();
  return (
    <NotesDialog title={t("Field Note")} onClose={onClose}>
      <div className={styles.metadata}>{t("File:")} <strong>{file.displayName ?? file.name}</strong></div>
      <div className={styles.metadata}>{t("Field path:")} <code>{fieldPathKey(path)}</code></div>
      <label className={styles.inputLabel} htmlFor="field-note-text">{t("Note")}</label>
      <textarea
        id="field-note-text"
        autoFocus
        value={draft}
        onChange={(event) => { setDraft(event.target.value); setError(false); }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "field-note-error" : "field-notes-session"}
        rows={5}
      />
      {error && <p id="field-note-error" className={styles.error} role="alert">{t("Enter a non-empty note. Use Delete to remove an existing note.")}</p>}
      <p id="field-notes-session" className={styles.hint}>{t("Notes stay in this page only. Refreshing or closing a file discards them; add or import them again.")}</p>
      <div className={styles.actions}>
        {existingNote !== undefined && <button type="button" className={styles.deleteButton} onClick={onDelete}>{t("Delete")}</button>}
        <button type="button" onClick={onClose}>{t("Cancel")}</button>
        <button type="button" className={styles.primaryButton} onClick={() => {
          const note = draft.trim();
          if (!note) { setError(true); return; }
          onSave(note);
        }}>{t("Save")}</button>
      </div>
    </NotesDialog>
  );
}

export function FieldNotesImport({ files, activeFileId, onApply, onClose }: {
  files: readonly NotesFile[];
  activeFileId: string | null;
  onApply: (template: FieldNotesTemplateV1, fileIds: ReadonlySet<string>, overwrite: boolean) => NotesApplyResult;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [template, setTemplate] = useState<FieldNotesTemplateV1 | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(activeFileId ? [activeFileId] : []));
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState<{ failure: unknown; fallback: MessageKey } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NotesApplyResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    const available = new Set(files.map((file) => file.id));
    setSelected((previous) => {
      if ([...previous].every((id) => available.has(id))) return previous;
      return new Set([...previous].filter((id) => available.has(id)));
    });
  }, [files]);
  const selectedAvailable = files.filter((file) => selected.has(file.id));
  return (
    <NotesDialog title={t("Import Field Notes")} onClose={onClose}>
      <label className={styles.inputLabel} htmlFor="field-notes-template">{t("Choose a v1 JSON template")}</label>
      <input ref={fileInputRef} hidden id="field-notes-template" type="file" accept=".json,application/json" disabled={Boolean(result)} onChange={async (event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        const revision = ++request.current;
        setLoading(true);
        setTemplate(null);
        setError(null);
        setTemplateName(file.name);
        try {
          const parsed = parseFieldNotesTemplate(await file.text());
          if (revision === request.current) setTemplate(parsed);
        } catch (failure) {
          if (revision === request.current) setError({ failure, fallback: "Unable to read this template." });
        } finally {
          if (revision === request.current) setLoading(false);
        }
      }} />
      <div className={styles.filePicker}>
        <button type="button" disabled={Boolean(result)} onClick={() => fileInputRef.current?.click()} aria-describedby="field-notes-file-name">{t("Choose file")}</button>
        <span id="field-notes-file-name" aria-live="polite" aria-atomic="true">{templateName || t("No file selected")}</span>
      </div>
      <details className={styles.templateExample}>
        <summary>{t("Example template")}</summary>
        <p className={styles.hint}>{t("Use path segments to identify the original field. Strings are field names; numbers are exact array indices. Change the note text to your own descriptions.")}</p>
        <pre aria-label={t("Example template JSON")}><code>{EXAMPLE_TEMPLATE}</code></pre>
        <button type="button" onClick={downloadExampleTemplate}>{t("Download example")}</button>
        <p className={styles.hint}>{t("Edit the downloaded JSON, then choose it above and select which open files to apply it to. Viewing or downloading the example does not apply any notes.")}</p>
      </details>
      {loading && <p role="status">{t("Reading template…")}</p>}
      {error && <p className={styles.error} role="alert">{translateError(error.failure, t, error.fallback)}</p>}
      {template && (
        <>
          <p className={styles.metadata}>{t("Template:")} <strong>{templateName}</strong> · {t("{count} field notes", { count: template.notes.length })}</p>
          <div className={styles.preview} aria-label={t("Template preview")}>
            {template.notes.map((entry) => <div className={styles.previewRow} key={fieldPathKey(entry.path)}>
              <code>{fieldPathKey(entry.path)}</code><span>{entry.note}</span>
            </div>)}
          </div>
          <p className={styles.hint}>{t("Shown only where the exact field exists. Array indices are exact, not wildcards.")}</p>
          <fieldset disabled={Boolean(result)} className={styles.fileSelection}>
            <legend>{t("Apply to open files")}</legend>
            <div className={styles.selectionActions}>
              <button type="button" onClick={() => setSelected(new Set(files.map((file) => file.id)))}>{t("Select all")}</button>
              <button type="button" onClick={() => setSelected(new Set())}>{t("Deselect all")}</button>
            </div>
            <div className={styles.fileList}>
              {files.map((file) => <label key={file.id} className={styles.checkboxLabel}>
                <input type="checkbox" value={file.id} checked={selected.has(file.id)} onChange={(event) => {
                  const checked = event.target.checked;
                  setSelected((previous) => {
                    const next = new Set(previous);
                    if (checked) next.add(file.id);
                    else next.delete(file.id);
                    return next;
                  });
                }} />
                <span>{file.displayName ?? file.name}</span>
              </label>)}
            </div>
            {files.length === 0 && <p className={styles.hint}>{t("Open a log file before applying notes.")}</p>}
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
              <span>{t("Overwrite existing notes at the same paths")}</span>
            </label>
            <p className={styles.hint}>{t("By default, existing notes are kept. Notes at other paths are never removed.")}</p>
          </fieldset>
        </>
      )}
      {result && <p role="status" className={styles.result}>
        {t("Applied to {files} files: {added} added, {overwritten} overwritten, {retained} retained, {unchanged} unchanged.", { ...result })}
      </p>}
      <p className={styles.hint}>{t("Notes stay in this page only. Templates are read locally and are never uploaded.")}</p>
      <div className={styles.actions}>
        <button type="button" onClick={onClose}>{t(result ? "Done" : "Cancel")}</button>
        {!result && <button type="button" className={styles.primaryButton} disabled={!template || loading || selectedAvailable.length === 0} onClick={() => {
          if (!template) return;
          try { setResult(onApply(template, new Set(selectedAvailable.map((file) => file.id)), overwrite)); }
          catch (failure) { setError({ failure, fallback: "Unable to apply notes." }); }
        }}>{t("Apply")}</button>}
      </div>
    </NotesDialog>
  );
}
