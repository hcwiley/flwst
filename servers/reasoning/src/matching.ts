import { Todo } from '@flwst/types/api/reasoning';
import { notionClient } from './mcp-client.js';

/**
 * Normalize a string for comparison:
 * 1. Lowercase
 * 2. Remove all punctuation and special characters (replace with space)
 * 3. Trim and collapse multiple spaces
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with space
    .trim()
    .replace(/\s+/g, ' '); // Collapse spaces
}

/**
 * Check if two task names are similar using fuzzy matching.
 * Returns true if the names share significant keywords.
 */
function isSimilarTaskName(name1: string, name2: string): boolean {
  const normalized1 = normalizeString(name1);
  const normalized2 = normalizeString(name2);

  // Exact match after normalization
  if (normalized1 === normalized2) {
    return true;
  }

  // Check if one contains the other (for partial matches)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }

  // Extract key words (3+ characters) and check for overlap
  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that']);
  const words1 = normalized1.split(' ').filter((w) => w.length >= 3 && !stopWords.has(w));
  const words2 = normalized2.split(' ').filter((w) => w.length >= 3 && !stopWords.has(w));

  if (words1.length === 0 || words2.length === 0) {
    return false;
  }

  // Check if significant words overlap
  const commonWords = words1.filter((w) => words2.includes(w));
  const minWords = Math.min(words1.length, words2.length);

  // If at least 40% of words match, consider it similar (relaxed from 50%)
  return commonWords.length >= Math.ceil(minWords * 0.4);
}

/**
 * Extract properties from a Notion task page.
 * Handles different response formats from Notion MCP.
 */
export type NotionTaskProperties = {
  name?: string;
  project?: string;
  priority?: string;
  status?: string;
  description?: string;
  dueDate?: string;
  tags?: string[];
  assignee?: string;
  id?: string;
  url?: string;
};

/**
 * Extract properties from a Notion task page.
 * Handles different response formats from Notion MCP.
 *
 * Exported so routes can build lightweight “Notion context” for the LLM.
 */
export function extractNotionTaskProperties(notionPage: any): NotionTaskProperties {
  const props: any = {};

  // Handle different response formats
  if (notionPage.properties) {
    const properties = notionPage.properties;

    // Extract Name (title property)
    if (properties.Name) {
      if (Array.isArray(properties.Name)) {
        props.name = properties.Name.map((p: any) => p.plain_text || p).join('');
      } else if (properties.Name.title) {
        props.name = properties.Name.title.map((t: any) => t.plain_text || t).join('');
      } else if (typeof properties.Name === 'string') {
        props.name = properties.Name;
      }
    }

    // Extract Project
    if (properties.Project) {
      if (Array.isArray(properties.Project)) {
        props.project = properties.Project[0]?.name || properties.Project[0];
      } else if (properties.Project.select) {
        props.project = properties.Project.select.name;
      } else if (typeof properties.Project === 'string') {
        props.project = properties.Project;
      }
    }

    // Extract Priority
    if (properties.Priority) {
      if (properties.Priority.select) {
        props.priority = properties.Priority.select.name;
      } else if (typeof properties.Priority === 'string') {
        props.priority = properties.Priority;
      }
    }

    // Extract Status
    if (properties.Status) {
      if (properties.Status.select) {
        props.status = properties.Status.select.name;
      } else if (properties.Status.status) {
        props.status = properties.Status.status.name;
      } else if (typeof properties.Status === 'string') {
        props.status = properties.Status;
      }
    }

    // Extract Description
    if (properties.Description) {
      if (Array.isArray(properties.Description)) {
        props.description = properties.Description.map((d: any) => d.plain_text || d).join('');
      } else if (properties.Description.rich_text) {
        props.description = properties.Description.rich_text
          .map((t: any) => t.plain_text || t)
          .join('');
      } else if (typeof properties.Description === 'string') {
        props.description = properties.Description;
      }
    }

    // Extract Due Date
    if (properties['Due Date'] || properties.DueDate) {
      const dueDateProp = properties['Due Date'] || properties.DueDate;
      if (dueDateProp.date) {
        props.dueDate = dueDateProp.date.start;
      } else if (typeof dueDateProp === 'string') {
        props.dueDate = dueDateProp;
      }
    }

    // Extract Tags
    if (properties.Tags) {
      if (Array.isArray(properties.Tags)) {
        props.tags = properties.Tags.map((t: any) => t.name || t);
      } else if (properties.Tags.multi_select) {
        props.tags = properties.Tags.multi_select.map((t: any) => t.name || t);
      }
    }

    // Extract Assignee
    if (properties.Assignee) {
      if (properties.Assignee.people && Array.isArray(properties.Assignee.people)) {
        props.assignee = properties.Assignee.people[0]?.name || properties.Assignee.people[0];
      } else if (typeof properties.Assignee === 'string') {
        props.assignee = properties.Assignee;
      }
    }
  }

  // Extract page ID and URL
  if (notionPage.id) {
    props.id = notionPage.id;
  }
  if (notionPage.url) {
    props.url = notionPage.url;
  }

  return props;
}

