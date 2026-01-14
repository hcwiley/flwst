# Reasoning Server Architecture

## Overview

The reasoning server is an Express API that orchestrates a transcript→daily note
and todo pipeline. The core orchestration is implemented as an enum-driven
state machine (`ReasoningOrchestrator`) with dependency-injected LLM + Notion
clients.

## Key Responsibilities

- **Preprocess transcript** (spelling fixes, blacklist handling)
- **Extract daily notes + todos** (local inference)
- **Match todos to Notion Tasks DB**
- **Augment / update** todos and tasks (LLM stages)
- **Sync to Notion** (create tasks; update matched tasks)
- **Support UI-driven todo edits** via an in-memory update store

## Dependencies

- **Local LLM**: `node-llama-cpp` (`LlamaLLMClient`)
- **Notion**:
  - HTTP API for create/update (`notion-api.ts`)
  - MCP search/fetch for retrieval (`mcp-client.ts`)
- **Shared schemas**: `types/src/api/reasoning.ts`

## Orchestration state machine

The orchestrator progresses linearly, persisting artifacts (notes, todos,
Notion candidates, warnings) as it goes. It can also be run to an intermediate
target state (used by `/api/process` to stop after extraction).

```mermaid
flowchart TD
  INIT[INIT]
  DAILY[DAILY_NOTES_EXTRACTED]
  TODOS[TODOS_EXTRACTED]
  MATCHED[TODOS_MATCHED]
  AUG[TODOS_AUGMENTED]
  UPDATED[NOTION_UPDATED]
  DONE[DONE]
  ERR[ERROR]

  INIT --> DAILY --> TODOS --> MATCHED --> AUG --> UPDATED --> DONE
  INIT --> ERR
  DAILY --> ERR
  TODOS --> ERR
  MATCHED --> ERR
  AUG --> ERR
  UPDATED --> ERR
```

## Data Flow

```mermaid
flowchart TD
  subgraph Client
    MacApp[macOS_Electron_App]
  end

  subgraph API[Express_API]
    ChatRoutes[Routes_chat_api_process]
    NotionRoutes[Routes_notion_api_notion]
    OrchRoutes[Routes_orchestrator_api_orchestrator]
  end

  subgraph Core[Core]
    Orch[ReasoningOrchestrator]
    LLM[LlamaLLMClient]
    NotionClient[MCPNotionClient]
    TodoStore[InMemory_TodoUpdateStore]
  end

  subgraph Notion[Notion]
    MCP[Notion_MCP_SearchFetch]
    HTTP[Notion_HTTP_API]
    TasksDB[Tasks_DB]
    DailyDB[DailyNotes_DB]
  end

  MacApp -->|"POST /api/process (stop@TODOS_EXTRACTED)"| ChatRoutes
  MacApp -->|"POST /api/notion/match"| NotionRoutes
  MacApp -->|"POST /api/notion/todos/update"| TodoStore
  MacApp -->|"POST /api/notion/submit"| NotionRoutes
  MacApp -->|"POST /api/orchestrator/process (full)"| OrchRoutes

  ChatRoutes --> Orch
  OrchRoutes --> Orch

  Orch --> LLM
  Orch --> NotionClient

  NotionRoutes --> NotionClient
  NotionClient --> MCP
  NotionClient --> HTTP

  MCP --> TasksDB
  HTTP --> TasksDB
  HTTP --> DailyDB
```

## Notes / Constraints

- **Todo update store is in-memory**: UI edits are stored per-process and are
  lost on server restart.
- **Notion matching scope**: MCP search results are filtered to the configured
  Tasks database (`config/notion.ts`).

## Important implementation details

- **Tasks DB filtering**: MCP search returns workspace pages; the server filters
  candidates to `parent.type === "database_id"` and a matching Tasks DB ID.
- **MCP connection resilience**: MCP “Not connected” errors are treated as
  expected runtime failures; matching degrades gracefully and returns empty
  candidates + warnings rather than crashing the run.
- **Submit consistency**: `/api/notion/submit` merges request todos with any
  server-stored deltas (server wins) so Notion updates use the latest user edits.
