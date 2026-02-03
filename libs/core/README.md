# @flwst/core

Shared runtime utilities used by the apps and services. This package focuses on
deterministic IDs, logging, and encrypted local storage helpers.

## Key Responsibilities

- Generate stable run IDs for ingests.
- Provide a structured logger with optional external sinks.
- Handle encrypted local storage for config, prompt overrides, and tokens.
- Centralize file path helpers for app storage.

## Architecture

See `ARCH.md` for the storage-focused data flow.

## Structure

- `src/runIds.ts` - deterministic run ID utilities
- `src/logger.ts` - structured logger and external sink adapter
- `src/paths.ts` - shared filesystem paths
- `src/storage/*` - encryption helpers and store implementations

## Scripts

From the repo root:

- `pnpm --filter @flwst/core build`
- `pnpm --filter @flwst/core typecheck`
- `pnpm --filter @flwst/core test`

## Usage Notes

The encrypted storage helpers are designed for Electron main process usage and
expect a Keychain-compatible adapter (e.g., `keytar`).
