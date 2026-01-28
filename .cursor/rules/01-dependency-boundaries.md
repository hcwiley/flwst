# .cursor/rules/01-dependency-boundaries.md

## Rules

- Cross-package imports must use `@flwst/*` (workspace names).
- No deep relative imports across packages (e.g., `../../libs/core/src/...`).
- **Never** include `.js` or `.ts` extensions in import paths.
- **Never** import from a `src/` directory directly (e.g.,
  `@flwst/core/src/logger.js`). Use the package entry point instead.
- `types` imports nothing.
- `libs/core` must not depend on React, Tamagui, Zustand, Electron, or Expo.
- `servers/*` must not import `libs/ui`.
- Shared code must live in the correct workspace.

## Forbidden

- Imports with file extensions (`.js`, `.ts`).
- Imports containing `/src/` for workspace packages.
- Relative imports that cross package boundaries.
