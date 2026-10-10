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

export default function TreeView({ model, externalSelectedPath, onPathChange, activeMatch, context, revision, notes, notesVisible, notesWidth, onNotesWidthChange, onEditNote }: {
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
}) {
  const { t } = useLanguage();
  const [manualExpansion, setManualExpansion] = useState<Map<string, boolean>>(new Map([["[]", true]]));
  const [navigationOpened, setNavigationOpened] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const structureRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const selectedNode = externalSelectedPath ? model.nodes.get(externalSelectedPath) : undefined;
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
    <div className={styles.treeViewContainer}>
      <div className={styles.treePanel}>
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
