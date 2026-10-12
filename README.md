# JSONL Viewer

**English** | [简体中文](./README.zh-CN.md)

A high-performance JSONL file viewer built with Next.js, optimized for log analysis.

## Features

- **PWA Support** — Install as a native app on any device
- **Drag & Drop** — Simply drag `.jsonl` files onto the page to open
- **Paste Logs** — Open complete JSON, confirm a JSONL preview, or read the entire input as original text without saving a file
- **Multi-Tab** — Open multiple files in tabs, switch between them freely
- **File Display Names** — Double-click a tab name or focus it and press F2 to edit its alias without renaming the original file
- **Virtual Scrolling** — Handle large files with thousands of lines efficiently via react-window
- **Three View Modes**
  - **Pretty** — JSON syntax highlighting with color-coded keys, strings, numbers, booleans, and nulls
  - **Raw** — Original record text, including multiline pasted JSON or plain text
  - **Tree** — Interactive tree explorer with expand/collapse, path selection, and value panel
- **Keyboard Navigation** — Arrow Up/Down to navigate objects, Ctrl+A to select content
- **Line Size Display** — Toggleable per-line byte size indicator (persisted via localStorage)
- **Search Navigation** — Literal highlighting and separate record/occurrence navigation in Raw, Pretty and Tree
- **Field Notes** — File-scoped, exact-path explanations shared by Pretty and Tree, with local JSON template import

## Paste Logs

Choose **Add File → Paste Logs**, or **Paste Logs** on the empty page, and paste
into the labeled text box. **Open Logs** first parses the entire input as one JSON
value, including formatted multiline JSON, arrays, and primitives. Arrays stay
one record. If whole-input parsing fails, review the valid/invalid counts and the
first ten line summaries, then explicitly choose **Open Lines** or **Open as Text**.
All non-empty lines are kept when opening lines; invalid lines are never discarded.
Editing the input invalidates the preview. **Open as Text** always opens one text
record, even for valid JSON, without labeling it as a parse error.

Each successful opening creates an independent **Pasted Logs N** source and selects
its first record. Sources have separate search, sorting, aliases, and field notes.
Valid JSON uses all three views; text and invalid records use Raw for reading,
search, navigation, copying, and content selection. The previous structured-view
preference returns when selecting a valid record. Only valid fields offer note editing.
Renaming works as before; restoring or hovering a pasted name uses its initial
source name, not a fictitious disk filename.

Original input is preserved as received from the browser text box: no repair,
prefix stripping, inferred fields, or automatic array splitting. Logs are processed
locally, never uploaded or saved to browser storage, and disappear on refresh or
source closure. The application does not read the clipboard automatically or
intercept global paste. Inputs exceeding **5 MiB in UTF-8** require confirmation;
this is a warning, not truncation or a guarantee that very large inputs will work.
Disk file imports retain their existing line-based parsing rules.

## File Display Names

Double-click a tab name, or focus it with Tab and press **F2**, to edit in place.
The full name is selected; only one tab can be edited at a time. **Enter** saves,
**Esc** cancels, and clicking elsewhere saves without interrupting that control.
The circular-arrow icon appears only while editing and immediately restores the
original name, including when no alias was previously set.

Saving trims outer whitespace but preserves internal spaces. Empty names restore
the original name. Duplicate aliases are allowed without numbering or merging.
Short names size to their content; long names are visually truncated, not shortened in saved data or the editor.
Hovering a name shows only the original filename; the tooltip hides while editing.

Aliases stay in the current page session when switching files. Refreshing, reopening
a closed file or opening another page does not restore them. File contents, disk
names, selected records, queries, sorting and reading modes are unchanged.
See the [overall development document](./DEVELOPMENT.zh-CN.md), section F08, for
implemented milestones and the manual checks that remain outstanding.

## Field Notes

Hover a field name in **Pretty** or an object-field row in **Tree** to reveal its
note button, or reach the button with Tab. Click an existing note to edit it.
The dialog shows the current file title and a read-only path. **Save** trims outer
whitespace and requires non-empty text; **Cancel**, Esc and backdrop clicks discard
the draft. **Delete** removes only the explanation, never the JSON field.

**Field Notes: Shown/Hidden** controls both reading modes across all files; hiding
notes keeps their data and editing buttons. Raw, Tree's Value panel, search counts
and copied JSON never include notes. Long notes are summarized with ellipsis;
the editor retains their full text, including internal line breaks.

Use the header's **Import Notes** button to choose, validate and preview a local
template, then select currently open files. Only the active file is preselected.
File rows show exactly their current tab titles, even when two titles are identical;
selection uses independent file IDs. New files do not inherit previous imports.

The v1 format is an implementation convention, not an external standard:

