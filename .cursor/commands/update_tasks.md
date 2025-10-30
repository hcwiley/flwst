---
name: update_tasks
description: Create or update Tasks in the Tasks database from a Daily Notes entry's TODOs table using Notion MCP
---

Usage: `/update_tasks {target_date?}`

Inputs:
- `yes`: confirm and proceed
- `no`: do NOT confirm, Cursor will prompt for how to handle
- `quit`: do NOT confirm, exit the command and reset the context to start fresh.
- `{target_date}`: Optional. If omitted, use the most recent Daily Notes entry (by Date).

Goal: Parse the `## TODOs` → `### table` in a Daily Notes page and either create or update tasks in the Notion database specified by `notionConfig.databaseNames.tasks`. Use the detailed Task sections below the table (each `### Task Name`) to build/merge task bodies.

Configs:
- `./config/notion.ts`
- `./config/spelling.ts`

Agent steps:
1) Resolve target Daily Notes page
   - If `{target_date}` provided, search `Daily Notes` database for that Date.
   - If not provided, search `Daily Notes` for the most recent entry (by Date) and use it.
   - Fetch the page’s content.

2) Parse TODOs table and task sections
   - Locate the `## TODOs` section and the `### table` immediately under it.
   - Parse rows with the schema: `| name | description | priority | status | tags |`.
   - For each row, also find a matching `### {name}` section and capture all subsequent content until the next `###` or section boundary.
   - Apply spelling fixes from `config/spelling.ts` where relevant.

3) Prepare local workspace for review
   - For each task `name`:
     - Create `tmp/tasks/{task_name}/`.
     - If it exists, remove it first, then recreate it.
     - Reference `prompts/make_tasks_from_daily.md` for the content and structure of the task.
     - Pay attention to <content> when making the DRAFT.md file.
     - Write the captured section content to `tmp/tasks/{task_name}/DRAFT.md`.
   - Present a summary list of parsed tasks and hyperlinked paths to the draft files: [{task_name}](tmp/tasks/{task_name}/DRAFT.md). I want to be able to click on the link and open the file in a Markdown preview window.

4) Discover Tasks database
   - Read `config/notion.ts` and get `notionConfig.databaseNames.tasks`.
   - Using Notion MCP tools:
     - Search for the Tasks database by title; prefer the one under the `flwst` parent page if multiple.
     - Fetch the database details. Identify its first `collection://...` Data Source URL; this is the `data_source_id`.
     - Capture task property schema (e.g., `Name` title, `Priority`, `Status`, `Tags`, etc.) to use exact property names.
   - Review `prompts/make_tasks_from_daily.md` for the database properties and review the task schema.

5) Determine existence and fetch existing content (per task)
   - Search the Tasks database for an existing page with the same `Name`.
   - If found, fetch its content and save a copy to `tmp/tasks/{task_name}/NOTION.md` to aid manual review/merge.

6) Merge content and prepare REVIEW.md (per task)
   - Merge strategy: favor adding content over removing. Preserve existing Notion content; append or integrate new details from `DRAFT.md`.
   - If conflicts are extensive, pause for user input for that task (show paths and prompt for decision).
   - Write the result to `tmp/tasks/{task_name}/REVIEW.md`.
   - Open or link the REVIEW file for preview. Ask the user to confirm applying changes for this task (`yes` to apply, `no` to skip and allow edits, `quit` to abort all).
   - BE VERY DIRECT ABOUT WHERE THERE ARE CONFLICTS TO RESOLVE. List out the files that have conflicts and ask the user to resolve them.

7) Apply updates/creates in Notion (per task, on confirm `yes`)
   - Build properties from the table row using the database’s exact property names:
     - Title: `Name`
     - Priority: set to one of the DB’s valid options; if missing, default to `Medium`.
     - Status: set to one of the DB’s valid options; if missing, default to `TODO`.
     - Tags: map to select/multi-select per DB schema; if values are not present in the schema, omit or map to closest valid values.
   - Content: replace or append using the `REVIEW.md` Markdown as Notion-flavored content.
   - For existing tasks: update properties and content. For new tasks: create a page under the Tasks `data_source_id`.

8) Archive processed tasks
   - After all tasks are processed (applied or skipped), archive the entire `tmp/tasks/` folder to `archive/YYYY-MM-DD/tasks/` (using the Daily Notes Date).
   - Show a final summary of archived files and Notion updates (created/updated task count with links).

Notes and fallbacks:
- If the Tasks database lacks some properties (Priority/Status/Tags), proceed with available ones; still include full content in the Page body.
- If tag values are not allowed by the DB schema, omit them or map to the closest valid option; do not attempt to create new options automatically.
- If no matching `### {name}` section exists, proceed with table data only and note this in `DRAFT.md`.
- If no Daily Notes page is found for the chosen date, inform the user and exit.


