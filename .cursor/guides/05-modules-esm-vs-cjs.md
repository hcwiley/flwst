# .cursor/guides/05-modules-esm-vs-cjs.md

## Module strategy (alpha)

Hybrid approach:

- `types`, `libs/*`: ESM-compatible
- `apps/electron/main`: CJS output
- `servers/firebase/functions`: CJS output
- renderer / Expo / mobile: bundled ESM

## Rationale

Node-runtime targets are least fragile with CJS during alpha. Bundled targets
prefer ESM.

## Rule

- If code runs directly in Node → prefer CJS
- If code is bundled → prefer ESM

Do not unify module formats repo-wide during Phase 1.
