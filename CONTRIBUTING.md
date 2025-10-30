# Contributing to flwst

Thanks for your interest in contributing!

## Getting started
- Node 20+, pnpm 9+
- Install deps: `pnpm install`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Format: `pnpm format`

## Commit style
We use Conventional Commits. Examples:
- `feat: add import_daily command`
- `fix: correct Notion database lookup`
- `docs: update README quick start`
- `chore(eslint): tweak rule for type-aware checks`

## Pull requests
- Keep PRs small and focused; explain why the change is needed.
- Include tests or manual verification steps where applicable.
- Update documentation (README or command files) when behavior changes.

## Code style
- ESLint + Prettier are configured. Run `pnpm lint` and `pnpm format`.
- Prefer readable names and early returns.
- Avoid catching errors without handling.

## Development notes
- Real configs are local-only; only commit examples under `config/examples/`.
- Commands live under `.cursor/commands/` and should be self-contained.

## Release hygiene
- Do not include secrets or tokens in commits, issues, or PRs.
- Use example data for docs and screenshots.

Thanks again for helping improve flwst!
