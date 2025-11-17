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
- `tmp/tasks_feed.md` – raw TODO table + per-task detail sections generated from the same prompt (never shipped to Notion; used only for task drafting).
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

2. Draft the Daily Note (`tmp/daily_note.md`)
   - Load all confirmed inbox files and concatenate transcripts chronologically (oldest → newest) unless the filenames specify ordering.
   - Run `prompts/make_daily_from_transcript.md`; it emits two fenced blocks:
     - `[[DAILY_NOTE]] … [[END_DAILY_NOTE]]` → write ONLY this block to `tmp/daily_note.md`. This block must stay high level (Daily Overview, General Notes, Future Concerns, References) plus a placeholder `## TODOs` note indicating links will be added after Notion updates. No per-task sections live here.
     - `[[TASK_FEED]] … [[END_TASK_FEED]]` → write this block verbatim to `tmp/tasks_feed.md`. It contains the TODO table + `### {task}` detail sections required for downstream task drafting.
   - Apply spelling corrections from `config/spelling.ts` across both artifacts.
   - Remove any pre-existing `tmp/daily_note.md` / `tmp/tasks_feed.md` before writing.
   - Ask the user to review the high-level `tmp/daily_note.md` for narrative accuracy (not task detail) and reply `yes` to accept or `fixed` after making manual edits. Do not proceed until the user confirms the draft is ready.

3. Extract candidate tasks from the draft
   - Parse the `## TODOs` table + detail sections inside `tmp/tasks_feed.md` (NOT `tmp/daily_note.md`).
   - Feed that content into `prompts/make_tasks_from_daily.md` to structure each task (respect spelling fixes).
   - For every task:
     - Create `tmp/tasks/{sanitized_name}/`.
     - Write `DRAFT.md` (prompt output) and, when applicable, `NOTION.md` containing the latest Notion content for comparison.
     - Summarize whether the task appears to be new vs. existing (use fuzzy searches per `.cursor/guides/avoid_duplicate_tasks.md`).
   - Provide the clickable list `[Task](tmp/tasks/{task}/DRAFT.md)` with status (new/existing) and await `yes`/`fixed`.

4. Task review + `REVIEW.md`
   - Merge `DRAFT.md` with any `NOTION.md` context.
   - Write the final proposal to `REVIEW.md`; include explicit notes for conflicts or missing info.
   - Once the user responds `yes`, proceed with Notion updates for the approved subset. If they respond `fixed`, wait until they finish editing and rerun validation.

5. Update or create Tasks in Notion (must finish before Daily Note creation)
   - Use `config/notion.ts` → `notionConfig.database.tasks`.
   - Locate the Tasks database, capture its `data_source_id`, and pull property schema (priority/status/tags/project/etc.).
   - For each reviewed task:
     - Prefer updating an existing page when any fuzzy match exists; otherwise create a new page under the Tasks data source.
     - Properties: align exactly with the database schema (e.g., `Name`, `Priority`, `Status`, `Tags`, `Project`, `Due`, etc.).
     - Content: apply the Markdown from `REVIEW.md` as Notion blocks.
   - Record the resulting page IDs + URLs for later linking.

6. Finalize the Daily Note in Notion (after all Tasks are handled)
   - Replace the placeholder `## TODOs` section in `tmp/daily_note.md` with a concise table that links directly to each created/updated Notion task (e.g., `| Task | Status | Link |`). No per-task narrative remains in the Daily Note—links provide the deep context.
   - Build the Notion payload for `notionConfig.database.dailyNotes`:
     - Title/Date plus summary, tags, future concerns, references, and any additional properties required by the DB.
     - Body uses the cleaned contents of `tmp/daily_note.md` (after inserting task links).
   - Create the page through the Daily Notes data source.
   - Capture the resulting Daily Note link and database IDs.

7. Archive + cleanup
   - Create `archive/YYYY-MM-DD/` using the Daily Note date.
   - Move every processed inbox file, the final `tmp/daily_note.md`, `tmp/tasks_feed.md`, and the entire `tmp/tasks/` directory into that archive path (retain structure).
   - Ensure `tmp/daily_note.md`, `tmp/tasks_feed.md`, and `tmp/tasks/` no longer exist in `tmp/`.

8. Final success message (strict format)

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
