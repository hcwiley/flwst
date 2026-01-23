# @flwst/electron Architecture

## Overview
The Electron app is the primary alpha client. It combines a main process that
owns lifecycle, encrypted local persistence, and crash reporting with a React
renderer that hosts the UI shell.

## Key Responsibilities
- Bootstrap the Electron lifecycle and window management.
- Initialize encrypted local storage (tokens + config).
- Provide a renderer UI shell for onboarding and workflow surfaces.
- Report crashes and logs to Sentry when configured.

## Dependencies
- `@flwst/core` for logging, run IDs, and encrypted storage utilities.
- `@sentry/electron` for crash reporting.
- `keytar` for OS keychain integration.

## Data Flow

```mermaid
flowchart TD
  subgraph Renderer[Electron Renderer]
    UI[React UI Shell]
  end

  subgraph Main[Electron Main Process]
    Lifecycle[App Lifecycle + Window]
    Storage[Encrypted Stores]
  end

  subgraph Core[Shared Core]
    CoreLib[@flwst/core]
  end

  subgraph OS[Local Machine]
    Keychain[OS Keychain]
    Files[App Data Directory]
  end

  subgraph Sentry[Sentry Cloud]
    SentryAPI[Crash + Log Events]
  end

  UI -->|IPC| Lifecycle
  Lifecycle --> Storage
  Storage --> CoreLib
  CoreLib --> Keychain
  CoreLib --> Files
  Main -->|errors/logs| SentryAPI
  Renderer -->|errors/logs| SentryAPI
```
