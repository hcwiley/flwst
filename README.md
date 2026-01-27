# flwst

FlowState alpha monorepo for the Electron client, server scaffolding, and shared
libraries.

## Architecture

See `ARCH.md` for the current system overview and data flow.
The Electron onboarding flow uses push-based IPC updates to keep the renderer
in sync with migration state.

## Monorepo Structure

This is a pnpm + Turbo monorepo with the following structure:

```
flwst/
├── apps/
│   ├── electron/          # Electron desktop app (Phase 2 complete)
│   └── mobile/            # Expo mobile app (stub only)
├── libs/
│   ├── core/              # Core runtime utilities (paths, runIds, logger)
│   ├── ui/                # Tamagui UI configuration (Phase 1: scaffolding)
│   ├── state/             # Zustand store scaffolding
│   └── integrations/      # Integration config types (Notion, Firebase, etc.)
├── types/                 # Shared TypeScript types and Zod schemas
├── servers/
│   └── firebase/          # Firebase Functions + Hosting (Phase 6+)
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
- `servers/firebase` - Firebase server scaffold (`servers/firebase/README.md`)
- `libs/core` - Core utilities (`libs/core/README.md`)
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
- Firebase CLI (for server deployment, Phase 6+)

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

## Legacy Setup (Pre-Phase 1)

Install Notion MCP (legacy workflow only):

- https://developers.notion.com/docs/get-started-with-mcp

Install Cursor:

- https://www.cursor.com/

### Notion Databases

Get the database IDs from the Notion database settings and paste them into the
`config/notion.ts` file. Optional but highly recommended as it will cut down on
the number of API calls and improve performance.

![Copy Notion Database ID](./docs/copy-database-id.gif)

#### Daily Notes

- `Name`: The name of the daily note.
- `Date`: The date of the daily note.
- `Summary`: A high level summary of the daily note.
- `Tags`: A list of tags to group daily notes.
- `Tasks`: Relation to the Tasks Page that task is from or referenced in (Many
  to Many relationship)

#### Tasks

- `Name`: The name of the task.
- `Project`: The project the task is associated with (optional)
- `Description`: The description of the task.
- `Priority`: The priority of the task.
- `Status`: The status of the task.
- `Tags`: A list of tags to group tasks (optional)
- `Due Date`: The due date of the task (optional)
- `Assignee`: The assignee of the task (optional)
- `Daily Notes`: Relation to the Daily Notes Page that task is from or
  referenced in (Many to Many relationship)

### configs

Copy the `config/examples/` directory to `config/` and edit the files as needed.

- `config/notion.ts`: Update the names of various Notion databases and
  properties.
- `config/spelling.ts`: Update the spelling of various words and phrases.

## Usage

1. Capture your thoughts (voice memo, typed notes, etc.) and place the
   transcript inside `inbox/`.
2. Run the `/process_inbox` command:
   - Confirm each checkpoint with `yes`, pause to make manual edits and reply
     `fixed`, or abandon with `quit`.
   - The command generates a high-level `tmp/daily_note.md` plus
     `tmp/tasks/{task}/DRAFT.md`/`REVIEW.md` folders so you can review every
     artifact before it touches Notion.
   - The Daily Note stays narrative-only; once Tasks are written to Notion, the
     `## TODOs` section is replaced with a small table that links directly to
     each Task page (no duplicated acceptance criteria).
   - Tasks are created or updated in Notion **before** the Daily Note so the
     final note can link to every task using the shared `[[Task Handle]]`
     placeholders.
   - Expect a final success message summarizing the Daily Note link,
     created/updated task links, and the archive path (e.g.,
     `archive/2025-01-01/`).
3. (Optional) Run `/list_daily` to spot-check recent Daily Notes or confirm
   links.
