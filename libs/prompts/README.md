# @flwst/prompts

Default prompt templates for the MVP pipeline. This package is the source of
truth for `dailyNote` and `taskDraft`; user config stores overrides only.

## Key Responsibilities

- Define default prompt definitions (key, title, version, template).
- Provide fence-based templates for Daily Note + Task Feed and per-task drafts.
- No placeholder/templating fields; templates are plain text.

## Architecture

See `ARCH.md` for the prompt definition flow.

## Structure

- `src/definitions.ts` - `dailyNote` and `taskDraft` definitions
- `src/index.ts` - public exports

## Scripts

From the repo root:

- `pnpm --filter @flwst/prompts build`
- `pnpm --filter @flwst/prompts typecheck`
- `pnpm --filter @flwst/prompts lint`
