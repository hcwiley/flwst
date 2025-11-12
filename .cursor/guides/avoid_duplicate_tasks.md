# Avoiding Duplicate Tasks in Notion - Critical Guide

## Overview
This guide documents how to prevent creating duplicate tasks when processing daily notes. **Creating duplicates is a BIG NO NO** and must be avoided at all costs.

## The Problem

When processing daily notes, tasks may be described differently but refer to the same work:
- Daily note: "Finish Project Alpha architecture overview"
- Existing task: "Architectural overview doc | Project Alpha"
- These are the SAME task, just described differently!

## Critical Rules

### Rule 1: ALWAYS Search Before Creating

**NEVER create a task without first searching for existing tasks.**

Before creating ANY task:
1. Search the Tasks database for similar task names
2. Use fuzzy matching - don't rely on exact name matches
3. Check for tasks with the same project/tags
4. Review search results carefully

### Rule 2: Filter by Project FIRST

**ALWAYS filter by project before searching - this dramatically reduces false positives.**

If the task has a Project property, search within that project first:

```python
# Example: Task name from daily notes is "Finish Project Alpha architecture overview"
project = "Project Alpha"

# Strategy 1: Filter by Project FIRST (MOST IMPORTANT)
# Search within the Tasks database filtered by project
# This narrows results significantly and reduces duplicates

# Strategy 2: Then search for key terms within that project
search_queries = [
    f"{project} architecture",      # "Project Alpha architecture"
    f"{project} overview",           # "Project Alpha overview"
    "architecture overview",        # Common phrase (may match across projects)
    "architectural overview",       # Variant spelling
]

# Strategy 3: Check recent tasks in that project
# Look at tasks created/updated in the last 30 days with same project
```

**Why project filtering matters:**
- Reduces search results from hundreds to dozens
- Same project = higher likelihood of being the same work
- Prevents false matches from other projects
- Faster and more accurate matching

### Rule 3: When in Doubt, Update Don't Create

**If you find ANY task that could be the same work:**
- ✅ **UPDATE the existing task** (merge new content)
- ❌ **DO NOT create a new task**

Only create a new task if you're **100% certain** no similar task exists.

## Step-by-Step Process

### Step 1: Extract Task Name from Daily Notes

```python
task_name = "Finish Project Alpha architecture overview"
project = "Project Alpha"
```

### Step 2: Build Search Queries

Extract key terms from the task name:

```python
# Split task name into meaningful words
words = ["Finish", "Project", "Alpha", "architecture", "overview"]
keywords = ["Project", "Alpha", "architecture", "overview"]  # Remove filler words like "Finish"

# Build search queries
queries = [
    f"{project} architecture",            # "Project Alpha architecture"
    "architecture overview",              # Common phrase
    "architecture",                       # Single keyword
]
```

### Step 3: Search Tasks Database (Filter by Project FIRST)

```python
# CRITICAL: Filter by project first to narrow results
if project:
    # Step 3a: Search within project-specific context
    # Include project name in search queries to filter results
    project_queries = [
        f"{project} {keyword}" for keyword in keywords
    ] + [project]  # Also search for project name alone
    
    # Search with project filter
    for query in project_queries:
        results = mcp_Notion_notion_search(
            query=query,
            query_type="internal"
        )
        
        # Filter results to Tasks database only
        task_results = [
            r for r in results 
            if r['type'] == 'page' 
            and 'TODO: Tasks' in r.get('highlight', '')
        ]
        
        # Further filter by checking if result has matching project
        # (You may need to fetch each result to check its Project property)
        for result in task_results:
            # Fetch full task details to check Project property
            task_details = mcp_Notion_notion_fetch(id=result['id'])
            if task_details.get('properties', {}).get('Project') == project:
                if is_similar_task(result['title'], task_name, project):
                    # FOUND EXISTING TASK IN SAME PROJECT - UPDATE IT!
                    return update_existing_task(result['id'], new_content)

# Step 3b: If no match found in project, search more broadly
# (But still prioritize project matches)
for query in queries:
    results = mcp_Notion_notion_search(
        query=query,
        query_type="internal"
    )
    
    task_results = [
        r for r in results 
        if r['type'] == 'page' 
        and 'TODO: Tasks' in r.get('highlight', '')
    ]
    
    for result in task_results:
        if is_similar_task(result['title'], task_name, project):
            # FOUND EXISTING TASK - UPDATE IT, DON'T CREATE!
            return update_existing_task(result['id'], new_content)
```

