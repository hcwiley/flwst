# flwst

flow state: AI workflow to get your mind in order so you flow through your day.

Neat. What does it do?

`flwst` is grouping of prompts, how-tos, and scripts to go from thinking to process management to execution without you having to do a lot of time consuming PM work (make tickets, update statuses, etc.)

The initial integration targets:
- Input from Voice Notes transcript
- Processing of raw input via canned prompts
- Generating and updating of tasks in Notion via MCP

## structure

- `inbox/`: all your incoming tasks, voice notes, images, etc.
- `prompts/`: all your the canned prompts for the AI to process the inbox.
- `config/`: all your the configuration for the AI to use.
- `commands/`: all your the commands for the AI to execute.
- `utils/`: all your the utilities for the AI to use.

## usage

- Install deps:
  - `pnpm install`

- Run a TypeScript file directly:
  - `pnpm ts path/to/script.ts`

- Watch mode (auto-reload on changes):
  - `pnpm dev path/to/script.ts`

- Type-check/build (no emit):
  - `pnpm run build`

### commands

- List entries in the `Daily Notes` database via Notion MCP:
  - Ensure your Notion MCP server is available; set env var:
    - `NOTION_MCP_CMD` (e.g., `notion-mcp`)
    - optionally `NOTION_MCP_ARGS` (space-separated)
  - Ensure your local `config/notion.ts` contains `notionConfig.databaseNames.dailyNotes`.
  - Run:
    - `pnpm run list:daily`
