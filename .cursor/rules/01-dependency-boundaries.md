# .cursor/rules/01-dependency-boundaries.md

- Cross-package imports must use `@flwst/*`
- No deep relative imports across packages
- `types` imports nothing
- `libs/core` must not depend on React, Tamagui, Zustand, Electron, or Expo
- `servers/*` must not import `libs/ui`
- Shared code must live in the correct workspace
