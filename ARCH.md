# Repository Architecture

## Overview

This monorepo provides:

- A **macOS Electron client** for pasting transcripts, reviewing outputs, and
  editing todo metadata.
- A **reasoning server** that orchestrates local LLM inference + Notion sync.
- Shared **types** for schema validation and client/server compatibility.

## Key Components

- **macOS app**: `apps/macos-electron`
- **reasoning server**: `servers/reasoning`
- **shared API schemas**: `types/src/api/reasoning.ts`

## Data Flow

```mermaid
flowchart TD
  subgraph App[apps/macos-electron]
    MacUI[macOS_UI]
  end

  subgraph Server[servers/reasoning]
    ReasoningAPI[Express_API]
  end

  subgraph LocalLLM[Local_LLM]
    Llama[node-llama-cpp]
  end

  subgraph Notion[Notion]
    MCP[Notion_MCP]
    API[Notion_API]
    TasksDB[Tasks_DB]
    DailyDB[DailyNotes_DB]
  end

  subgraph Shared[Shared]
    Types[types_api_reasoning]
  end

  MacUI -->|"HTTP (localhost): transcript & todos"| ReasoningAPI
  ReasoningAPI --> Llama
  ReasoningAPI --> MCP
  ReasoningAPI --> API

  MCP --> TasksDB
  API --> TasksDB
  API --> DailyDB

  MacUI --> Types
  ReasoningAPI --> Types
```

## Notes / Constraints

- **Todo update syncing is in-memory**: the server stores UI edits (status,
  priority, etc.) in a process-local map. If the server restarts, pending edits
  are lost.
- **Notion matching searches only Tasks DB**: search results are filtered to
  only include pages whose `parent.database_id` matches the configured Tasks
  database.