**Alternative: Direct Database Query by Project**

If the Tasks database supports filtering, query it directly:

```python
# Fetch Tasks database
tasks_db = mcp_Notion_notion_fetch(id='tasks-database-id')

# Search within database filtered by Project property
# This is more efficient than broad search + filter
# Note: May require using database views or filtering capabilities
```

### Step 4: Similarity Check Function

```python
def is_similar_task(existing_title, new_title, project):
    """
    Check if two task names refer to the same work.
    
    Rules:
    1. Same project = higher likelihood
    2. Key words match (architecture, overview, etc.)
    3. Ignore action words (Finish, Complete, Create, etc.)
    4. Check for partial matches
    """
    # Normalize: lowercase, remove punctuation
    existing_norm = existing_title.lower().replace('|', '').strip()
    new_norm = new_title.lower()
    
    # Extract key nouns/adjectives (ignore verbs)
    action_words = ['finish', 'complete', 'create', 'build', 'implement', 'add']
    existing_keywords = [w for w in existing_norm.split() if w not in action_words]
    new_keywords = [w for w in new_norm.split() if w not in action_words]
    
    # Check for overlap
    overlap = set(existing_keywords) & set(new_keywords)
    
    # If 2+ keywords match, likely the same task
    if len(overlap) >= 2:
        return True
    
    # Check for substring matches
    if any(kw in existing_norm for kw in new_keywords if len(kw) > 4):
        return True
    
    return False
```

### Step 5: Update vs Create Decision

```python
if existing_task_found:
    # UPDATE EXISTING TASK
    update_task_properties(
        page_id=existing_task_id,
        properties={
            'Status': new_status,  # Update if changed
            'Priority': new_priority,  # Update if changed
            'date:Due Date:start': new_due_date,  # Update if changed
            'Description': merge_descriptions(old_desc, new_desc),
        }
    )
    
    # Merge content (append new, preserve old)
    update_task_content(
        page_id=existing_task_id,
        new_content=merge_content(old_content, new_content)
    )
    
    # Add Daily Notes relation (don't remove existing)
    add_daily_notes_relation(
        page_id=existing_task_id,
        daily_notes_url=new_daily_notes_url
    )
else:
    # ONLY CREATE IF NO MATCH FOUND
    create_new_task(...)
```

## Common Patterns to Watch For

### Pattern 1: Action Word Variations
- Daily: "Finish architecture overview"
- Existing: "Architectural overview doc"
- **Match:** Same core work, different action word

### Pattern 2: Abbreviation vs Full Name
- Daily: "Finish Project Alpha architecture overview"
- Existing: "Architectural overview doc | Project Alpha"
- **Match:** "Project Alpha" = "Project Alpha", same work

### Pattern 3: Different Phrasing, Same Work
- Daily: "Implement LLM server"
- Existing: "Set up node-llama-cpp server"
- **Match:** Same technical work, different description

### Pattern 4: Project Name Variations
- Daily: Project: "Project Beta"
- Existing: Project: "Project Beta" (or tag: "project-beta")
- **Match:** Same project, check task name similarity

## Implementation Checklist

Before creating ANY task:

- [ ] **Filter by Project FIRST** - Search tasks with same Project property
- [ ] **Within same project**, search Tasks database with task name keywords
- [ ] **Within same project**, search Tasks database with key technical terms
- [ ] If no project match, search more broadly (but prioritize project matches)
- [ ] Review ALL search results (not just first match)
- [ ] **Prioritize results with same Project** - higher likelihood of duplicate
- [ ] Check if any result could be the same work
- [ ] If unsure, ASK USER or UPDATE existing task
- [ ] Only create if 100% certain no duplicate exists

