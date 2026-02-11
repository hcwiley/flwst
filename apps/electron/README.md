# @flwst/electron

Electron + React client for the FlowState alpha. The main process handles window
lifecycle, encrypted local storage, configuration IPC, inbox ingestion, and
crash reporting, while the renderer hosts the UI shell, inbox pane, settings
rail, and prompt/preprocess controls.

## Key Dependencies

- Electron + electron-vite
- React + TypeScript
- Tamagui (UI primitives)
- `@flwst/core` (logging, run IDs, encrypted storage)
- `@flwst/prompts` (default prompt definitions)
- `@sentry/electron` (crash reporting)

## Architecture

See `ARCH.md` for the data flow and component responsibilities.

## Inbox Ingestion

The renderer collects transcript input (file drop or paste) and sends it to the
main process via IPC. The main process creates deterministic run IDs, applies
preprocess transforms (dictionary + ignore list), and persists local artifacts
(raw transcript, cleaned transcript, logs, bundle).

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) +
  [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) +
  [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
pnpm install
```

### Development

From the repo root:

```bash
pnpm --filter @flwst/electron dev
```

Or from this directory:

```bash
pnpm dev
```

#### Clear Local Storage

If you need to reset the app's local storage (e.g., to test onboarding from
scratch):

```bash
pnpm clear:storage
```

This removes the encrypted storage directory including all tokens,
configuration, and onboarding state. The script clears both production and
development storage locations so onboarding can start from a clean slate in
`pnpm dev`.

#### Environment Variables

- `SENTRY_DSN` (optional): Sentry DSN for error tracking
  - Example:
    `SENTRY_DSN=https://example-key@o1234567890123456.ingest.us.sentry.io/1234567890123456`
  - Set it when running: `SENTRY_DSN=... pnpm --filter @flwst/electron dev`
  - Or export it in your shell: `export SENTRY_DSN=...` then `pnpm dev`
- `SENTRY_LOGS_ENABLED` (optional): set to `true` to forward logs to Sentry
- `NOTION_CLIENT_ID` (required): Notion OAuth client ID
- `NOTION_CLIENT_SECRET` (required): Notion OAuth client secret
- `NOTION_REDIRECT_URI` (required): OAuth callback URL (e.g.,
  `http://localhost:3000/auth/notion/callback`)

If `SENTRY_DSN` is not set, Sentry will be disabled and a warning will be
logged.

### Build

```bash
# For Windows
pnpm build:win

# For macOS
pnpm build:mac

# For Linux
pnpm build:linux
```

### Building for distribution (e.g. DMG)

To produce a distributable Mac build (DMG and zip):

1. Set `NODE_ENV=production` if you want production optimizations (optional; electron-vite uses mode from the build command).
2. From the repo root: `pnpm --filter @flwst/electron build:mac`, or from this directory: `pnpm build:mac`.
3. The DMG and zip artifacts are written to `apps/electron/release/` (e.g. `flwst-1.0.0.dmg`). Install the app from the DMG on a target Mac for smoke testing.

**Packaging memory:** The dist scripts set `NODE_OPTIONS=--max-old-space-size=16384` (16GB) so electron-builder’s node-module collector has enough heap in monorepos. If you still see “JavaScript heap out of memory”, raise it (e.g. `NODE_OPTIONS='--max-old-space-size=24576' pnpm build:mac`) or ensure no other heavy processes are running.
