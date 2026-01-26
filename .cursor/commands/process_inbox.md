---
name: process_inbox
description:
  Consolidate inbox ingestion, Daily Note drafting, and Tasks updates via Notion
  MCP
---

Usage: `/process_inbox`

Inputs:

- `yes`: confirm the current checkpoint and proceed to the next phase.
- `fixed`: the user has applied the requested edits (e.g., to
  `tmp/daily_note.md` or `tmp/tasks/*`) and wants the agent to re-validate
  before continuing.
- `quit`: stop immediately, clean up any partial work in `tmp/`, and reset the
  context.

Goal: Take every transcript or note in `inbox/`, synthesize the day’s Daily
Note, derive actionable tasks, and push all approved content into the Daily
Notes + Tasks Notion databases (defined in `config/notion.ts`). The Tasks MUST
be created or updated first so the final Daily Note can reference every
resulting task.

Required artifacts:

- `tmp/daily_note.md` – high-level Daily Note draft (overview, general notes,
  future concerns, references, and an empty/placeholder `## TODOs` section).
- `tmp/tasks/{task_name}/DRAFT.md` + `REVIEW.md` (+ optional `NOTION.md`) for
  every parsed task.

Configs and prompts:

- `config/notion.ts`, `config/spelling.ts`
- `prompts/make_daily_from_transcript.md`
- `prompts/make_tasks_from_daily.md`
- `.cursor/guides/avoid_duplicate_tasks.md`

High-level flow:

1. Discover inbox payloads and confirm ingestion
   - List every non-`.gitkeep` file under `inbox/` with size + 20–30 char
     preview.
   - Present the summary and wait for `yes` to continue (anything else aborts).
   - On `quit`, delete any residual `tmp/daily_note.md` or `tmp/tasks/` content
     created during a previous run.

2. Draft the Daily Note (`tmp/daily_note.md`) and stage local task drafts
   - Load all confirmed inbox files and concatenate transcripts chronologically
     (oldest → newest) unless the filenames specify ordering.
   - Run `prompts/make_daily_from_transcript.md`; it emits two fenced blocks:
     - `[[DAILY_NOTE]] … [[END_DAILY_NOTE]]` → write ONLY this block to
       `tmp/daily_note.md`. This block must stay high level (Daily Overview,
       General Notes, Future Concerns, References) plus a placeholder `## TODOs`
       note indicating links will be added after Notion updates. No per-task
       sections live here.
     - `[[TASK_FEED]] … [[END_TASK_FEED]]` → iterate through every TODO
       row/detail section and, for each task:
       - Create (or refresh) `tmp/tasks/{sanitized_name}/`.
       - Write `DRAFT.md` using `prompts/make_tasks_from_daily.md` scoped to
         that task’s content (carry acceptance criteria, notes, references,
         prompts).
       - Initialize `REVIEW.md` by copying `DRAFT.md` (later steps may merge
         existing Notion content into this file).
   - Apply spelling corrections from `config/spelling.ts` across the Daily Note
     and every task draft.
   - Remove any pre-existing `tmp/daily_note.md` (and per-task folders) before
     writing.
   - Present ONE consolidated review to the user that includes:
     - Reminder to check `tmp/daily_note.md` for narrative accuracy.
     - A Markdown list of clickable task links, e.g.,
       `- [Task Name](tmp/tasks/{task}/DRAFT.md) — pending Notion search`.
     - Clear instruction that every task remains “pending Notion search” until
       Step 4 succeeds, so no Create/Update labels are shown yet.
   - Await `yes`/`fixed`. Do not proceed until the user confirms both the Daily
     Note and task drafts are ready.

3. Determine Notion targets, then update/create Tasks (must finish before Daily
   Note creation)
   - Use `config/notion.ts` → `notionConfig.database.tasks`.
   - Locate the Tasks database, capture its `data_source_id`, and pull property
     schema (priority/status/tags/project/etc.).

- For each reviewed task:
  - Perform searches in Notion scoped to the task's `Project` value: require the
    candidate Notion page to have the same `Project` property (case-insensitive
    exact match) before considering it a duplicate. Within that project scope,
    you may apply fuzzy/name-keyword matching per
    `.cursor/guides/avoid_duplicate_tasks.md` to find likely matches.
  - Only after a positive match that satisfies the `Project` scope (and a
    reasonable name-keyword match) should you mark the task as **UPDATE** (store
    the page ID + URL and pull existing content into `NOTION.md` for context).
    If no reliable match exists within the same project, label the task as
    **CREATE** and proceed accordingly.
