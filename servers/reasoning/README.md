# Reasoning Server

## Overview

`servers/reasoning` is an Express server that turns transcripts into:

- A daily note (markdown)
- A list of todos (validated by shared Zod schemas)
- Optional Notion matching and Notion write-back

It is **local-first** and uses **local LLM inference** via `node-llama-cpp`.

## Key Responsibilities

- **LLM extraction**: high-level summary + structured todos
- **State machine orchestration**: deterministic, enum-driven pipeline
- **Notion integration**:
  - OAuth status + context fetch (projects, examples)
  - Fuzzy matching todo → existing Notion task
  - Create new tasks and update matched tasks

## API (high level)

The server runs on `http://localhost:3000` by default. Override with
`REASONING_PORT`.

- **Health**

  - `GET /health`

- **LLM-only processing**

  - `POST /process` (renderer-facing draft response)
  - `POST /api/process/high-level`
  - `POST /api/process` (runs orchestrator up to `TODOS_EXTRACTED`)

- **Notion**

  - `GET /api/notion/status`
  - `GET /api/notion/context`
  - `POST /api/notion/match`
  - `POST /api/notion/todos/update` (sync UI edits; stored in-memory)
  - `POST /api/notion/submit` (creates/updates in Notion)

- **End-to-end orchestrator**
  - `POST /api/orchestrator/process` (runs the full state machine)

## Notion integration notes

- **Tasks DB filtering**: search results from Notion MCP are filtered to only
  include pages whose `parent.database_id` matches the configured Tasks DB.
- **MCP connection resilience**: MCP search/fetch is treated as “best-effort”.
  Connection errors degrade matching gracefully instead of failing the full run.
- **UI edits syncing**: the server stores todo edits (status/priority/etc.)
  in-memory to ensure Submit uses the latest state from both app + server.

## Development

From the repo root:

```bash
pnpm dev:reasoning
```

Or inside this package:

```bash
pnpm dev
```

## Testing

```bash
pnpm test
```

Real-LLM integration test (manual):

```bash
TEST_TYPE=integration pnpm test:integration
```
