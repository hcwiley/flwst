# Repository Architecture

## Overview

This monorepo provides:

- An **Electron desktop client** for ingestion, review, and local persistence.
- A **Firebase server scaffold** for server-mediated LLM calls (Phase 6).
- Shared **types** and **core utilities** for schema validation and storage.

## Key Components

- **Electron app**: `apps/electron`
- **Firebase server**: `servers/firebase`
- **Core utilities**: `libs/core`
- **Shared types**: `types`

## Data Flow

```mermaid
flowchart TD
  subgraph App[apps/electron]
    Renderer[Renderer UI]
    Main[Main Process]
  end

  subgraph Core[libs/core]
    Stores[Encrypted Stores]
    Crypto[Crypto Helpers]
  end

  subgraph Local[Local Machine]
    Keychain[OS Keychain]
    Files[App Data Directory]
  end

  subgraph Sentry[Sentry]
    SentryAPI[Crash + Log Events]
  end

  subgraph Firebase[servers/firebase]
    Functions[Firebase Functions]
  end

  subgraph LLM[LLM Provider]
    Gemini[Gemini API]
  end

  subgraph Notion[Notion Cloud]
    NotionAPI[Notion API]
  end

  Renderer --> Main
  Main --> Stores
  Stores --> Crypto
  Crypto --> Keychain
  Crypto --> Files
  Main --> SentryAPI
  Renderer --> SentryAPI

  Renderer -.->|HTTPS (planned)| Functions
  Functions -.-> Gemini
  Functions -.-> NotionAPI
```

## Notes / Constraints

- Firebase integration is scaffolded; server-mediated LLM and Notion sync are
  implemented in Phase 6+.
- Encrypted local storage is the current system of record for tokens/config.
