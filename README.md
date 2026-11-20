# JSONL Viewer

**English** | [简体中文](./README.zh-CN.md)

A browser-based JSONL and log viewer built with Next.js. Open `.jsonl` files or paste
logs, then search, filter, sort, and inspect records in **Pretty**, **Raw**, or
**Tree** view.

Files are processed locally in the browser and are not uploaded to a server.

## Online demo

<https://jsonl-viewer-zyf123489.pages.dev/>

## Features

- Drag and drop or select `.jsonl` files; paste logs directly
- Search, filtering, sorting, and keyboard navigation
- Pretty, Raw, and Tree JSON views
- Multiple open sources, field notes, themes, and PWA support

## Run locally

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## Build

```bash
pnpm build
```

Built with Next.js, React, TypeScript, and pnpm.

## License

MIT
