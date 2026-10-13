"use client";

import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { List, type ListImperativeAPI } from "react-window";
import styles from "./page.module.css";
import {
  getShowRecordSizes,
  getDefaultShowRecordSizes,
  subscribeToReadingPreferences,
} from "./readingPreferences";
import SettingsPanel from "./SettingsPanel";
import FileTabs from "./FileTabs";
import AddSourceMenu from "./AddSourceMenu";
import PasteLogsDialog from "./PasteLogsDialog";
import { SearchText, revealTextMatch } from "./SearchHighlight";
import PrettyFieldNotes from "./PrettyFieldNotes";
import { DEFAULT_FIELD_NOTES_WIDTH } from "./FieldNotesLayout";
import { useLanguage } from "./useLanguage";
import { createTranslator, LocalizedError } from "./i18n";
import { getLanguage } from "./language";
import { type JsonLine, type SourceInfo, type PasteInput } from "./pasteLogs";
import { FieldNoteEditor, FieldNotesImport, type NotesApplyResult } from "./FieldNotesDialogs";
import { EMPTY_FIELD_NOTES, fieldPathKey, mergeFieldNotes, type FieldNoteMap, type FieldPath, type FieldNotesTemplateV1 } from "./fieldNotes";
import { captureReadingPosition, restoreReadingPosition } from "./readingPosition";
import { createSearchQuery, containsQuery, findTextMatches } from "./search";
import { createPrettyMapping, findPrettyMatches } from "./prettySearch";
import { buildTreeSearchModel } from "./treeSearch";
import TreeView from "./SearchTree";
import {
  ArrowDownAz,
  ArrowUpAz,
  Check,
  Copy,
  FileUp,
  Search,
  File,
  ArrowUp,
  ArrowDown,
  Settings,
} from "lucide-react";

interface FileData {
  id: string;
  name: string;
  displayName?: string;
  lines: JsonLine[];
  filter: string; // Per-file filter
  sortOrder: "asc" | "desc"; // Per-file sort order
  selectedId: number | null;
  treePath: string | null;
  fieldNotes: FieldNoteMap;
  source: SourceInfo;
}

type ViewTab = "raw" | "pretty" | "tree";

