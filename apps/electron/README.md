# @flwst/electron

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

#### Environment Variables

The app requires the following environment variables for full functionality:

- **SENTRY_DSN** (optional): Sentry DSN for error tracking
  - Example: `SENTRY_DSN=https://example-key@o1234567890123456.ingest.us.sentry.io/1234567890123456`
  - Set it when running: `SENTRY_DSN=... pnpm dev:electron`
  - Or export it in your shell: `export SENTRY_DSN=...` then `pnpm dev:electron`

If `SENTRY_DSN` is not set, Sentry will be disabled and a warning will be logged.

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```
