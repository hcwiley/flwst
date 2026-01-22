# .cursor/guides/06-cursor-workstyle.md

## Implementation order

1. Docs and file tree
2. Types and schemas
3. Pure utilities (`libs/core`)
4. Tests
5. App wiring

## Chunking

- One phase step per change-set
- No mixed refactor + feature work

## Stop conditions

Pause and ask when:

- a CLI init requires interactive input
- real secrets are needed
- ESM/CJS conflicts require policy decisions
- Expo/Tamagui monorepo wiring becomes nontrivial