// Format byte size
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function Home() {
  const { t } = useLanguage();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesVisible, setNotesVisible] = useState(true);
  const [notesWidth, setNotesWidth] = useState(DEFAULT_FIELD_NOTES_WIDTH);
  const [treeSplitPercent, setTreeSplitPercent] = useState(50);
  const [notesImportOpen, setNotesImportOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const pasteTrigger = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteSequence = useRef(0);
  const [noteEditor, setNoteEditor] = useState<{ fileId: string; path: FieldPath } | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const [files, setFiles] = useState<FileData[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>("pretty");
  const [matchCursor, setMatchCursor] = useState({ context: "", index: 0, revision: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);
  const listRef = useRef<ListImperativeAPI>(null);
  const displayedFileId = useRef<string | null>(null);
  const detailContentRef = useRef<HTMLDivElement>(null);

  // Left panel resizable width (px)
  const [leftPanelWidth, setLeftPanelWidth] = useState<number | null>(null);
  const isResizing = useRef(false);
  const splitViewRef = useRef<HTMLDivElement>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing.current || !splitViewRef.current) return;
      const rect = splitViewRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const minW = 250;
      const maxW = rect.width * 0.5;
      setLeftPanelWidth(Math.max(minW, Math.min(maxW, newWidth)));
    };

    const handleResizeEnd = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
    };
  }, []);

  const showLineSize = useSyncExternalStore(
    subscribeToReadingPreferences, getShowRecordSizes, getDefaultShowRecordSizes,
  );

  // Copy to clipboard
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  // Get active file
  const activeFile = useMemo(() => {
    return files.find((f) => f.id === activeFileId) || null;
  }, [files, activeFileId]);

  const selectedId = activeFile?.selectedId ?? null;
  const treePath = activeFile?.treePath ?? null;
  const setSelectedId = useCallback((selectedId: number | null) => {
    setFiles((previous) => previous.map((file) =>
      file.id === activeFileId && file.selectedId !== selectedId ? { ...file, selectedId } : file,
    ));
  }, [activeFileId]);
  const setTreePath = useCallback((treePath: string | null) => {
    setFiles((previous) => previous.map((file) =>
      file.id === activeFileId && file.treePath !== treePath ? { ...file, treePath } : file,
    ));
  }, [activeFileId]);

  const editingFile = noteEditor ? files.find((file) => file.id === noteEditor.fileId) : undefined;
  useEffect(() => {
    if (noteEditor && !editingFile) setNoteEditor(null);
  }, [noteEditor, editingFile]);

  const editFieldNote = useCallback((path: FieldPath) => {
    if (activeFileId) setNoteEditor({ fileId: activeFileId, path: [...path] });
  }, [activeFileId]);

  const saveFieldNote = (note: string | null) => {
    if (!noteEditor) return;
    const { fileId, path } = noteEditor;
    const key = fieldPathKey(path);
    setFiles((previous) => previous.map((file) => {
      if (file.id !== fileId) return file;
      const next = new Map(file.fieldNotes);
      if (note === null) next.delete(key);
      else next.set(key, { path: [...path], note });
      return { ...file, fieldNotes: next };
    }));
    setNoteEditor(null);
  };

  const applyNotesTemplate = (template: FieldNotesTemplateV1, fileIds: ReadonlySet<string>, overwrite: boolean): NotesApplyResult => {
    if (!fileIds.size || [...fileIds].some((id) => !files.some((file) => file.id === id))) {
      throw new LocalizedError("The selected files are no longer available. Select open files again.");
    }
    const result: NotesApplyResult = { files: fileIds.size, added: 0, overwritten: 0, retained: 0, unchanged: 0 };
    const next = files.map((file) => {
      if (!fileIds.has(file.id)) return file;
      const merged = mergeFieldNotes(file.fieldNotes, template.notes, overwrite);
      result.added += merged.counts.added;
      result.overwritten += merged.counts.overwritten;
      result.retained += merged.counts.retained;
      result.unchanged += merged.counts.unchanged;
      return { ...file, fieldNotes: merged.notes };
    });
    setFiles(next);
    return result;
  };

  const lines = activeFile?.lines || [];
  const filter = activeFile?.filter || "";
  const searchQuery = useMemo(() => createSearchQuery(filter), [filter]);
  const sortOrder = activeFile?.sortOrder || "asc";

  // Update filter for active file
  const setFilter = useCallback(
    (newFilter: string) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === activeFileId ? { ...f, filter: newFilter } : f,
        ),
      );
    },
    [activeFileId],
  );

  // Update sort order for active file
  const setSortOrder = useCallback(
    (newOrder: "asc" | "desc") => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === activeFileId ? { ...f, sortOrder: newOrder } : f,
        ),
      );
    },
    [activeFileId],
  );

  // Calculate list height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setListHeight(rect.height > 0 ? rect.height : 400);
      }
    };

    // Use ResizeObserver for more reliable height detection
    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Initial calculation with a small delay to ensure DOM is ready
    const timer = setTimeout(updateHeight, 50);

    window.addEventListener("resize", updateHeight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateHeight);
      resizeObserver.disconnect();
    };
  }, [activeFileId]);

  // Parse JSONL content
  const parseJsonl = useCallback((content: string): JsonLine[] => {
    const encoder = new TextEncoder();
    const rawLines = content.split("\n").filter((line) => line.trim());
    return rawLines.map((raw, index) => {
      const size = encoder.encode(raw).length;
      try {
        const parsed = JSON.parse(raw);
        return { id: index + 1, raw, parsed, size, recordKind: "json" };
      } catch {
        return {
          id: index + 1,
          raw,
          parsed: null,
          error: "Invalid JSON",
          recordKind: "invalid",
          size,
        };
      }
    });
  }, []);

  // Generate unique file ID
  const generateFileId = useCallback(() => {
    return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Add file to tabs
  const addFile = useCallback(
    (name: string, content: string) => {
      const parsed = parseJsonl(content);
      const newFile: FileData = {
        id: generateFileId(),
        name,
        lines: parsed,
        filter: "",
        sortOrder: "asc",
        selectedId: null,
        treePath: null,
        fieldNotes: new Map(),
        source: { kind: "file" },
      };
      setFiles((prev) => [...prev, newFile]);
      setActiveFileId(newFile.id);
    },
    [parseJsonl, generateFileId],
  );

  const openPaste = (trigger: HTMLElement | null) => {
    pasteTrigger.current = trigger;
    setPasteOpen(true);
  };

  const addPaste = (input: PasteInput) => {
    const number = pasteSequence.current + 1;
    const newFile: FileData = {
      id: generateFileId(),
      name: createTranslator(getLanguage())("Pasted Logs {number}", { number }),
      lines: input.records,
      filter: "",
      sortOrder: "asc",
      selectedId: input.records[0]?.id ?? null,
      treePath: null,
      fieldNotes: new Map(),
      source: { kind: "paste", format: input.format, originalText: input.originalText },
    };
    setFiles((previous) => [...previous, newFile]);
    setActiveFileId(newFile.id);
    pasteSequence.current = number;
  };

  // Handle file drop - always enabled
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      droppedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          addFile(file.name, content);
        };
        reader.readAsText(file);
      });
    },
    [addFile],
  );

  // Handle file input change
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputFiles = Array.from(e.target.files || []);
      inputFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          addFile(file.name, content);
        };
        reader.readAsText(file);
      });
      // Reset input value to allow selecting the same file again
      e.target.value = "";
    },
    [addFile],
  );

  const selectFile = useCallback((fileId: string) => {
    if (fileId === activeFileId) return;
    setActiveFileId(fileId);
  }, [activeFileId]);

  const saveFileDisplayName = useCallback((fileId: string, displayName: string | undefined) => {
    setFiles((previous) => previous.map((file) => {
      if (file.id !== fileId || file.displayName === displayName) return file;
      return { ...file, displayName };
    }));
  }, []);

  // Close a file tab
  const closeFile = useCallback(
    (fileId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setFiles((prev) => {
        const newFiles = prev.filter((f) => f.id !== fileId);
        if (activeFileId === fileId) {
          // Switch to another tab or clear
          const idx = prev.findIndex((f) => f.id === fileId);
          if (newFiles.length > 0) {
            const newActiveIdx = Math.min(idx, newFiles.length - 1);
            setActiveFileId(newFiles[newActiveIdx].id);
          } else {
            setActiveFileId(null);
          }
        }
        return newFiles;
      });
    },
    [activeFileId],
  );

  // Filter and sort lines
  const displayLines = useMemo(() => {
    let result = lines;

    if (searchQuery) result = lines.filter((line) => containsQuery(line.raw, searchQuery));

    if (sortOrder === "desc") {
      result = [...result].reverse();
    }

    return result;
  }, [lines, searchQuery, sortOrder]);

  // Current index in displayLines (for disabling nav buttons at boundaries)
  const currentIndex = useMemo(() => {
    if (selectedId === null) return -1;
    return displayLines.findIndex((line) => line.id === selectedId);
  }, [displayLines, selectedId]);

  useLayoutEffect(() => {
    const switched = displayedFileId.current !== activeFileId;
    displayedFileId.current = activeFileId;
    if (switched && currentIndex >= 0) {
      listRef.current?.scrollToRow({ index: currentIndex, align: "auto" });
    }
  }, [activeFileId, currentIndex]);

  const isAtFirst = currentIndex <= 0;
  const isAtLast = displayLines.length === 0 || currentIndex >= displayLines.length - 1;

  // Get selected line
  const selectedLine = useMemo(() => {
    if (selectedId === null) return null;
    return displayLines.find((line) => line.id === selectedId) || null;
  }, [displayLines, selectedId]);

  const effectiveView: ViewTab = selectedLine && selectedLine.recordKind !== "json" ? "raw" : viewTab;

  useEffect(() => {
    if (selectedId !== null && currentIndex < 0) setSelectedId(null);
  }, [selectedId, currentIndex, setSelectedId]);

  const rawMatches = useMemo(
    () => findTextMatches(
      selectedLine && effectiveView === "raw" ? selectedLine.raw : "",
      searchQuery,
    ),
    [selectedLine, searchQuery, effectiveView],
  );

  const navigateSelection = useCallback(
    (direction: "up" | "down") => {
      if (displayLines.length === 0) return;

      const currentIndex = selectedId
        ? displayLines.findIndex((line) => line.id === selectedId)
        : -1;

      let newIndex = -1;
      if (direction === "down") {
        newIndex =
          currentIndex < displayLines.length - 1
            ? currentIndex + 1
            : currentIndex;
        if (currentIndex === -1) newIndex = 0;
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
        if (currentIndex === -1) newIndex = 0;
      }

      if (newIndex !== -1 && newIndex !== currentIndex) {
        setSelectedId(displayLines[newIndex].id);
        if (listRef.current) {
          listRef.current.scrollToRow({ index: newIndex });
        }
      }
    },
    [displayLines, selectedId, setSelectedId],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen || noteEditor || notesImportOpen || pasteOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        if (
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement
        ) {
          return;
        }

        const preElement = detailContentRef.current?.querySelector("[data-json-body]");
        if (preElement) {
          e.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(preElement);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else if (effectiveView === "tree") {
          e.preventDefault();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        navigateSelection("down");
      } else if (e.key === "ArrowUp") {
        if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        navigateSelection("up");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigateSelection, effectiveView, settingsOpen, noteEditor, notesImportOpen, pasteOpen]);

  // Format JSON for pretty display
  const formatJson = useCallback((obj: unknown): string => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return "Unable to format";
    }
  }, []);

  const prettyText = useMemo(
    () => selectedLine && effectiveView === "pretty"
      ? formatJson(selectedLine.parsed) : "",
    [selectedLine, effectiveView, formatJson],
  );
  const hasSearchQuery = searchQuery !== null;
  const prettyMapping = useMemo(
    () => prettyText && hasSearchQuery ? createPrettyMapping(selectedLine?.raw ?? "", prettyText) : null,
    [selectedLine?.raw, prettyText, hasSearchQuery],
  );
  const prettyMatches = useMemo(
    () => findPrettyMatches(prettyText, searchQuery, prettyMapping),
    [prettyText, searchQuery, prettyMapping],
  );
  const treeModel = useMemo(
    () => selectedLine && effectiveView === "tree"
      ? buildTreeSearchModel(selectedLine.parsed, searchQuery) : null,
    [selectedLine, effectiveView, searchQuery],
  );
  const detailMatches = effectiveView === "raw" ? rawMatches
    : effectiveView === "tree" ? treeModel?.matches ?? [] : prettyMatches;
  const matchContext = JSON.stringify([activeFileId, selectedLine?.id, effectiveView, filter]);
  useEffect(() => {
    setMatchCursor((previous) => previous.context === matchContext ? previous
      : { context: matchContext, index: 0, revision: previous.revision });
  }, [matchContext]);
  const activeMatchIndex = matchCursor.context === matchContext
    ? Math.min(matchCursor.index, Math.max(0, detailMatches.length - 1)) : 0;
  const activeMatch = detailMatches[activeMatchIndex];

  const navigateMatch = useCallback((direction: -1 | 1) => {
    const index = activeMatchIndex + direction;
    if (index < 0 || index >= detailMatches.length) return;
    setMatchCursor((previous) => ({ context: matchContext, index, revision: previous.revision + 1 }));
  }, [activeMatchIndex, detailMatches.length, matchContext]);

  useLayoutEffect(() => {
    if (!activeMatch || effectiveView === "tree") return;
    const frame = requestAnimationFrame(() => {
      if (detailContentRef.current) revealTextMatch(detailContentRef.current, activeMatch.id);
    });
    return () => cancelAnimationFrame(frame);
  }, [matchContext, activeMatch?.id, matchCursor.revision, effectiveView]);

  // Row component for virtualized list (react-window v2 API)
  const Row = useCallback(
    ({
      index,
      style,
    }: {
      index: number;
      style: React.CSSProperties;
      ariaAttributes: {
        "aria-posinset": number;
        "aria-setsize": number;
        role: "listitem";
      };
    }) => {
      const line = displayLines[index];
      const isSelected = selectedId === line.id;

      return (
        <div
          style={style}
          className={`${styles.listItem} ${isSelected ? styles.listItemSelected : ""} ${line.error ? styles.listItemError : ""}`}
          data-record-id={line.id}
          onClick={() => setSelectedId(line.id)}
        >
          <span className={styles.listItemId}>{line.id}</span>
          <span className={`${styles.listItemContent} mono`}>
            <SearchText text={line.raw.slice(0, 200)} matches={findTextMatches(line.raw.slice(0, 200), searchQuery, "preview")} />
            {line.raw.length > 200 ? "..." : ""}
          </span>
          {showLineSize && (
            <span className={styles.listItemSize}>
              {formatBytes(line.size)}
            </span>
          )}
        </div>
      );
    },
    [displayLines, selectedId, showLineSize, searchQuery, setSelectedId],
  );

  // Global drag/drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only set dragging to false if leaving the main container
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  return (
    <main
      className={styles.main}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className={styles.dragOverlay}>
          <div className={styles.dragOverlayContent}>
            <FileUp size={48} />
            <p>{t("Drop file to add new tab")}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.logo}>
            <span className={styles.logoIcon}>{"{}"}</span>
            <span>JSONL Viewer</span>
          </h1>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.addFileBtn}
            disabled={files.length === 0}
            title={t(files.length === 0 ? "Open a log file before importing field notes" : "Import a field notes template")}
            aria-haspopup="dialog"
            onClick={() => setNotesImportOpen(true)}
          >{t("Import Notes")}</button>
          <AddSourceMenu onOpenFile={() => fileInputRef.current?.click()} onPaste={openPaste} />
          <input ref={fileInputRef} type="file" accept=".jsonl,.json,.log,.txt" onChange={handleFileInput} multiple hidden />

          <button
            ref={settingsTriggerRef}
            type="button"
            className={styles.addFileBtn}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            aria-controls={settingsOpen ? "settings-dialog" : undefined}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={16} aria-hidden="true" />
            {t("Settings")}
          </button>

          <a
            href="https://github.com/zyf123489/jsonl-viewer"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubLink}
            title={t("View on GitHub")}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </header>

      {/* File Tabs */}
      {files.length > 0 && (
        <FileTabs
          files={files}
          activeFileId={activeFileId}
          onSelect={selectFile}
          onSaveName={saveFileDisplayName}
          onClose={closeFile}
        />
      )}

      {/* Content Area */}
      <div className={styles.content}>
        {files.length === 0 ? (
          /* Drop Zone */
          <div
            className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ""}`}
          >
            <div className={styles.dropContent}>
              <div className={styles.dropIcon}>
                <FileUp size={56} />
              </div>
              <p className={styles.dropText}>
                {t("Drag & drop a")} <strong>.jsonl</strong> {t("file here")}
              </p>
              <p className={styles.dropSubtext}>{t("or")}</p>
              <button type="button" className={styles.browseBtn} aria-haspopup="dialog" onClick={(event) => openPaste(event.currentTarget)}>{t("Paste Logs")}</button>
              <label className={styles.browseBtn}>
                {t("Browse Files")}
                <input
                  type="file"
                  accept=".jsonl,.json,.log,.txt"
                  onChange={handleFileInput}
                  multiple
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>
        ) : (
          /* Split View */
          <div className={styles.splitView} ref={splitViewRef}>
            {/* Left Panel - List */}
            <div
              className={styles.leftPanel}
              style={leftPanelWidth !== null ? { width: leftPanelWidth } : undefined}
            >
              <div className={styles.panelHeader}>
                <span>{t("Objects")}</span>
                <div className={styles.leftPanelControls}>
                  <div className={styles.filterBarInline}>
                    <Search size={14} />
                    <input
                      type="text"
                      className={styles.filterInputInline}
                      placeholder={t("Filter...")}
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                    {filter && (
                      <button
                        className={styles.clearFilterInline}
                        aria-label={t("Clear filter")}
                        onClick={() => setFilter("")}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <span className={styles.filterCountInline}>
                    {displayLines.length}/{lines.length}
                  </span>
                  <button
                    className={styles.sortBtn}
                    onClick={() =>
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                    }
                    title={t(sortOrder === "asc" ? "Sort Descending" : "Sort Ascending")}
                  >
                    {sortOrder === "asc" ? (
                      <ArrowDownAz size={16} />
                    ) : (
                      <ArrowUpAz size={16} />
                    )}
                  </button>
                </div>
              </div>
              <div className={styles.listContainer} ref={containerRef}>
                <List
                  listRef={listRef}
                  style={{ height: listHeight }}
                  rowCount={displayLines.length}
                  rowHeight={36}
                  rowComponent={Row}
                  rowProps={{}}
                  overscanCount={10}
                />
              </div>
            </div>

            {/* Resizer handle */}
            <div
              className={styles.resizer}
              onMouseDown={handleResizeStart}
            />

            {/* Right Panel - Detail */}
            <div className={styles.rightPanel} data-json-reader>
              <div className={`${styles.panelHeader} ${styles.detailHeader}`}>
                <div className={styles.tabs}>
                  {(["pretty", "raw", "tree"] as ViewTab[]).map((tab) => (
                    <button
                      key={tab}
                      className={`${styles.tab} ${effectiveView === tab ? styles.tabActive : ""}`}
                      disabled={Boolean(selectedLine && selectedLine.recordKind !== "json" && tab !== "raw")}
                      title={selectedLine && selectedLine.recordKind !== "json" && tab !== "raw" ? t("Pretty and Tree require a valid JSON record.") : undefined}
                      onClick={() => {
                        if (!selectedLine || selectedLine.recordKind === "json") setViewTab(tab);
                      }}
                    >
                      {t(({ pretty: "Pretty", raw: "Raw", tree: "Tree" } as const)[tab])}
                    </button>
                  ))}
                </div>
                <div className={styles.searchNavigation}>
                  <button type="button" className={styles.copyBtn} aria-pressed={notesVisible} title={t(notesVisible ? "Hide field notes without deleting them" : "Show field notes")} onClick={() => {
                    const anchors = captureReadingPosition();
                    setNotesVisible((previous) => !previous);
                    requestAnimationFrame(() => restoreReadingPosition(anchors));
                  }}>{t(notesVisible ? "Field Notes: Shown" : "Field Notes: Hidden")}</button>
                  <div className={styles.navigationGroup} aria-label={t("Record navigation")}>
                    <span className={styles.navigationCount}>{t("Records {current} / {total}", { current: currentIndex < 0 ? "—" : currentIndex + 1, total: displayLines.length })}</span>
                    <button className={`${styles.copyBtn} ${styles.navigationButton}`} disabled={isAtFirst} onClick={() => navigateSelection("up")} aria-label={t("Previous Record")} title={t("Previous Record")}>
                      <ArrowUp size={14} />
                    </button>
                    <button className={`${styles.copyBtn} ${styles.navigationButton}`} disabled={isAtLast} onClick={() => navigateSelection("down")} aria-label={t("Next Record")} title={t("Next Record")}>
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  {searchQuery && (
                    <div className={styles.navigationGroup} aria-label={t("Match navigation")}>
                      <span className={styles.navigationCount}>{t("Matches {current} / {total}", { current: activeMatch ? activeMatchIndex + 1 : 0, total: detailMatches.length })}</span>
                      <button className={`${styles.copyBtn} ${styles.navigationButton}`} disabled={!activeMatch || activeMatchIndex === 0} onClick={() => navigateMatch(-1)} aria-label={t("Previous Match")} title={t("Previous Match")}>
                        <ArrowUp size={14} />
                      </button>
                      <button className={`${styles.copyBtn} ${styles.navigationButton}`} disabled={!activeMatch || activeMatchIndex === detailMatches.length - 1} onClick={() => navigateMatch(1)} aria-label={t("Next Match")} title={t("Next Match")}>
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className={styles.headerRight}>
                  {selectedLine && effectiveView !== "tree" && (
                    <button
                      className={`${styles.copyBtn} ${copied ? styles.copied : ""}`}
                      onClick={() => handleCopy(effectiveView === "raw" ? selectedLine.raw : formatJson(selectedLine.parsed))}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {t(copied ? "Copied!" : "Copy")}
                    </button>
                  )}
                  {selectedLine && <span className={styles.detailId}>ID: {selectedLine.id}</span>}
                </div>
              </div>
              {selectedLine ? (
                <>
                  {searchQuery && !activeMatch && effectiveView !== "raw" && (
                    <div className={styles.searchHint}>
                      <span>{t("No matches in this view. View in Raw to locate matches in the original text.")}</span>
                      <button className={styles.copyBtn} onClick={() => setViewTab("raw")}>{t("View in Raw")}</button>
                    </div>
                  )}
                  <div className={styles.detailContent} ref={detailContentRef} data-reading-scroll="text">
                    {effectiveView === "raw" ? (
                      <>
                        {selectedLine.recordKind === "invalid" && <div className={styles.errorMessage}>{t("Invalid or possibly incomplete JSON. Original text is preserved.")}</div>}
                        {selectedLine.recordKind === "text" && <div className={styles.rawNotice}>{t("Read as original text; not structurally parsed.")}</div>}
                        <pre className={`${styles.rawContent} mono`} data-json-body>
                          <SearchText text={selectedLine.raw} matches={rawMatches} activeId={activeMatch?.id} />
                        </pre>
                      </>
                    ) : effectiveView === "tree" && treeModel ? (
                      <TreeView
                        model={treeModel}
                        externalSelectedPath={treePath}
                        onPathChange={setTreePath}
                        activeMatch={treeModel.matches[activeMatchIndex]}
                        context={matchContext}
                        revision={matchCursor.revision}
                        notes={activeFile?.fieldNotes ?? EMPTY_FIELD_NOTES}
                        notesVisible={notesVisible}
                        notesWidth={notesWidth}
                        onNotesWidthChange={setNotesWidth}
                        splitPercent={treeSplitPercent}
                        onSplitChange={setTreeSplitPercent}
                        onEditNote={editFieldNote}
                      />
                    ) : (
                      <PrettyFieldNotes json={prettyText} matches={prettyMatches} activeId={activeMatch?.id} notes={activeFile?.fieldNotes ?? EMPTY_FIELD_NOTES} visible={notesVisible} width={notesWidth} onWidthChange={setNotesWidth} onEdit={editFieldNote} />
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.emptyDetail}>
                  <File size={64} />
                  <p>{t("Select an object to view details")}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {noteEditor && editingFile && <FieldNoteEditor
        key={JSON.stringify([noteEditor.fileId, noteEditor.path])}
        file={editingFile}
        path={noteEditor.path}
        existingNote={editingFile.fieldNotes.get(fieldPathKey(noteEditor.path))?.note}
        onSave={(note) => saveFieldNote(note)}
        onDelete={() => saveFieldNote(null)}
        onClose={() => setNoteEditor(null)}
      />}
      {notesImportOpen && <FieldNotesImport files={files} activeFileId={activeFileId} onApply={applyNotesTemplate} onClose={() => setNotesImportOpen(false)} />}
      {pasteOpen && <PasteLogsDialog trigger={pasteTrigger.current} onOpen={addPaste} onClose={() => setPasteOpen(false)} />}
      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          triggerRef={settingsTriggerRef}
        />
      )}
    </main>
  );
}
