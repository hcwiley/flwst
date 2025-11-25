---
name: list_daily
description: List entries in the "Daily Notes" Notion database via MCP using config/notion.ts
---

Usage: `/list_daily [limit]`

- Default limit is 7 if omitted.
- Returns newest-to-oldest.
- Each item shows: Name, Date, Summary, Link to Notion.

Agent steps:

1. Read `config/notion.ts`, parse `notionConfig.database.dailyNotes` to get the database title.
2. Using the Notion MCP:
   - Search for the database by title and get its database/page ID.
   - Fetch the database details; extract the first `collection://...` data source URL.
   - Search that data source to enumerate entries (broad query).
3. For each entry, gather the properties:
   - Name: title (e.g., `Name` property).
   - Date: use a `Date` property if present; otherwise fall back to created time.
   - Summary: use a `Summary`-like property if present; otherwise empty string.
   - Link: page URL (e.g., `Link` property).
   - Tags: use a `Tags`-like property if present; otherwise empty string.
4. Sort entries by Date desc (fallback: created time desc). Apply `limit` (default 7).
5. Output a concise summary in rich markdown with
   ## [<_name_>](_link_)
   ### Date: <_date_>
   ### Summary:
   <_summary_>
   ### Tags:
   <_tags_>

Notes:

- If multiple databases match the title, prefer the one under the `workspaceName` parent page if present.
- If property names differ, use the first date-like and summary-like properties.
