# @flwst/electron

Electron + React client for the FlowState alpha. The main process handles
window lifecycle, encrypted local storage, and crash reporting, while the
renderer hosts the UI shell.

## Key Dependencies

- Electron + electron-vite
- React + TypeScript
- Tamagui (UI primitives)
- `@flwst/core` (logging, run IDs, encrypted storage)
- `@sentry/electron` (crash reporting)

## Architecture

See `ARCH.md` for the data flow and component responsibilities.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

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

#### Environment Variables

- `SENTRY_DSN` (optional): Sentry DSN for error tracking
  - Example: `SENTRY_DSN=https://example-key@o1234567890123456.ingest.us.sentry.io/1234567890123456`
  - Set it when running: `SENTRY_DSN=... pnpm --filter @flwst/electron dev`
  - Or export it in your shell: `export SENTRY_DSN=...` then `pnpm dev`
- `SENTRY_LOGS_ENABLED` (optional): set to `true` to forward logs to Sentry

If `SENTRY_DSN` is not set, Sentry will be disabled and a warning will be logged.

### Build

```bash
# For Windows
pnpm build:win

# For macOS
pnpm build:mac

# For Linux
pnpm build:linux
```
