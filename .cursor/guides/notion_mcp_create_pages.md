# Notion MCP create-pages Tool Usage Guide

## Overview

This guide documents the correct usage of the `mcp_Notion_notion-create-pages` tool to avoid common errors encountered during development.

## Common Issues and Solutions

### Issue 1: Parent Parameter Format

**Error:** `Parameter 'parent' must be one of types [object, object, object], got string`

**Solution:** Use the correct parent format without the `type` field:

```python
# ✅ CORRECT - Use data_source_id directly
parent = {'data_source_id': 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'}

# ❌ WRONG - Don't include 'type' field
parent = {'type': 'data_source_id', 'data_source_id': '...'}  # This causes errors
```

**Note:** The data_source_id can be extracted from the `collection://...` URL returned by the `notion-fetch` tool when fetching a database. Replace the example UUID with your actual data source ID.

### Issue 2: Tags Property Format

**Error:** `Expected string, received array` (or similar type errors for Tags)

**Solution:** Tags must be provided as a JSON string, not a Python array:

```python
# ✅ CORRECT - Tags as JSON string
properties = {
    'Tags': '["tag1", "tag2"]'  # JSON string format
}

# ❌ WRONG - Tags as Python array
properties = {
    'Tags': ['tag1', 'tag2']  # This causes validation errors
}
```

### Issue 3: Date Property Format

**Solution:** Use the expanded date property format:

```python
properties = {
    'date:Date:start': '2025-01-15',           # ISO date string
    'date:Date:is_datetime': 0,                 # 0 for date-only, 1 for datetime
    # Optional: 'date:Date:end': '2025-01-16'  # For date ranges
}
```

## Complete Example

```python
from mcp_Notion_notion_create_pages import mcp_Notion_notion_create_pages

# Step 1: Get data_source_id from database fetch
# Use notion-fetch to get database details, then extract:
# collection://aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
# The ID is: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee

# Step 2: Prepare parent parameter
parent = {'data_source_id': 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'}

# Step 3: Prepare page properties
properties = {
    'Name': 'Example Page Title',  # Title property
    'date:Date:start': '2025-01-01',
    'date:Date:is_datetime': 0,
    'Notes Summary': 'Your summary text here',
    'Tags': '["tag1", "tag2"]'  # JSON string, not array!
}

# Step 4: Prepare content (Notion-flavored Markdown)
content = '''## TODOs

### table

| name | project | description | priority | status | tags | Due Date |
|------|---------|-------------|----------|--------|------|----------|
| Task Name | Project | Description | TOP | TODO | tag1, tag2 | 2025-01-15 |

### Task Name

Task details here...
'''

# Step 5: Create the page
pages = [{
    'properties': properties,
    'content': content
}]

# Step 6: Call the tool
result = mcp_Notion_notion_create_pages(
    parent=parent,
    pages=pages
)
```

## Key Takeaways

1. **Parent Format:** Use `{'data_source_id': '...'}` without the `type` field
2. **Tags Format:** Must be a JSON string: `'["tag1", "tag2"]'`, not a Python array
3. **Date Format:** Use expanded format: `date:Date:start`, `date:Date:is_datetime`
4. **Content:** Use Notion-flavored Markdown (see Notion MCP documentation for full spec)

## Database Property Names

Always use the exact property names from the database schema. Common property names:

- `Name` - Title property (required)
- `Date` - Date property (use expanded format)
- `Notes Summary` - Text property
- `Tags` - Multi-select property (JSON string format)
- `TODO: Tasks` - Relation property (if applicable)

## Debugging Tips

1. **If parent parameter fails:** Try using `database_id` instead of `data_source_id`:

   ```python
   parent = {'database_id': 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff'}
   ```

2. **If Tags fails:** Ensure it's a valid JSON string. Use `json.dumps()` if needed:

   ```python
   import json
   tags_json = json.dumps(['tag1', 'tag2'])
   properties['Tags'] = tags_json
   ```

3. **Check database schema:** Always fetch the database first to see exact property names and types:
   ```python
   db_info = mcp_Notion_notion_fetch(id='database-id')
   # Check the schema in the response
   ```

## Related Tools

- `mcp_Notion_notion-fetch` - Fetch database/page details to get schema and IDs
- `mcp_Notion_notion-search` - Search for databases/pages by title
- `mcp_Notion_notion-update-page` - Update existing pages

## References

- Notion MCP Documentation: See tool descriptions for full API details
- Database schemas are returned in SQLite format by `notion-fetch`
- Property types: title, text, date, multi_select, relation, etc.
