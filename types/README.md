# @flwst/types

Shared TypeScript types and Zod schemas for the FlowState monorepo.

## Overview

This package provides runtime-validated type definitions used across the entire
monorepo. All types are defined using Zod schemas for runtime validation at API
and storage boundaries, with TypeScript types inferred from the schemas.

## Key Schemas

### Core Types (`src/core.ts`)

- `PrioritySchema`: Task priority levels (low, medium, high, urgent)
- `NotionErrorCodeSchema`: Typed error codes for Notion API operations

### Configuration (`src/config.ts`)

- `TokensSchema`: OAuth tokens and resource IDs (stored in `TokensStore`)
  - `notionAccessToken`: Notion OAuth access token
  - `notionDailyNotesDataSourceId`: Daily Notes database data source ID
  - `notionTodosDataSourceId`: Tasks database data source ID
- `UserConfigSchema`: Application configuration (stored in `ConfigStore`)
  - `notion.flowStatePageId`: Parent page ID
  - `notion.dailyNotesDataSourceId`: Daily Notes data source ID
  - `notion.todosDataSourceId`: Tasks data source ID
  - `onboardingState`: Onboarding progress

### Onboarding (`src/onboarding.ts`)

- `OnboardingStateSchema`: Complete onboarding state management
- `NotionWorkspaceStateSchema`: Notion-specific onboarding state
  - OAuth status tracking
  - Resource creation state
  - Data source ID persistence

### Notion Integration (`src/notion.ts`)

- `NotionWorkspaceMetadataSchema`: Workspace identification data
- Notion-specific type definitions for API interactions

## Usage

### In Application Code

```typescript
import {
  TokensSchema,
  UserConfigSchema,
  type Tokens,
  type UserConfig,
} from '@flwst/types';

// Parse and validate at runtime
const tokens = TokensSchema.parse(rawData);

// Use inferred TypeScript types
function storeTokens(tokens: Tokens): void {
  // TypeScript knows the shape of tokens
  console.log(tokens.notionAccessToken);
}
```

### In Storage Layers

```typescript
import { TokensSchema } from '@flwst/types';
import { ConfigStore } from '@flwst/core';

const tokensStore = new ConfigStore({
  filename: 'tokens.json',
  schema: TokensSchema,
});

// Automatic validation on read/write
await tokensStore.write({ notionAccessToken: 'token' /* ... */ });
```

## Data Source IDs vs Database IDs

Starting with Notion API 2025-09-03, database schemas are managed through
`data_source_id` rather than `database_id`. This package reflects that change:

- `notionDailyNotesDataSourceId` (was: `notionDailyNotesDbId`)
- `notionTodosDataSourceId` (was: `notionTodosDbId`)
- `dailyNotesDataSourceId` (was: `dailyNotesDbId`)
- `tasksDataSourceId` (was: `tasksDbId`)

All schemas have been updated to use data source IDs for consistency with the
Notion API's schema management model.

## Type Safety Philosophy

1. **Define once, validate everywhere**: Schemas are the source of truth
2. **Runtime validation**: All external data is validated with Zod
3. **Type inference**: TypeScript types are inferred from Zod schemas
4. **Fail fast**: Invalid data throws at the boundary, not deep in the call
   stack

## Dependencies

- `zod`: Runtime type validation

## Building

```bash
pnpm build
```

This compiles TypeScript to JavaScript and generates type definitions.