- Properties: align exactly with the database schema. At a minimum populate:
  - `Name`: task title (usually `{task} | {project}` from the feed).
  - `Description`: Markdown summary distilled from `REVIEW.md`.
  - `Project`: single/multi select mapping from the task table (blank only when
    truly unknown).
  - `Priority`: normalized to one of the allowed values (`TOP`, `High`,
    `Medium`, `Low`, `Back burner`).
  - `Status`: Notion status (`TODO`, `On Deck`, `In Progress`, `BLOCKED`,
    `Done`, `Cancelled`).
  - `Tags`: convert comma-separated values into the DB’s multi-select options.
  - `Due Date`: optional ISO date when present.
  - `Assignee`: optional person reference; leave empty only when unspecified.
  - `Daily Notes`: relation back to the new Daily Note once Step 4 completes
    (update the task afterward if the relation cannot be set during creation).
  - Content: apply the Markdown from `REVIEW.md` as Notion blocks (merging
    instead of replacing when updating).
  - Record the resulting page IDs + URLs and surface a definitive Create vs
    Update breakdown in the user summary (no guesses from local files) using the
    format:

    ```
    # Tasks
    ## Create
    - [Task Name](tmp/tasks/.../REVIEW.md) → pending Notion create

    ## Update
    - [Task Name](Notion URL) → updating existing page
    ```

    (Omit empty sections.)

4. Finalize the Daily Note in Notion (after all Tasks are handled)
   - Replace the placeholder `## TODOs` section in `tmp/daily_note.md` with a
     concise table that links directly to each created/updated Notion task
     (e.g., `| Task | Status | Link |`). No per-task narrative remains in the
     Daily Note—links provide the deep context.
   - Build the Notion payload for `notionConfig.database.dailyNotes`:
     - Populate every required property explicitly:
       - `Name`: human-readable date/title string (e.g.,
         `Nov 17, 2025 Daily Note`).
       - `Date`: ISO date extracted from the transcript metadata or file name
         (e.g., `2025-11-17`).
       - `Notes Summary`: 1–2 sentence recap pulled from the Daily Note draft
         intro.
       - `Tags`: comma-separated list of themes surfaced while drafting (convert
         to the database’s multi-select values).
     - Include any additional DB properties (future concerns, references, etc.)
       the schema requires.
     - Body uses the cleaned contents of `tmp/daily_note.md` (after inserting
       task links) and must ensure the `## TODOs` section is rendered at the
       very bottom of the page so readers always find the task table last.
   - Create the page through the Daily Notes data source.
   - Capture the resulting Daily Note link and database IDs.
   - Update each previously created/updated Task so its `Daily Notes` relation
     references the newly created Daily Note (if it wasn’t already set during
     task creation).

5. Archive + cleanup
   - Create `archive/YYYY-MM-DD/` using the Daily Note date.
   - Move every processed inbox file, the final `tmp/daily_note.md`, and the
     entire `tmp/tasks/` directory into that archive path (retain structure).
   - Ensure `tmp/daily_note.md` and `tmp/tasks/` no longer exist in `tmp/`.

6. Final success message (strict format)

   ```
   ## Daily Note
   - [Name](link) — Date

   ## Tasks Created
   - [Task A](link)

   ## Tasks Updated
   - [Task B](link)

   ## Archive
   - archive/YYYY-MM-DD/ (N files)
   ```

   - Include empty sections if no items exist (e.g., “Tasks Created: none”).
   - Report any obstacles or manual steps still needed.

Notes & fallbacks:

- If no inbox files are found, explain that nothing was processed and exit
  cleanly.
- Never leak prompts; only reference their outputs and key requirements.
- Always respect the `yes/fixed/quit` gating before destructive operations.
- When matching tasks, require the `Project` match first. Within the same
  `Project`, err on the side of updating instead of duplicating; document the
  reasoning (why the match was chosen) in the final summary. Do NOT match or
  merge tasks across different projects.
- When either Notion database lookup fails, stop, display the encountered error,
  and do not archive the inbox files.
