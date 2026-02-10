# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format

# Run all tests
pnpm test

# Run Electron app in dev mode
pnpm dev:electron
# or: pnpm --filter @flwst/electron dev

# Run single Electron test file
pnpm --filter @flwst/electron test -- "src/main/**/*.test.ts"

# Build distributable Electron app (Mac DMG)
source .env.alpha && pnpm dist:electron

# Clear Electron storage (for debugging)
pnpm clear:storage

# Firebase Functions dev (from servers/firebase)
cd servers/firebase && pnpm dev:functions

# Deploy Firebase
cd servers/firebase && pnpm deploy
```

## Architecture Overview

This is a pnpm + Turbo monorepo for FlowState, an AI workflow desktop app with Notion integration.

### Package Structure

- `apps/electron` - Electron desktop client with React/Tamagui UI, Notion OAuth, encrypted storage
- `apps/mobile` - Expo mobile app (stub only)
- `servers/firebase` - Firebase Functions with `/generate` API endpoint (Vertex AI Gemini)
- `libs/core` - Core utilities: logger, run IDs, encrypted storage, crypto helpers
- `libs/prompts` - Default prompt templates for LLM calls
- `libs/ui` - Tamagui UI configuration and components
- `libs/state` - Zustand store scaffolding
- `libs/integrations` - Integration configuration types (Notion, Firebase)
- `types` - Shared Zod schemas and TypeScript types

### Module Systems

- Shared packages (`types`, `libs/*`): ESM
- Electron main process: CommonJS
- Firebase Functions: CommonJS
- Electron renderer / Expo: ESM (bundlers assume this)

### Data Flow

The Electron app uses push-based IPC for onboarding. Main process manages:
- Encrypted storage (tokens, config) via `keytar` + OS keychain
- Notion OAuth flow and database schema validation
- Inbox ingestion pipeline with local artifact persistence

The Firebase server's POST `/generate` receives transcript + prompts, calls Gemini, returns parsed daily note and task feed.

## Code Conventions

### Imports (Critical)

- Cross-package imports MUST use `@flwst/*` workspace names
- Never use file extensions in imports (no `.js`, `.ts`)
- Never import from `/src/` directories (use package entry points)
- Relative imports only within the same package

```typescript
// Correct
import { logger } from '@flwst/core';
import type { Task } from '@flwst/types';
import { someUtil } from './utils';

// Wrong
import { logger } from '@flwst/core/src/logger.js';
import { Task } from '../../types/src/core.ts';
```

### Types

- All shared domain types live in `types/src/**`
- Zod schemas are canonical - derive TypeScript types via `z.infer`
- Validate external inputs at boundaries with Zod
- Import shared types: `import type { Foo } from '@flwst/types';`

### UI

- Use Tamagui components for all UI, or wrappers from `@flwst/ui`
- Never use raw HTML elements or React Native primitives directly
- Never hardcode styles/colors - use Tamagui tokens

### Logging

- Use structured logger from `@flwst/core`, never `console.log`
- Include metadata objects for context

```typescript
import { logger } from '@flwst/core';
logger.info('User logged in', { userId: '...' });
logger.error('Failed to save config', { error: err.message });
```

### Dependencies

- `libs/core` must not depend on React, Tamagui, Zustand, Electron, or Expo
- `servers/*` must not import `libs/ui`
- `types` imports nothing
