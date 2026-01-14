# macOS Electron App Architecture

## Overview

The macOS Electron app is the primary UI for pasting transcripts, reviewing
LLM-generated outputs, editing todo metadata (status/priority), and submitting
results to Notion via the reasoning server.

## Key Responsibilities

- Collect transcript input
- Display daily note markdown + todo list
- Allow inline edits to todo metadata (Status/Priority)
- Sync edits to the reasoning server so Submit uses consistent state
- Trigger submission to Notion (create/update)

## Dependencies

- **UI**: Tamagui
- **Backend**: `servers/reasoning` (HTTP)
- **Schemas**: `@flwst/types` (`types/src/api/reasoning.ts`)

## Data Flow

```mermaid
flowchart TD
  subgraph App[macOS_Electron_App]
    UI[React_UI]
    Cards[TodoCards_StatusPriority]
  end

  subgraph Server[Reasoning_Server]
    API[Express_API]
    Store[InMemory_TodoUpdateStore]
  end

  subgraph Notion[Notion]
    TasksDB[Tasks_DB]
    DailyDB[DailyNotes_DB]
  end

  UI -->|"POST /api/process"| API
  UI -->|"POST /api/notion/match"| API
  Cards -->|"POST /api/notion/todos/update"| Store
  UI -->|"POST /api/notion/submit"| API

  API --> TasksDB
  API --> DailyDB
```

## Notes / Constraints

- The server-side todo update store is **in-memory**. If the server restarts
  before submit, pending UI edits are lost.
