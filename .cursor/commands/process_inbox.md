---
name: process_inbox
description: Consolidate inbox ingestion, Daily Note drafting, and Tasks updates via Notion MCP
---

Usage: `/process_inbox`

Inputs:

- `yes`: confirm the current checkpoint and proceed to the next phase.
- `fixed`: the user has applied the requested edits (e.g., to `tmp/daily_note.md` or `tmp/tasks/*`) and wants the agent to re-validate before continuing.
- `quit`: stop immediately, clean up any partial work in `tmp/`, and reset the context.

Goal: Take every transcript or note in `inbox/`, synthesize the day’s Daily Note, derive actionable tasks, and push all approved content into the Daily Notes + Tasks Notion databases (defined in `config/notion.ts`). The Tasks MUST be created or updated first so the final Daily Note can reference every resulting task.

Required artifacts:

- `tmp/daily_note.md` – high-level Daily Note draft (overview, general notes, future concerns, references, and an empty/placeholder `## TODOs` section).
- `tmp/tasks/{task_name}/DRAFT.md` + `REVIEW.md` (+ optional `NOTION.md`) for every parsed task.

Configs and prompts:

- `config/notion.ts`, `config/spelling.ts`
- `prompts/make_daily_from_transcript.md`
- `prompts/make_tasks_from_daily.md`
- `.cursor/guides/avoid_duplicate_tasks.md`

High-level flow:

1. Discover inbox payloads and confirm ingestion
   - List every non-`.gitkeep` file under `inbox/` with size + 20–30 char preview.
   - Present the summary and wait for `yes` to continue (anything else aborts).
   - On `quit`, delete any residual `tmp/daily_note.md` or `tmp/tasks/` content created during a previous run.

2. Draft the Daily Note (`tmp/daily_note.md`) and stage local task drafts
   - Load all confirmed inbox files and concatenate transcripts chronologically (oldest → newest) unless the filenames specify ordering.
   - Run `prompts/make_daily_from_transcript.md`; it emits two fenced blocks:
     - `[[DAILY_NOTE]] … [[END_DAILY_NOTE]]` → write ONLY this block to `tmp/daily_note.md`. This block must stay high level (Daily Overview, General Notes, Future Concerns, References) plus a placeholder `## TODOs` note indicating links will be added after Notion updates. No per-task sections live here.
     - `[[TASK_FEED]] … [[END_TASK_FEED]]` → iterate through every TODO row/detail section and, for each task:
       - Create (or refresh) `tmp/tasks/{sanitized_name}/`.
       - Write `DRAFT.md` using `prompts/make_tasks_from_daily.md` scoped to that task’s content (carry acceptance criteria, notes, references, prompts).
       - Initialize `REVIEW.md` by copying `DRAFT.md` (later steps may merge existing Notion content into this file).
   - Apply spelling corrections from `config/spelling.ts` across the Daily Note and every task draft.
   - Remove any pre-existing `tmp/daily_note.md` (and per-task folders) before writing.
   - Present ONE consolidated review to the user that includes:
     - Reminder to check `tmp/daily_note.md` for narrative accuracy.
     - A Markdown list of clickable task links, e.g., `- [Task Name](tmp/tasks/{task}/DRAFT.md) — pending Notion search`.
     - Clear instruction that every task remains “pending Notion search” until Step 4 succeeds, so no Create/Update labels are shown yet.
   - Await `yes`/`fixed`. Do not proceed until the user confirms both the Daily Note and task drafts are ready.

3. Determine Notion targets, then update/create Tasks (must finish before Daily Note creation)
   - Use `config/notion.ts` → `notionConfig.database.tasks`.
   - Locate the Tasks database, capture its `data_source_id`, and pull property schema (priority/status/tags/project/etc.).
   - For each reviewed task:
     - Perform fuzzy searches in Notion using the exact project + name keywords (per `.cursor/guides/avoid_duplicate_tasks.md`).
     - Only after a positive Notion match should you mark the task as **UPDATE** (store the page ID + URL and pull existing content into `NOTION.md` for context). If no reliable match exists, label the task as **CREATE** and proceed accordingly.
     - Properties: align exactly with the database schema (e.g., `Name`, `Priority`, `Status`, `Tags`, `Project`, `Due`, etc.).
     - Content: apply the Markdown from `REVIEW.md` as Notion blocks (merging instead of replacing when updating).
     - Record the resulting page IDs + URLs and surface a definitive Create vs Update breakdown in the user summary (no guesses from local files) using the format:

       ```
       # Tasks
       ## Create
       - [Task Name](tmp/tasks/.../REVIEW.md) → pending Notion create

       ## Update
       - [Task Name](Notion URL) → updating existing page
       ```

       (Omit empty sections.)

4. Finalize the Daily Note in Notion (after all Tasks are handled)
   - Replace the placeholder `## TODOs` section in `tmp/daily_note.md` with a concise table that links directly to each created/updated Notion task (e.g., `| Task | Status | Link |`). No per-task narrative remains in the Daily Note—links provide the deep context.
   - Build the Notion payload for `notionConfig.database.dailyNotes`:
     - Title/Date plus summary, tags, future concerns, references, and any additional properties required by the DB.
     - Body uses the cleaned contents of `tmp/daily_note.md` (after inserting task links).
   - Create the page through the Daily Notes data source.
   - Capture the resulting Daily Note link and database IDs.

5. Archive + cleanup
   - Create `archive/YYYY-MM-DD/` using the Daily Note date.
   - Move every processed inbox file, the final `tmp/daily_note.md`, and the entire `tmp/tasks/` directory into that archive path (retain structure).
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

- If no inbox files are found, explain that nothing was processed and exit cleanly.
- Never leak prompts; only reference their outputs and key requirements.
- Always respect the `yes/fixed/quit` gating before destructive operations.
- When fuzzy matching tasks, err on the side of updating instead of duplicating; document reasoning in the final summary.
- When either Notion database lookup fails, stop, display the encountered error, and do not archive the inbox files.
