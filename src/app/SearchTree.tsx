import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import { Check, Copy, ChevronDown, ChevronRight, ListChevronsDownUp, ListChevronsUpDown, MessageSquare } from "lucide-react";
import { SearchText, revealSearchElement, revealTextMatch } from "./SearchHighlight";
import { ancestorIds, formatTreeNodeValue, treePathLabel, type TreeMatch, type TreeSearchModel, type TreeSearchNode } from "./treeSearch";
import styles from "./page.module.css";
import noteStyles from "./FieldNotes.module.css";
import type { FieldNoteMap, FieldPath } from "./fieldNotes";
import FieldNotesLayout from "./FieldNotesLayout";
import { useLanguage } from "./useLanguage";
import type { Translator } from "./i18n";

interface TreeNodeProps {
  node: TreeSearchNode;
  selectedPath: string | null;
  expanded: Set<string>;
  activeId?: string;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  notes: FieldNoteMap;
  notesVisible: boolean;
  onEditNote: (path: FieldPath) => void;
  t: Translator;
}

function TreeNode({ node, selectedPath, expanded, activeId, onSelect, onToggle, notes, notesVisible, onEditNote, t }: TreeNodeProps) {
  const isExpanded = expanded.has(node.id);
  const note = node.isField ? notes.get(node.id) : undefined;
  const valueType = node.value === null ? "null" : Array.isArray(node.value) ? "array" : typeof node.value;
  const preview = Array.isArray(node.value) ? t("Array({count})", { count: node.value.length })
    : valueType === "object" ? `{${t("{count} keys", { count: Object.keys(node.value as object).length })}}` : node.preview;
  return (
    <div className={styles.treeNode}>
      <div
        className={`${styles.treeNodeRow} ${styles.treeNotesRow} ${selectedPath === node.id ? styles.treeNodeSelected : ""}`}
        data-reading-path={node.id}
        style={{ "--tree-indent": `${node.path.length * 16 + 8}px` } as CSSProperties}
        onClick={() => onSelect(node.id)}
      >
        {notesVisible && <div className={noteStyles.treeNote}>
          {note && <button type="button" className={noteStyles.noteText} data-field-note={node.id} title={note.note} aria-label={t("Edit field note {path}", { path: node.id })} onClick={(event) => {
            event.stopPropagation();
            onEditNote(node.path);
          }}>{note.note.replace(/\s+/g, " ")}</button>}
        </div>}
        <div className={noteStyles.treeContent}>
          {node.expandable ? (
            <button
              className={styles.treeToggle}
              aria-label={t(isExpanded ? "Collapse {path}" : "Expand {path}", { path: treePathLabel(node.path) })}
              aria-expanded={isExpanded}
              onClick={(event) => { event.stopPropagation(); onToggle(node.id); }}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : <span className={styles.treeTogglePlaceholder} />}
          <span className={`${styles.treeKey} mono`}>
            <SearchText text={node.label} matches={node.keyMatches} activeId={activeId} />
          </span>
          {node.isField && <button type="button" className={noteStyles.editIcon} title={t(note ? "Edit field note {path}" : "Add field note {path}", { path: node.id })} aria-label={t(note ? "Edit field note {path}" : "Add field note {path}", { path: node.id })} onClick={(event) => {
            event.stopPropagation();
            onEditNote(node.path);
          }}><MessageSquare size={12} aria-hidden="true" /></button>}
          <span className={styles.treeSeparator}>:</span>
          <span className={`${styles.treeValue} ${styles[`treeValue_${valueType}`]} mono`}>
            <SearchText text={preview} matches={node.previewMatches} activeId={activeId} />
          </span>
        </div>
      </div>
      {node.expandable && isExpanded && node.children.map((child) => (
        <TreeNode key={child.id} node={child} selectedPath={selectedPath} expanded={expanded} activeId={activeId} onSelect={onSelect} onToggle={onToggle} notes={notes} notesVisible={notesVisible} onEditNote={onEditNote} t={t} />
      ))}
    </div>
  );
}

export default function TreeView({ model, externalSelectedPath, onPathChange, activeMatch, context, revision, notes, notesVisible, notesWidth, onNotesWidthChange, onEditNote, splitPercent, onSplitChange }: {
  model: TreeSearchModel;
  externalSelectedPath: string | null;
  onPathChange: (path: string | null) => void;
  activeMatch?: TreeMatch;
  context: string;
  revision: number;
  notes: FieldNoteMap;
  notesVisible: boolean;
  notesWidth: number;
  onNotesWidthChange: (width: number) => void;
  onEditNote: (path: FieldPath) => void;
  splitPercent: number;
  onSplitChange: (percent: number) => void;
}) {
  const { t } = useLanguage();
  const [manualExpansion, setManualExpansion] = useState<Map<string, boolean>>(new Map([["[]", true]]));
  const [navigationOpened, setNavigationOpened] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [resizing, setResizing] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ clientX: number; percent: number; pointerId: number } | null>(null);
  const structureRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const minimumPercent = availableWidth > 0 ? Math.min(160, availableWidth / 2) / availableWidth * 100 : 0;
  const maximumPercent = 100 - minimumPercent;
  const clampSplit = (percent: number) => Math.max(minimumPercent, Math.min(maximumPercent, percent));
  const actualSplitPercent = clampSplit(splitPercent);
  const finishResize = () => { drag.current = null; setResizing(false); };
  const selectedNode = externalSelectedPath ? model.nodes.get(externalSelectedPath) : undefined;

  useLayoutEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    const measure = () => setAvailableWidth(Math.max(0, layout.clientWidth - 8));
    const observer = new ResizeObserver(measure);
    observer.observe(layout);
    measure();
    return () => observer.disconnect();
  }, []);
  const searchExpanded = useMemo(() => {
    const paths = new Set<string>();
    for (const node of model.nodes.values()) {
      if (!node.keyMatches.length && !node.valueMatches.length) continue;
      for (const path of ancestorIds(model, node.id)) {
        if (paths.has(path)) break;
        paths.add(path);
      }
    }
    return paths;
  }, [model]);
  const expanded = useMemo(() => {
    const paths = new Set<string>();
    for (const node of model.nodes.values()) {
      if (node.expandable && (navigationOpened.has(node.id) || (manualExpansion.get(node.id) ?? searchExpanded.has(node.id)))) paths.add(node.id);
    }
    return paths;
  }, [model, navigationOpened, manualExpansion, searchExpanded]);
  const expandableNodes = useMemo(() => [...model.nodes.values()].filter((node) => node.expandable), [model]);
  const isAllExpanded = expandableNodes.length > 0 && expandableNodes.every((node) => expanded.has(node.id));
  const formattedValue = useMemo(() => selectedNode ? formatTreeNodeValue(selectedNode) : { text: "", matches: [] }, [selectedNode]);

  useEffect(() => {
    if (externalSelectedPath && !selectedNode) onPathChange(null);
  }, [externalSelectedPath, selectedNode, onPathChange]);

  useLayoutEffect(() => {
    setNavigationOpened(new Set(activeMatch ? ancestorIds(model, activeMatch.nodeId) : []));
    if (!activeMatch) return;
    onPathChange(activeMatch.nodeId);
    const frame = requestAnimationFrame(() => {
      const structure = structureRef.current;
      if (structure) {
        if (!revealTextMatch(structure, activeMatch.id)) {
          const row = structure.querySelector<HTMLElement>(`[data-reading-path="${CSS.escape(activeMatch.nodeId)}"]`);
          if (row) {
            const label = row.querySelector<HTMLElement>(`.${styles.treeKey}`);
            const preview = row.querySelector<HTMLElement>(`.${styles.treeValue}`);
            revealSearchElement(structure, label?.textContent ? label : preview ?? row);
          }
        }
      }
      if (activeMatch.kind === "value" && valueRef.current) revealTextMatch(valueRef.current, activeMatch.id);
    });
    return () => cancelAnimationFrame(frame);
  }, [context, revision, activeMatch?.id, model, onPathChange]);

  const handleToggle = useCallback((path: string) => {
    const nextExpanded = !expanded.has(path);
    setManualExpansion((previous) => new Map(previous).set(path, nextExpanded));
    setNavigationOpened((previous) => {
      const next = new Set(previous);
      next.delete(path);
      return next;
    });
  }, [expanded]);

  const handleExpandCollapseAll = () => {
    setManualExpansion(new Map(expandableNodes.map((node) => [node.id, !isAllExpanded || node.id === model.root.id])));
    setNavigationOpened(new Set());
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedValue.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) { console.error("Failed to copy:", error); }
  };

  return (
    <div ref={layoutRef} className={`${styles.treeViewContainer} ${resizing ? styles.treeResizing : ""}`}>
      <div className={styles.treePanel} style={{ width: `calc((100% - 8px) * ${actualSplitPercent / 100})` }}>
        <div className={styles.treePanelHeader}>
          <span>{t("Structure")}</span>
          <button className={styles.expandCollapseBtn} onClick={handleExpandCollapseAll} disabled={!expandableNodes.length} title={t(isAllExpanded ? "Collapse All" : "Expand All")} aria-label={t(isAllExpanded ? "Collapse All" : "Expand All")}>
            {isAllExpanded ? <ListChevronsUpDown size={14} /> : <ListChevronsDownUp size={14} />}
          </button>
        </div>
        <FieldNotesLayout className={noteStyles.treeNotesLayout} visible={notesVisible} width={notesWidth} onWidthChange={onNotesWidthChange} inset={8}>
          <div className={styles.treePanelContent} data-reading-scroll="tree" ref={structureRef}>
            <TreeNode node={model.root} selectedPath={externalSelectedPath} expanded={expanded} activeId={activeMatch?.id} onSelect={onPathChange} onToggle={handleToggle} notes={notes} notesVisible={notesVisible} onEditNote={onEditNote} t={t} />
          </div>
        </FieldNotesLayout>
      </div>
      <div
        className={styles.treeResizer}
        role="separator"
        aria-label={t("Resize value panel")}
        aria-orientation="vertical"
        aria-valuemin={Math.round(minimumPercent)}
        aria-valuemax={Math.round(maximumPercent)}
        aria-valuenow={Math.round(actualSplitPercent)}
        tabIndex={0}
        title={t("Drag to resize value panel. Double-click to reset width.")}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { clientX: event.clientX, percent: actualSplitPercent, pointerId: event.pointerId };
          setResizing(true);
        }}
        onPointerMove={(event) => {
          if (!drag.current || drag.current.pointerId !== event.pointerId || availableWidth <= 0) return;
          onSplitChange(clampSplit(drag.current.percent + (event.clientX - drag.current.clientX) / availableWidth * 100));
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          finishResize();
        }}
        onPointerCancel={finishResize}
        onLostPointerCapture={finishResize}
        onDoubleClick={() => onSplitChange(50)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const step = availableWidth > 0 ? 8 / availableWidth * 100 : 2;
          const next = event.key === "Home" ? minimumPercent : event.key === "End" ? maximumPercent : actualSplitPercent + (event.key === "ArrowLeft" ? -step : step);
          onSplitChange(clampSplit(next));
        }}
      />
      <div className={styles.treeValuePanel}>
        <div className={styles.treePanelHeader}>
          <span>{t("Value")} {selectedNode && <span className={`${styles.treePathLabel} mono`}>{treePathLabel(selectedNode.path)}</span>}</span>
          {selectedNode && selectedNode.value !== null && (
            <button className={`${styles.copyBtn} ${copied ? styles.copied : ""}`} onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}{t(copied ? "Copied!" : "Copy")}
            </button>
          )}
        </div>
        <div className={styles.treeValueContent} data-reading-scroll="text" ref={valueRef}>
          {selectedNode ? (
            <pre className={`${styles.treeValuePre} mono`} data-json-body>
              <SearchText text={formattedValue.text} matches={formattedValue.matches} activeId={activeMatch?.id} />
            </pre>
          ) : <div className={styles.treeValueEmpty}>{t("Click a node to view its value")}</div>}
        </div>
      </div>
    </div>
  );
}
