import { Todo } from '@flwst/types/src/api/reasoning';
import { notionClient } from './mcp-client.js';
import { notionConfig } from '../../../config/notion.js';

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

  console.debug(`[matching] Comparing task names:
    Original 1: "${name1}"
    Original 2: "${name2}"
    Normalized 1: "${normalized1}"
    Normalized 2: "${normalized2}"`);

  // Exact match after normalization
  if (normalized1 === normalized2) {
    console.debug(`[matching] ✓ Exact match: "${normalized1}" === "${normalized2}"`);
    return true;
  }

  // Check if one contains the other (for partial matches)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    console.debug(`[matching] ✓ Partial inclusion match: "${normalized1}" <-> "${normalized2}"`);
    return true;
  }

  // Extract key words (3+ characters) and check for overlap
  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that']);
  const words1 = normalized1.split(' ').filter((w) => w.length >= 3 && !stopWords.has(w));
  const words2 = normalized2.split(' ').filter((w) => w.length >= 3 && !stopWords.has(w));

  console.debug(`[matching] Extracted words:
    Words from "${name1}": [${words1.join(', ')}] (${words1.length} words)
    Words from "${name2}": [${words2.join(', ')}] (${words2.length} words)`);

  if (words1.length === 0 || words2.length === 0) {
    console.debug(
      `[matching] ✗ No words to compare (words1: ${words1.length}, words2: ${words2.length})`,
    );
    return false;
  }

  // Check if significant words overlap
  const commonWords = words1.filter((w) => words2.includes(w));
  const minWords = Math.min(words1.length, words2.length);
  const threshold = Math.ceil(minWords * 0.4);
  const score = commonWords.length / minWords;
  const isMatch = commonWords.length >= threshold;

  console.debug(`[matching] Fuzzy match analysis:
    Common words: [${commonWords.join(', ')}] (${commonWords.length} matches)
    Minimum words: ${minWords}
    Threshold: ${threshold} (40% of ${minWords})
    Score: ${score.toFixed(2)} (${commonWords.length}/${minWords})
    Result: ${isMatch ? '✓ MATCH' : '✗ NO MATCH'}`);

  // If at least 40% of words match, consider it similar (relaxed from 50%)
  return isMatch;
}

