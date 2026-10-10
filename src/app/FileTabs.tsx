"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { RotateCcw, X } from "lucide-react";
import { normalizeFileDisplayName } from "./fileDisplayName";
import FileNameTooltip from "./FileNameTooltip";
import styles from "./FileTabs.module.css";

interface TabFile {
  id: string;
  name: string;
  displayName?: string;
  lines: readonly unknown[];
}

interface FileTabsProps {
  files: readonly TabFile[];
  activeFileId: string | null;
  onSelect: (fileId: string) => void;
  onSaveName: (fileId: string, displayName: string | undefined) => void;
  onClose: (fileId: string, event: MouseEvent<HTMLButtonElement>) => void;
}

interface EditSession {
  sessionId: number;
  fileId: string;
  originalName: string;
  draft: string;
}

type EditOutcome = "save" | "cancel" | "restore";

export default function FileTabs({ files, activeFileId, onSelect, onSaveName, onClose }: FileTabsProps) {
  const [editing, setEditing] = useState<EditSession | null>(null);
  const [heldNameWidth, setHeldNameWidth] = useState<{ fileId: string; width: number } | null>(null);
  const [hoveredName, setHoveredName] = useState<{ fileId: string; anchor: HTMLElement } | null>(null);
  const tooltipId = useId();
  const dismissTooltip = useCallback(() => setHoveredName(null), []);
  const editingRef = useRef<EditSession | null>(null);
  const sessionSequence = useRef(0);
  const composingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const nameControls = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);

  const finishEditing = useCallback((outcome: EditOutcome, sessionId: number, restoreFocus = false) => {
    const session = editingRef.current;
    if (!session || session.sessionId !== sessionId) return;
    editingRef.current = null;
    composingRef.current = false;
    pendingFocus.current = restoreFocus ? session.fileId : null;
    if (restoreFocus) setHeldNameWidth(null);
    setEditing(null);
    if (outcome !== "cancel") {
      onSaveName(session.fileId, outcome === "restore" ? undefined
        : normalizeFileDisplayName(session.draft, session.originalName));
    }
  }, [onSaveName]);

  const beginEditing = (file: TabFile) => {
    dismissTooltip();
    setHeldNameWidth(null);
    const previous = editingRef.current;
    if (previous?.fileId === file.id) return;
    if (previous) finishEditing("save", previous.sessionId);
    onSelect(file.id);
    const session = {
      sessionId: ++sessionSequence.current,
      fileId: file.id,
      originalName: file.name,
      draft: file.displayName ?? file.name,
    };
    editingRef.current = session;
    setEditing(session);
  };

  useLayoutEffect(() => {
    if (editing) {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    } else if (pendingFocus.current) {
      nameControls.current.get(pendingFocus.current)?.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  }, [editing?.sessionId]);

  useLayoutEffect(() => {
    const session = editingRef.current;
    if (!session) return;
    if (!files.some((file) => file.id === session.fileId)) {
      finishEditing("cancel", session.sessionId);
    } else if (activeFileId !== session.fileId) {
      finishEditing("save", session.sessionId);
    }
  }, [files, activeFileId, finishEditing]);

  const hoveredFile = editing ? undefined : files.find((file) => file.id === hoveredName?.fileId);

  return (
    <div
      className={styles.tabBar}
      aria-label="已打开的文件"
      onPointerDownCapture={(event) => {
        const session = editingRef.current;
        const editorContainer = editorContainerRef.current;
        if (session && editorContainer && !editorContainer.contains(event.target as Node)) {
          setHeldNameWidth({ fileId: session.fileId, width: editorContainer.getBoundingClientRect().width });
        }
      }}
      onPointerLeave={() => setHeldNameWidth(null)}
    >
      {files.map((file) => {
        const label = file.displayName ?? file.name;
        const session = editing?.fileId === file.id ? editing : null;
        return (
          <div
            key={file.id}
            data-file-id={file.id}
            className={`${styles.fileTab} ${file.id === activeFileId ? styles.fileTabActive : ""}`}
            onClick={() => onSelect(file.id)}
          >
            {session ? (
              <div
                ref={editorContainerRef}
                className={styles.nameEditor}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Escape" && !composingRef.current && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    finishEditing("cancel", session.sessionId, true);
                  }
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    finishEditing("save", session.sessionId);
                  }
                }}
              >
                <input
                  ref={inputRef}
                  className={styles.nameInput}
                  aria-label={`编辑文件显示名称：${file.name}`}
                  type="text"
                  value={session.draft}
                  style={{ width: `${Math.min(28, Math.max(12, [...session.draft].length + 1))}ch` }}
                  onChange={(event) => {
                    const current = editingRef.current;
                    if (!current || current.sessionId !== session.sessionId) return;
                    const updated = { ...current, draft: event.target.value };
                    editingRef.current = updated;
                    setEditing(updated);
                  }}
                  onCompositionStart={() => { composingRef.current = true; }}
                  onCompositionEnd={() => { composingRef.current = false; }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (composingRef.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
                    if (event.key === "Enter" || event.key === "Escape") {
                      event.preventDefault();
                      finishEditing(event.key === "Enter" ? "save" : "cancel", session.sessionId, true);
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.restoreButton}
                  aria-label="恢复原文件名"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => finishEditing("restore", session.sessionId, true)}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                ref={(control) => {
                  if (control) nameControls.current.set(file.id, control);
                  else nameControls.current.delete(file.id);
                }}
                className={styles.fileTabName}
                style={{ width: heldNameWidth?.fileId === file.id ? heldNameWidth.width : undefined }}
                aria-label={`文件名称：${label}，原文件名：${file.name}`}
                aria-current={file.id === activeFileId ? "page" : undefined}
                aria-describedby={hoveredFile?.id === file.id ? tooltipId : undefined}
                onMouseEnter={(event) => {
                  if (!editingRef.current) setHoveredName({ fileId: file.id, anchor: event.currentTarget });
                }}
                onMouseLeave={dismissTooltip}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  beginEditing(file);
                }}
                onKeyDown={(event) => {
                  if (event.key === "F2") {
                    event.preventDefault();
                    event.stopPropagation();
                    beginEditing(file);
                  }
                }}
              >
                {label}
              </button>
            )}
            <span className={styles.fileTabCount}>{file.lines.length}</span>
            <button
              type="button"
              className={styles.fileTabClose}
              aria-label={`关闭文件：${file.name}`}
              onPointerDown={() => {
                const current = editingRef.current;
                if (current?.fileId === file.id) finishEditing("cancel", current.sessionId);
              }}
              onClick={(event) => {
                dismissTooltip();
                setHeldNameWidth(null);
                const current = editingRef.current;
                if (current?.fileId === file.id) finishEditing("cancel", current.sessionId);
                onClose(file.id, event);
              }}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        );
      })}
      {hoveredFile && hoveredName && (
        <FileNameTooltip
          anchor={hoveredName.anchor}
          originalName={hoveredFile.name}
          id={tooltipId}
          onDismiss={dismissTooltip}
        />
      )}
    </div>
  );
}
