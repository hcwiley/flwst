# flwst

> flow state: AI workflow to get your mind in order so you flow through your day.

monorepo for the Electron client, server scaffolding, and shared
libraries.

## Architecture

See `ARCH.md` for the current system overview and data flow. The Electron app
uses push-based IPC for onboarding and manages local config (preprocess, prompt
overrides) in encrypted storage, with an Inbox ingestion flow that writes
artifacts locally. The Firebase server exposes POST `/generate` for
server-mediated LLM calls: the client sends transcript and resolved prompts and
receives a daily note and task feed (Phase 6).

## Monorepo Structure

This is a pnpm + Turbo monorepo with the following structure:

```
flwst/
├── apps/
│   ├── electron/          # Electron desktop app (Phase 5 in progress)
│   └── mobile/            # Expo mobile app (stub only)
├── libs/
│   ├── core/              # Core runtime utilities (paths, runIds, logger)
│   ├── prompts/           # Default prompt templates (dailyNote, taskDraft)
│   ├── ui/                # Tamagui UI configuration (Phase 1: scaffolding)
│   ├── state/             # Zustand store scaffolding
│   └── integrations/      # Integration config types (Notion, Firebase, etc.)
├── types/                 # Shared TypeScript types and Zod schemas
├── servers/
│   └── firebase/          # Firebase Functions + Hosting (Phase 6: /generate API)
├── config/
│   └── examples/          # Example config files (sanitized)
├── prompts/               # AI prompt templates
├── inbox/                 # Input transcripts (not tracked)
├── tmp/                   # Temporary files (not tracked)
└── archive/               # Archived files (not tracked)
```

### Packages

All workspace packages use the `@flwst/*` namespace:

- `apps/electron` - Electron app (`apps/electron/README.md`)
- `apps/mobile` - Expo stub (`apps/mobile/README.md`)
- `servers/firebase` - Firebase server with /generate API (`servers/firebase/README.md`)
- `libs/core` - Core utilities (`libs/core/README.md`)
- `libs/prompts` - Default prompt templates (`libs/prompts/README.md`)
- `libs/ui` - Tamagui UI config (`libs/ui`)
- `libs/state` - Zustand store scaffold (`libs/state`)
- `libs/integrations` - Integration types (`libs/integrations`)
- `types` - Shared types and Zod schemas (`types`)

### Module System

- **Shared packages** (`types`, `libs/*`): ESM
- **Electron main process**: CommonJS (can migrate to ESM later)
- **Firebase Functions**: CommonJS
- **Electron renderer / Expo**: ESM (bundlers assume this)

## Legacy Structure (Pre-Phase 1)

The following directories are from the pre-monorepo version and are still used:

- `inbox/`: all your incoming tasks, voice notes, images, etc.
- `prompts/`: all your the canned prompts for the AI to process the inbox.
- `config/`: all your the configuration for the AI to use.
  - Note: Not tracked by git (except the `config/examples/` directory).
- `tmp/`: all your the temporary files for the AI to use.
  - Note: Not tracked by git.
- `archive/`: all your the archived files for the AI to use.
  - Note: Not tracked by git.

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 8+
- Firebase CLI (for server deployment; see `servers/firebase/README.md`)

### Install Dependencies

```bash
pnpm install
```

### Build All Packages

```bash
pnpm build
# or
pnpm turbo run build
```

To build a distributable Electron app (e.g. Mac DMG), see [Building for distribution](apps/electron/README.md#building-for-distribution-eg-dmg) in `apps/electron/README.md`.

### Type Check

```bash
pnpm typecheck
# or
pnpm turbo run typecheck
```

### Initialize Apps (Manual Steps Required)

#### Electron App

The Electron app is already initialized. To run it:

```bash
pnpm --filter @flwst/electron dev
```

#### React Native (Expo) App

```bash
cd apps/mobile
npx create-expo-app@latest . --template blank-typescript
```

See `apps/mobile/INIT_COMMANDS.md` for details.

### Firebase Server Setup

See `servers/firebase/README.md` for manual Firebase Console setup steps.

## Deployment

Deployment covers two surfaces: the **Electron desktop app** (installer/DMG) and
the **Firebase server** (API + Hosting). Both are required for the alpha
end-to-end flow.

### Electron app (desktop)

```bash
source .env.alpha
pnpm dist:electron
```

Distributable builds are produced from `apps/electron` using electron-builder.

- **Prerequisites:** Node.js 20+, pnpm 8+, dependencies installed at repo root.
- **Build commands** (from repo root or `apps/electron`):
  - macOS: `pnpm --filter @flwst/electron build:mac` → DMG and zip in
    `apps/electron/release/`
  - Windows: `pnpm --filter @flwst/electron build:win`
  - Linux: `pnpm --filter @flwst/electron build:linux`
- **Config:** `apps/electron/electron-builder.yml` (app id, targets, notarization
  off by default).
- **Smoke test:** Install the built app (e.g. DMG on a clean Mac) and run
  through onboarding and a single ingest → publish run.

See [Building for distribution](apps/electron/README.md#building-for-distribution-eg-dmg)
in `apps/electron/README.md` for step-by-step DMG build and environment notes.

### Firebase server (API + Hosting)

The FlowState API (e.g. POST `/generate`) and hosting are deployed via Firebase
CLI from `servers/firebase`.

- **Prerequisites:** Firebase CLI, Firebase project created and linked (see
  `servers/firebase/README.md`).
- **Deploy:**
  ```bash
  cd servers/firebase
  pnpm deploy
  ```
  Use `pnpm deploy:functions` or `pnpm deploy:hosting` for partial deploys.
- **Environment:** Set runtime env for Functions (e.g. in Firebase Console or
  via `.env`/secret config): `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`,
  `GOOGLE_GENAI_USE_VERTEXAI`. See `servers/firebase/README.md` and
  `config/examples/firebase.functions.env.example`.

See `servers/firebase/README.md` for API contract, structure, and manual
Firebase Console setup.
