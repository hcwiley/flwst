# @flwst/electron

Electron + React client for the FlowState alpha. The main process handles window
lifecycle, encrypted local storage, and crash reporting, while the renderer
hosts the UI shell.

## Key Dependencies

- Electron + electron-vite
- React + TypeScript
- Tamagui (UI primitives)
- `@flwst/core` (logging, run IDs, encrypted storage)
- `@sentry/electron` (crash reporting)

## Architecture

See `ARCH.md` for the data flow and component responsibilities.

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
configuration, and onboarding state.

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
