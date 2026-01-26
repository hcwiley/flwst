# @flwst/firebase Architecture

## Overview

The Firebase server is the planned API layer for server-mediated LLM calls and
Notion sync. It is scaffolded as Firebase Functions + Hosting and will own
secrets, validation, and request logging.

## Key Responsibilities

- Receive client requests from the Electron app.
- Validate payloads and enforce basic auth/rate limits (Phase 6).
- Call the Gemini API and return structured outputs (Phase 6).
- Write to Notion APIs for notes and tasks (Phase 7).

## Dependencies

- Firebase Functions + Hosting
- Gemini API (planned)
- Notion API (planned)

## Data Flow

```mermaid
flowchart TD
  subgraph Client[Electron App]
    App[Renderer + Main]
  end

  subgraph Firebase[Firebase Hosting + Functions]
    Functions[FlowState API]
  end

  subgraph LLM[LLM Provider]
    Gemini[Gemini API]
  end

  subgraph Notion[Notion Cloud]
    NotionAPI[Notion API]
  end

  App -->|HTTPS| Functions
  Functions -.->|LLM request| Gemini
  Functions -.->|Publish notes/tasks| NotionAPI
```