// Keep transcript-derived values when provided.
function preferExisting<T>(current: T | undefined, incoming: T | undefined): T | undefined {
  return current ?? incoming;
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

  // DEBUG: Log the raw structure to understand what we're working with (only once per unique structure)
  const hasProperties = !!notionPage.properties;
  const propertyKeys = hasProperties ? Object.keys(notionPage.properties) : [];
  const hasTitle = !!notionPage.title;

  if (!hasProperties && !hasTitle) {
    console.debug(`[matching] Raw notionPage structure (no properties or title):`, {
      topLevelKeys: Object.keys(notionPage).slice(0, 10),
      id: notionPage.id,
    });
  }

  // Handle different response formats
  if (notionPage.properties) {
    const properties = notionPage.properties;

    // Extract Name (title property) - try primary pattern first
    if (properties.Name) {
      if (Array.isArray(properties.Name)) {
        props.name = properties.Name.map((p: any) => p.plain_text || p).join('');
      } else if (properties.Name.title) {
        props.name = properties.Name.title.map((t: any) => t.plain_text || t).join('');
      } else if (typeof properties.Name === 'string') {
        props.name = properties.Name;
      }
    }

    // FALLBACK 1: Try to find the title property by checking common patterns
    if (!props.name) {
      // Try the first property (often the title in Notion databases)
      const firstPropKey = Object.keys(properties)[0];
      if (firstPropKey && properties[firstPropKey]) {
        const firstProp = properties[firstPropKey];
        if (firstProp.title && Array.isArray(firstProp.title)) {
          props.name = firstProp.title.map((t: any) => t.plain_text || t).join('');
          console.debug(
            `[matching] Found name in first property "${firstPropKey}": "${props.name}"`,
          );
        } else if (Array.isArray(firstProp) && firstProp.length > 0) {
          props.name = firstProp.map((p: any) => p.plain_text || p).join('');
          console.debug(
            `[matching] Found name in first property array "${firstPropKey}": "${props.name}"`,
          );
        }
      }

      // FALLBACK 2: Try common title property names (case-insensitive)
      if (!props.name) {
        const titleKeys = Object.keys(properties).filter(
          (k) =>
            k.toLowerCase().includes('title') ||
            k.toLowerCase().includes('name') ||
            k.toLowerCase() === 'title',
        );
        for (const key of titleKeys) {
          const prop = properties[key];
          if (prop && prop.title && Array.isArray(prop.title)) {
            props.name = prop.title.map((t: any) => t.plain_text || t).join('');
            console.debug(`[matching] Found name in property "${key}": "${props.name}"`);
            break;
          } else if (prop && Array.isArray(prop) && prop.length > 0) {
            props.name = prop.map((p: any) => p.plain_text || p).join('');
            console.debug(`[matching] Found name in property array "${key}": "${props.name}"`);
            break;
          }
        }
      }

      // FALLBACK 3: If still no name, log available properties for debugging
      if (!props.name && propertyKeys.length > 0) {
        console.debug(
          `[matching] Could not extract name. Available properties: ${propertyKeys.join(', ')}`,
        );
        // Log structure of first few properties for debugging
        for (const key of propertyKeys.slice(0, 3)) {
          const prop = properties[key];
          console.debug(`[matching] Property "${key}" structure:`, {
            type: typeof prop,
            isArray: Array.isArray(prop),
            hasTitle: prop?.title ? true : false,
            keys: prop && typeof prop === 'object' ? Object.keys(prop).slice(0, 5) : [],
          });
        }
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

  // FALLBACK 4: Check for direct title property on the page object
  if (!props.name && notionPage.title) {
    if (typeof notionPage.title === 'string') {
      props.name = notionPage.title;
      console.debug(`[matching] Found name in notionPage.title (string): "${props.name}"`);
    } else if (Array.isArray(notionPage.title)) {
      props.name = notionPage.title.map((t: any) => t.plain_text || t).join('');
      console.debug(`[matching] Found name in notionPage.title (array): "${props.name}"`);
    } else if (notionPage.title.plain_text) {
      props.name = notionPage.title.plain_text;
      console.debug(`[matching] Found name in notionPage.title.plain_text: "${props.name}"`);
    }
  }

  // Extract page ID and URL
  if (notionPage.id) {
    props.id = notionPage.id;
  }
  if (notionPage.url) {
    props.url = notionPage.url;
  }

  // console.debug(`[matching] Extracted properties for "${props.name || 'unnamed'}":`, {
  //   id: props.id,
  //   project: props.project,
  //   status: props.status,
  //   priority: props.priority,
  // });

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

  console.debug(
    `[matching] Starting matching for ${todos.length} todos against ${notionTasks.length} Notion candidates`,
  );

  for (const todo of todos) {
    let matched = false;
    let bestMatch: any = null;

    console.debug(
      `[matching] Processing todo: "${todo.text}" (project: ${todo.project || 'none'})`,
    );

    // Filter Notion tasks by project if todo has a project
    let candidateTasks = notionTasks;
    if (todo.project) {
      const projectFiltered: any[] = [];

      for (const notionTask of notionTasks) {
        const props = extractNotionTaskProperties(notionTask);
        const taskProject = props.project;

        // MATCH if:
        // - Notion task has NO project (allow fuzzy matching to claim it)
        // - OR Notion task project matches the todo project
        const isProjectMatch =
          !taskProject || normalizeString(taskProject) === normalizeString(todo.project);

        if (isProjectMatch) {
          projectFiltered.push(notionTask);
        } else {
          console.debug(
            `[matching] Skipping candidate "${props.name}" due to project mismatch: Notion="${taskProject}" vs Todo="${todo.project}"`,
          );
        }
      }

      candidateTasks = projectFiltered;
      console.debug(
        `[matching] Filtered to ${candidateTasks.length} candidates by project "${todo.project}"`,
      );
    }

    // Try to match by name within the filtered candidates
    console.debug(
      `[matching] Evaluating ${candidateTasks.length} candidate tasks for "${todo.text}"`,
    );
    for (const notionTask of candidateTasks) {
      const props = extractNotionTaskProperties(notionTask);
      const taskName = props.name || '';

      console.debug(
        `[matching] Evaluating candidate: "${taskName}" (project: ${props.project || 'none'}, id: ${props.id || 'none'})`,
      );

      // Match by task name (fuzzy matching)
      if (taskName && isSimilarTaskName(todo.text, taskName)) {
        // Safety validation: Ensure the matched page is from the Tasks database
        const tasksDbId = notionConfig?.databases?.tasks?.id;
        if (tasksDbId) {
          const normalizeDbId = (id: string) => id.replace(/-/g, '').toLowerCase();
          const pageParent = notionTask.parent;

          if (!pageParent || pageParent.type !== 'database_id') {
            console.debug(
              `[matching] ✗ Safety check failed: "${taskName}" is not from a database (parent type: ${pageParent?.type || 'none'})`,
            );
            continue;
          }

          const pageDbId = pageParent.database_id || '';
          if (normalizeDbId(pageDbId) !== normalizeDbId(tasksDbId)) {
            console.debug(
              `[matching] ✗ Safety check failed: "${taskName}" is from wrong database (parent.database_id="${pageDbId}" vs expected="${tasksDbId}")`,
            );
            continue;
          }
        }

        // Double check project conflict (both have different projects)
        if (
          todo.project &&
          props.project &&
          normalizeString(todo.project) !== normalizeString(props.project)
        ) {
          console.debug(`[matching] ✗ Names similar but project conflict:
            Todo project: "${todo.project}"
            Notion project: "${props.project}"
            Skipping match.`);
          continue;
        }

        matched = true;
        bestMatch = { task: notionTask, props };
        console.debug(
          `[matching] ✓ MATCH FOUND: "${todo.text}" matched with "${taskName}" (${props.id})`,
        );
        break; // Use first match found
      } else {
        console.debug(`[matching] ✗ Name similarity check failed for "${taskName}"`);
      }
    }

    if (!matched) {
      console.debug(`[matching] NO MATCH found for "${todo.text}"`);
    }

    // Create enriched todo
    const enrichedTodo: Todo = {
      ...todo,
      isMatched: matched,
    };

    if (matched && bestMatch) {
      // Merge Notion properties into todo, but keep transcript-driven updates.
      const { props } = bestMatch;

      if (props.priority) {
        enrichedTodo.priority = preferExisting(enrichedTodo.priority, props.priority as any);
      }
      if (props.status) {
        enrichedTodo.status = preferExisting(enrichedTodo.status, props.status as any);
      }
      if (props.project) {
        enrichedTodo.project = preferExisting(enrichedTodo.project, props.project);
      }
      if (props.description) {
        enrichedTodo.description = preferExisting(enrichedTodo.description, props.description);
      }
      if (props.dueDate) {
        enrichedTodo.dueDate = preferExisting(enrichedTodo.dueDate, props.dueDate);
      }
      if (props.tags) {
        enrichedTodo.tags = preferExisting(enrichedTodo.tags, props.tags);
      }
      if (props.assignee) {
        enrichedTodo.assignee = preferExisting(enrichedTodo.assignee, props.assignee);
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
