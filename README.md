ai-localstack-ts-template

TypeScript monorepo template for building AI-first local apps: Electron frontends, Node servers, and shared libraries, with a focus on running local LLMs and other AI models.

Goals

	•	Local-first AI: easy to point at local LLM runtimes (Ollama, LM Studio, etc.) or self-hosted APIs.

	•	Full-stack: desktop (Electron), web, and servers in one monorepo.

	•	Single toolchain: one TypeScript + ESLint + Prettier setup across everything.

	•	Shared domain model: types and utilities reused across apps and services.

	•	Minimal but opinionated enough that you can start shipping immediately.

⸻

Stack

	•	Language: TypeScript

	•	Package manager: pnpm workspaces

	•	Node: 20+ recommended

	•	Linting: ESLint (TypeScript + import/order + promise rules)

	•	Formatting: Prettier

	•	Testing: Vitest (unit/integration) – swap if you prefer something else

	•	Monorepo layout: apps/, servers/, libs/, types/

No specific UI or backend framework is enforced; those are stubbed and can be replaced (e.g., React vs. something else, Fastify vs. Express, etc.).

⸻

Repository layout

ai-localstack-ts-template/

├─ apps/

│  ├─ desktop/          # Electron shell for local AI apps

│  ├─ web/              # Web client (optional, Vite/React stub)

│  └─ cli/              # CLI tools for automation / dev scripts

├─ servers/

│  └─ api/              # HTTP/WS API server for AI + app logic

├─ libs/

│  ├─ ai/               # Local AI / LLM clients & model utilities

│  ├─ core/             # Domain logic, pure TS utilities

│  └─ ui/               # Shared UI components (if using React)

├─ types/               # Shared types (DTOs, domain models, contracts)

├─ .eslintrc.cjs        # Shared ESLint config wired to tsconfig paths

├─ .prettierrc          # Prettier config

├─ pnpm-workspace.yaml  # Monorepo workspace definition

├─ package.json         # Root scripts and devDependencies

└─ tsconfig.base.json   # Base TS config extended by all packages

Adjust apps/, servers/, and libs/ to match your actual projects; the template is just a starting point.

⸻

Local AI focus

