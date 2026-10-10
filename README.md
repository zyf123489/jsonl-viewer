# JSONL Viewer

**English** | [简体中文](./README.zh-CN.md)

A high-performance JSONL file viewer built with Next.js, optimized for log analysis.

## Features

- **PWA Support** — Install as a native app on any device
- **Drag & Drop** — Simply drag `.jsonl` files onto the page to open
- **Multi-Tab** — Open multiple files in tabs, switch between them freely
- **File Display Names** — Double-click a tab name or focus it and press F2 to edit its alias without renaming the original file
- **Virtual Scrolling** — Handle large files with thousands of lines efficiently via react-window
- **Three View Modes**
  - **Pretty** — JSON syntax highlighting with color-coded keys, strings, numbers, booleans, and nulls
  - **Raw** — Original unformatted JSON line
  - **Tree** — Interactive tree explorer with expand/collapse, path selection, and value panel
- **Keyboard Navigation** — Arrow Up/Down to navigate objects, Ctrl+A to select content
- **Line Size Display** — Toggleable per-line byte size indicator (persisted via localStorage)
- **Search Navigation** — Literal highlighting and separate record/occurrence navigation in Raw, Pretty and Tree

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
See the [F08 design and verification record](./docs/file-display-name.zh-CN.md) for
implemented milestones and the manual checks that remain outstanding.

## Theme Settings

Use **Settings → Theme** to select **Dark**, **Light**, or **Warm**. Changes apply
immediately without resetting your reading state. The preference is saved in this
browser when local storage is available; it does not save opened log files.

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

For the milestone alignment and verification record, see [F03 implementation notes](./docs/search-navigation.md).

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
