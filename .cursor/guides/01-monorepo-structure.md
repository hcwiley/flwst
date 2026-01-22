# .cursor/guides/01-monorepo-structure.md

## Repo layout

```text
apps/
  electron/
  mobile/
libs/
  core/
  ui/
  integrations/
types/
servers/
  firebase/
config/
  examples/
```

## Dependency boundaries

### Allowed

- `apps/*` → `libs/*`, `types`
- `libs/*` → `types`
- `servers/*` → `types`, `libs/core` (preferred)

### Forbidden

- `types` importing anything
- `libs/core` importing React, Tamagui, Zustand, Electron, or Expo
- `servers/*` importing `libs/ui`
- Deep relative imports across packages

## Package naming

Workspace packages use the `@flwst/*` scope:

- `@flwst/types`
- `@flwst/core`
- `@flwst/ui`
- `@flwst/integrations`
- `@flwst/mobile` (located at `apps/mobile`)

All cross-package imports must use workspace names.

## Public API surface

Each package exposes its public API from:

- `src/index.ts`

No other file is public unless explicitly re-exported.

## pnpm + Turbo conventions

### Required root scripts:

- `build`
- `typecheck`
- `test`
- `lint`
- `format`

### Turbo pipeline rules:

- `build` depends on `^build`
- `typecheck` uses project references (`tsc -b`) or depends on `^typecheck`
