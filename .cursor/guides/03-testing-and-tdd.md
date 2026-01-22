# .cursor/guides/03-testing-and-tdd.md

## Default stance

TDD is required for:

- `libs/core`
- `types`
- server request/response validation

UI layout is not required to be TDD during alpha.

## Testing stack

- Vitest
- No real network calls
- No real Notion, Firebase, or Gemini usage

## Must-test areas

- Zod schemas (accept + reject)
- run ID generation
- path helpers
- config merge and validation
- deterministic helpers

## Conventions

- colocate tests: `foo.ts` → `foo.test.ts`
- fixtures in `__fixtures__/`
- avoid snapshots for core logic