This template assumes:

	•	You will run your models locally (e.g., http://localhost:11434 for Ollama, similar for others).

	•	Your app talks to them through a small client library instead of scattering fetch calls everywhere.

Suggested pattern (implemented in libs/ai):

	•	libs/ai/config.ts – central place for model endpoints / timeouts / headers.

	•	libs/ai/client.ts – generic runModel({ model, prompt, ... }) helper.

	•	libs/ai/pipelines/ – higher-level flows (chat, tools, embeddings, reranking).

You plug in your actual runtime (Ollama, LM Studio, vLLM, custom Docker stack) without changing app code outside libs/ai.

⸻

Getting started

1. Use this template

Either:

	•	Use the “Use this template” button on GitHub, or

	•	Clone and strip the Git history:

git clone git@github.com:YOUR-ORG/ai-localstack-ts-template.git new-project

cd new-project

rm -rf .git

git init

Rename the repo/folder as needed.

2. Install dependencies

pnpm install

If you insist on npm/yarn, you can adapt the workspace config, but pnpm is assumed.

3. Configure Node and editor

	•	Ensure Node 20+.

	•	Point your editor at the root tsconfig.base.json so path aliases and types work everywhere.

	•	Enable ESLint + Prettier integrations in your editor.

⸻

Scripts

Root package.json (typical set):

{

  "scripts": {

    "dev:desktop": "pnpm --filter apps/desktop dev",

    "dev:web": "pnpm --filter apps/web dev",

    "dev:api": "pnpm --filter servers/api dev",

    "lint": "eslint .",

    "lint:fix": "eslint . --fix",

    "test": "vitest --runInBand",

    "typecheck": "tsc -p tsconfig.base.json --noEmit"

  }

}

Run from the repo root, for example:

pnpm dev:desktop

pnpm dev:api

pnpm lint

pnpm test

pnpm typecheck

Adjust filters and scripts to match your actual package names.

⸻

Shared types and libraries

All cross-cutting types live under types/. Conventions:

	•	Define DTOs and domain models in types/ only.

	•	Import them via aliased paths (e.g., @types/scene, @types/user).

	•	Do not redefine types inside apps/ or servers/ – depend on types/.

Typical structure:

types/

├─ ai/

│  ├─ messages.ts      # Chat messages, tool calls, etc.

│  └─ models.ts        # Model identifiers, capabilities

├─ app/

│  ├─ user.ts          # User, session, auth tokens (no secrets)

│  └─ config.ts        # Shared config types

└─ index.ts            # Barrel exports

Use libs/core for logic that depends on these types but not on any runtime (no Node/Electron/browser APIs).

⸻

ESLint & Prettier

Core rules enforced:

	•	TypeScript recommended rules.

	•	No unused variables/imports.

	•	Consistent import ordering (builtin → external → internal).

	•	Prettier formatting as the single source of truth.

Typical workflows:

pnpm lint        # CI / local check

pnpm lint:fix    # apply fixes

Hook this into pre-commit if you want:

npx simple-git-hooks

# configure .simple-git-hooks/pre-commit to run `pnpm lint`

⸻

How to adapt this template for a new project

Use this as a checklist:

	•	Rename the repo and update this README.md.

	•	Update package.json name, author, and license.

	•	Configure libs/ai to point at your local LLM runtime (URLs, auth, default model names).

	•	Add/replace apps/desktop with your actual Electron app shell.

	•	Add/replace servers/api with your preferred HTTP framework.

	•	Define your domain types under types/ and wire them into libs/core.

	•	Set up CI (GitHub Actions, etc.) to run pnpm lint, pnpm test, and pnpm typecheck.

Once this is done, you’ve got a clean TypeScript AI monorepo you can reuse for future projects.

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
  - Note: Not tracked by git (except the `config/examples/` directory).
- `tmp/`: all your the temporary files for the AI to use.
  - Note: Not tracked by git.
- `archive/`: all your the archived files for the AI to use.
  - Note: Not tracked by git.

## setup

Install Notion MCP:

- https://developers.notion.com/docs/get-started-with-mcp

Install Cursor:

- https://www.cursor.com/

### Notion Databases

Get the database IDs from the Notion database settings and paste them into the `config/notion.ts` file. Optional but highly recommended as it will cut down on the number of API calls and improve performance.

![Copy Notion Database ID](./docs/copy-database-id.gif)

#### Daily Notes

- `Name`: The name of the daily note.
- `Date`: The date of the daily note.
- `Summary`: A high level summary of the daily note.
- `Tags`: A list of tags to group daily notes.
- `Tasks`: Relation to the Tasks Page that task is from or referenced in (Many to Many relationship)

#### Tasks

- `Name`: The name of the task.
- `Project`: The project the task is associated with (optional)
- `Description`: The description of the task.
- `Priority`: The priority of the task.
- `Status`: The status of the task.
- `Tags`: A list of tags to group tasks (optional)
- `Due Date`: The due date of the task (optional)
- `Assignee`: The assignee of the task (optional)
- `Daily Notes`: Relation to the Daily Notes Page that task is from or referenced in (Many to Many relationship)

### configs

Copy the `config/examples/` directory to `config/` and edit the files as needed.

- `config/notion.ts`: Update the names of various Notion databases and properties.
- `config/spelling.ts`: Update the spelling of various words and phrases.

## Usage

1. Capture your thoughts (voice memo, typed notes, etc.) and place the transcript inside `inbox/`.
2. Run the `/process_inbox` command:
   - Confirm each checkpoint with `yes`, pause to make manual edits and reply `fixed`, or abandon with `quit`.
   - The command generates a high-level `tmp/daily_note.md` plus `tmp/tasks/{task}/DRAFT.md`/`REVIEW.md` folders so you can review every artifact before it touches Notion.
   - The Daily Note stays narrative-only; once Tasks are written to Notion, the `## TODOs` section is replaced with a small table that links directly to each Task page (no duplicated acceptance criteria).
   - Tasks are created or updated in Notion **before** the Daily Note so the final note can link to every task using the shared `[[Task Handle]]` placeholders.
   - Expect a final success message summarizing the Daily Note link, created/updated task links, and the archive path (e.g., `archive/2025-01-01/`).
3. (Optional) Run `/list_daily` to spot-check recent Daily Notes or confirm links.
