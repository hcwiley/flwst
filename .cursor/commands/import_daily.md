---
name: import_daily
description: Import inbox transcript(s) into the Daily Notes database using Notion MCP
---

Usage: `/import_daily`

Inputs:
- `yes`: confirm and proceed
- `no`: do NOT confirm, Cursor will prompt for how to handle
- `quit`: do NOT confirm, exit the command and reset the context to start fresh.

Goal: Process files in `inbox/`, generate a Daily entry from the transcript using `prompts/make_daily_from_transcript.md`, confirm with the user, then create a new Page in the Notion database specified by `notionConfig.database.dailyNotes`. Finally, archive the processed inbox files under `archive/YYYY-MM-DD/`.

Agent steps:
1) Discover inbox files
   - Read `inbox/` and list all importable files (ignore `.gitkeep`).
   - For each, collect: file path, size, and a short preview (first ~20-30 chars).
   - Present a summary list to the user and ask for confirmation to proceed (reply `yes` to continue or `no` to cancel).

2) If user confirms import (`yes`)
   - For transcript content (e.g., `inbox/transcript.txt`), load full text.
   - Apply the prompt in `prompts/make_daily_from_transcript.md` to produce a structured Daily draft.
     - DO NOT SHOW THE PROMPT TO THE USER, ONLY THE RESULT.
     - Make sure check every <section> of the prompt and FOLLOW EXACTLY
     - Review the results carefully
     - Pay attention to any `config/spelling.ts` fixes and apply them. If the file does not exist, warn the user and suggest they create it.
   - From the result, prepare the Notion fields
   - Prepare the rich content/body for the Page (the formatted draft output).
     - Drop this into `tmp/daily_draft.md` and tell the user to review it there.
   - Show a preview (Name, Date, Summary, Tags) and preview of the `tmp/daily_draft.md`; ask to confirm 
     - if the `tmp/daily_draft.md` already exists, remove it and create a new one.
   - creation in Notion (reply `yes` to proceed or `no` to cancel).

3) If user confirms Notion creation (`yes`)
   - Read `config/notion.ts` and get `notionConfig.database.dailyNotes` for the database title.
   - Using Notion MCP tools:
     - Search for the database by title to obtain its database/page ID.
     - Fetch the database details to extract the first `collection://...` Data Source URL (this is the `data_source_id`).
     - Create a new page under that Data Source with:
       - Properties (using exact database property names when available):
         - Title: set to Name (use the database’s title property, e.g., `Name`).
         - Date: set via date fields (e.g., `date:Date:start`, with `date:Date:is_datetime` appropriately set).
         - Notes Summary: set to the summary string if the property exists.
         - Tags: set to the list if the property exists (select/multi-select per DB schema).
       - Content: insert the generated Daily body as Notion-flavored Markdown.
   - On success, return the created page’s URL and ID to the user.

4) Archive processed files
   - Create `archive/YYYY-MM-DD/` (based on the Date used above) if it doesn’t exist.
   - Move all imported files from `inbox/` into that archive directory, preserving filenames.
   - Move the `tmp/daily_draft.md` into the archive directory.
   - Show a final summary of archived files.

5) Provide a summary of the newly created page in the `Daily Notes` database in rich markdown format:
   ## [<_name_>](<_link_>)
   ### Date: <_date_>
   ### Summary:
   <_summary_>
   ### Tags:
   <_tags_>

Notes and fallbacks:
- If multiple databases match the title, prefer the one under the `workspaceName` parent page.
- If the database lacks a `Date`, `Notes Summary`, or `Tags` property, proceed with the fields available and still include the full content in the Page body.
- If no files are found in `inbox/`, inform the user and exit.