```json
{
  "format": "jsonl-viewer-field-notes",
  "version": 1,
  "notes": [
    { "path": ["duration_ms"], "note": "Total duration in milliseconds" },
    { "path": ["processing", "duration_ms"], "note": "Internal processing time" },
    { "path": ["reasons", 0, "type"], "note": "First reason type" }
  ]
}
```

Paths start at each record's root and end in a string object key. Numeric segments
are exact array indices: the example does not annotate every array element.
`["a.b"]` differs from `["a", "b"]`; string `"0"` differs from index `0`.
Unknown properties, invalid versions/paths, empty notes and duplicate paths reject
the whole template. Missing log fields are not created; their notes display only
when a corresponding field exists. Existing same-path notes are kept by default.
Explicitly enable **Overwrite existing notes at the same paths** to replace those
paths in selected files; unrelated notes remain intact.

**Notes live only in this page session. Refreshing or closing/reopening a file
discards them, including manual edits.** Reimport an external template to add them
again. There is no template export, disk write-back, persistent note storage,
upload or per-record investigation memo. Rules, template examples and verification
summaries are maintained in section F06 of the [overall development document](./DEVELOPMENT.zh-CN.md).

## Theme Settings

Use **Settings → Theme** to select **Dark**, **Light**, or **Warm**. Changes apply
immediately without resetting your reading state. The preference is saved in this
browser when local storage is available; it does not save opened log files.

## Interface Language

Open **Settings → Language** and choose **English** or **简体中文**. The interface
updates immediately, including reading controls, settings, field-note dialogs,
tooltips and validation messages. English remains the default. Your choice is
saved in this browser and restored after refresh when local storage is available;
other open pages in the same browser update too. If storage is unavailable,
switching still works in the current page.

Changing language does not translate log contents, filenames, aliases, user notes
or the JSON template schema, and does not reset your reading or search state.

## Reading Settings

Open **Settings → JSON Reading** to adjust JSON font size (10–24px, default 13px),
line height (**Compact** 1.3 / **Standard** 1.6 / **Relaxed** 1.9), and **Wrap Long Lines**
(on by default). These affect JSON content only, not the toolbar, record list or
settings controls. With wrapping off, long text scrolls horizontally inside its
reading region; existing newlines and copied content are unchanged.

**Reset Reading Settings** restores only these three options. Theme and record-size
visibility are untouched. **Show Record Sizes** now lives on the Settings home page
and preserves the existing local preference. Changes apply to all files immediately
and are remembered when browser storage is available. Reflow tries to keep the same
content nearby rather than preserving an exact scroll pixel.

## Search Highlighting and Navigation

**Filter** keeps the existing case-insensitive raw-text search. Symbols are literal;
blank-only input disables search, while leading/trailing spaces in an effective
query are significant. Each file retains its own query and sort order.

- **Records** shows the selected position in the filtered/sorted list, not its ID.
- **Matches** shows the active occurrence in the current record and view, not a
  file-wide total. Both navigation levels stop at their boundaries without wrapping.
- Changing the query resets to the first occurrence without stealing focus. If
  filtering removes the selected record, details clear without selecting another.
- Raw searches the original text (including invalid JSON); Pretty searches the full
  formatted text and preserves syntax colors. Their counts can differ.
- Tree counts field names and leaf values once, not duplicate summaries or generated
  labels. Match navigation reveals necessary ancestors and selects the target field.
  Manual collapse takes priority until another navigation reveals that path; clearing
  search removes search-only expansion while retaining manual actions.
- A record with no occurrence in its current view stays selected and offers **View in Raw**.
  Visible previews are highlighted without rewriting truncated content. Highlighting
  does not change copied content, themes, reading preferences or the virtual list.

For milestone status and development requirements, see section F03 of the [overall development document](./DEVELOPMENT.zh-CN.md).

## Getting Started

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

Open [http://localhost:3000](http://localhost:3000) to use the viewer.

## Usage

1. Drag and drop a `.jsonl` file onto the drop zone (or click **Browse Files**)
2. Use the filter bar to search objects by text content
3. Click any object in the left list to view its details
4. Switch between **Pretty**, **Raw**, and **Tree** tabs
5. In Tree view, click nodes to expand/collapse and inspect values in the right panel
6. Use ↑/↓ arrow keys to navigate between objects
7. Use the sort button to toggle ascending/descending order

## Tech Stack

- **Next.js 16** — React framework with App Router and Turbopack
- **React 19** — UI library
- **react-window 2** — Virtualized list for high-performance rendering
- **@ducanh2912/next-pwa** — Progressive Web App support
- **TypeScript 7** — Type safety
- **pnpm** — Package manager

## License

MIT
