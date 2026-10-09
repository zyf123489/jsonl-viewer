# JSONL Viewer

**English** | [简体中文](./README.zh-CN.md)

A high-performance JSONL file viewer built with Next.js, optimized for log analysis.

## Features

- **PWA Support** — Install as a native app on any device
- **Drag & Drop** — Simply drag `.jsonl` files onto the page to open
- **Multi-Tab** — Open multiple files in tabs, switch between them freely
- **Virtual Scrolling** — Handle large files with thousands of lines efficiently via react-window
- **Three View Modes**
  - **Pretty** — JSON syntax highlighting with color-coded keys, strings, numbers, booleans, and nulls
  - **Raw** — Original unformatted JSON line
  - **Tree** — Interactive tree explorer with expand/collapse, path selection, and value panel
- **Keyboard Navigation** — Arrow Up/Down to navigate objects, Ctrl+A to select content
- **Line Size Display** — Toggleable per-line byte size indicator (persisted via localStorage)

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
