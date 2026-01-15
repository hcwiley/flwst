# macOS Electron App

## Overview

`apps/macos-electron` is a local macOS UI for:

- Pasting a transcript
- Generating a daily note and todos via the reasoning server
- Matching todos against Notion
- Editing todo metadata (e.g., **Status** / **Priority**) before submission
- Submitting to Notion (create new tasks, update matched tasks)

## Tech

- React + Vite
- Tamagui UI
- Talks to the reasoning server via HTTP (`http://localhost:3000`)

## Development

From repo root:

```bash
pnpm dev:reasoning
pnpm dev:mac
```

Or from this package:

```bash
pnpm dev
```

## How it integrates

High level request flow:

- `POST /process` to start transcript processing and `GET /process/:jobId`
  to poll for the draft response.
- `POST /api/process/high-level` for high-level extraction (optional).
- `POST /api/notion/match` to enrich todos with Notion IDs/URLs.
- `POST /api/notion/todos/update` to sync UI edits to the server (stored
  in-memory).
- `POST /api/notion/submit` to write to Notion.

## Notes / constraints

- The app updates todo status/priority locally immediately, then syncs the
  change to the server in the background.
- The server’s todo update store is **in-memory**; if the server restarts before
  submit, pending UI edits are lost.