/**
 * Match LLM-generated todos to existing Notion tasks.
 * Matches by name + project (both must match if project is specified).
 *
 * @param todos - Array of LLM-generated todos
 * @param notionTasks - Array of Notion task pages (from search)
 * @returns Array of enriched todos with Notion data merged in
 */
export async function matchTodosToNotionTasks(todos: Todo[], notionTasks: any[]): Promise<Todo[]> {
  const enrichedTodos: Todo[] = [];

  for (const todo of todos) {
    let matched = false;
    let bestMatch: any = null;

    // Filter Notion tasks by project if todo has a project
    let candidateTasks = notionTasks;
    if (todo.project) {
      // We need to fetch each task to check its Project property
      // For efficiency, we'll check the ones we have and fetch if needed
      const projectFiltered: any[] = [];

      for (const notionTask of notionTasks) {
        const props = extractNotionTaskProperties(notionTask);
        const taskProject = props.project;

        // Case-insensitive project match
        if (taskProject && normalizeString(taskProject) === normalizeString(todo.project)) {
          projectFiltered.push(notionTask);
        }
      }

      candidateTasks = projectFiltered;
    }

    // Try to match by name within the filtered candidates
    for (const notionTask of candidateTasks) {
      const props = extractNotionTaskProperties(notionTask);
      const taskName = props.name || '';

      // Match by task name (fuzzy matching)
      if (taskName && isSimilarTaskName(todo.text, taskName)) {
        // If both have projects, ensure they match
        if (todo.project && props.project) {
          if (normalizeString(todo.project) !== normalizeString(props.project)) {
            continue; // Skip if projects don't match
          }
        }

        matched = true;
        bestMatch = { task: notionTask, props };
        break; // Use first match found
      }
    }

    // If no match found but we have a project, try broader search
    if (!matched && todo.project) {
      // Could implement broader search here if needed
      // For now, we'll just mark as unmatched
    }

    // Create enriched todo
    const enrichedTodo: Todo = {
      ...todo,
      isMatched: matched,
    };

    if (matched && bestMatch) {
      // Merge Notion properties into todo
      const { props } = bestMatch;

      if (props.priority) {
        enrichedTodo.priority = props.priority as any;
      }
      if (props.status) {
        enrichedTodo.status = props.status as any;
      }
      if (props.project) {
        enrichedTodo.project = props.project;
      }
      if (props.description) {
        enrichedTodo.description = props.description;
      }
      if (props.dueDate) {
        enrichedTodo.dueDate = props.dueDate;
      }
      if (props.tags) {
        enrichedTodo.tags = props.tags;
      }
      if (props.assignee) {
        enrichedTodo.assignee = props.assignee;
      }
      if (props.id) {
        enrichedTodo.notionId = props.id;
      }
      if (props.url) {
        enrichedTodo.notionUrl = props.url;
      }
    }

    enrichedTodos.push(enrichedTodo);
  }

  return enrichedTodos;
}