## Error Recovery

If you accidentally create a duplicate:

1. **STOP immediately** - don't create more duplicates
2. **Identify the original task** (oldest creation date)
3. **Update the original** with new content
4. **Delete the duplicate** (or mark for user to delete)
5. **Document the mistake** for learning

## Example: Correct Flow

```python
# Task from daily notes
new_task = {
    'name': 'Finish Project Alpha architecture overview',
    'project': 'Project Alpha',
    'priority': 'TOP',
    'due_date': '2025-01-15'
}

# Step 1: Filter by Project FIRST (CRITICAL!)
# Search for tasks with same project
project_search_results = mcp_Notion_notion_search(
    query='Project Alpha',  # Project name
    query_type='internal'
)

# Filter to Tasks database and same project
project_tasks = []
for result in project_search_results:
    if result['type'] == 'page':
        task_details = mcp_Notion_notion_fetch(id=result['id'])
        if task_details.get('properties', {}).get('Project') == 'Project Alpha':
            project_tasks.append(result)

# Step 2: Check each task in same project
for result in project_tasks:
    if is_similar_task(result['title'], new_task['name'], new_task['project']):
        # FOUND MATCH IN SAME PROJECT - UPDATE IT
        update_task(result['id'], new_task)
        return  # DON'T CREATE NEW TASK

# Step 3: If no match in project, search more broadly
# (But still check project property when found)
broader_results = search_tasks([
    'Sherpa architecture',
    'architecture overview',
])

for result in broader_results:
    task_details = mcp_Notion_notion_fetch(id=result['id'])
    result_project = task_details.get('properties', {}).get('Project')
    
    # Prioritize same project matches
    if result_project == new_task['project']:
        if is_similar_task(result['title'], new_task['name'], new_task['project']):
            update_task(result['id'], new_task)
            return

# Step 4: Only create if no match found
if not found_match:
    create_task(new_task)
```

## Database Schema Considerations

When searching, consider:
- **Project** property: **FILTER BY THIS FIRST** - Most effective way to narrow results
- **Name** property: Primary search target (after project filtering)
- **Tags** property: Search tasks with matching tags (secondary filter)
- **Description** property: May contain keywords (check after project match)
- **Daily Notes** relation: Check if task already linked to recent daily notes

### Project Filtering Strategy

```python
# Priority order for searching:
# 1. Same Project + Similar Name = HIGHEST PRIORITY (likely duplicate)
# 2. Same Project + Different Name = MEDIUM PRIORITY (check carefully)
# 3. Different Project + Similar Name = LOW PRIORITY (probably different work)
# 4. Different Project + Different Name = IGNORE (definitely different)

def prioritize_matches(results, target_project):
    """Sort search results by project match priority"""
    prioritized = []
    for result in results:
        result_project = get_project_from_result(result)
        if result_project == target_project:
            prioritized.insert(0, result)  # Same project = highest priority
        else:
            prioritized.append(result)  # Different project = lower priority
    return prioritized
```

## Tools Available

- `mcp_Notion_notion-search`: Search for pages/tasks
- `mcp_Notion_notion-fetch`: Get full task details
- `mcp_Notion_notion-update-page`: Update existing task
- `mcp_Notion_notion-create-pages`: Create new task (use sparingly!)

## Key Takeaways

1. **Filter by Project FIRST** - Most effective way to reduce duplicates
2. **Search first, create second** - Always search before creating
3. **Fuzzy matching is critical** - Don't rely on exact name matches
4. **When in doubt, update** - Better to update existing than create duplicate
5. **Project + keywords** - Use both to find matches (project is primary filter)
6. **Review carefully** - Don't skip reviewing search results
7. **Prioritize same-project matches** - Higher likelihood of being duplicate

## Related Guides

- `.cursor/guides/notion_mcp_create_pages.md` - How to create pages correctly
- `.cursor/commands/update_tasks.md` - Full update_tasks command workflow

