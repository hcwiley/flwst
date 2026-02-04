/**
 * Parser for Gemini output: extracts fenced [[*_PROPS]] and content blocks,
 * parses structured props, and returns content with props stripped.
 */

/**
 * Daily note props from [[DAILY_NOTE_PROPS]] (key/value lines).
 */
export interface DailyNoteProps {
  name: string;
  date: string;
  summary: string;
  tags: string[];
}

/**
 * Single task row from [[TASK_FEED_PROPS]] table.
 */
export interface TaskFeedPropRow {
  name: string;
  project?: string;
  description?: string;
  priority: string;
  status: string;
  tags: string[];
  due?: string;
}

/**
 * Parsed structure matching GenerateResponse dailyNote and taskFeed shape.
 */
export interface ParsedOutput {
  dailyNote: {
    content: string;
    props: DailyNoteProps;
  };
  taskFeed: {
    content: string;
    taskCount: number;
    props: TaskFeedPropRow[];
  };
}

const DAILY_NOTE_PROPS_REGEX =
  /\[\[DAILY_NOTE_PROPS\]\]([\s\S]*?)\[\[END_DAILY_NOTE_PROPS\]\]/;
const DAILY_NOTE_REGEX = /\[\[DAILY_NOTE\]\]([\s\S]*?)\[\[END_DAILY_NOTE\]\]/;
const TASK_FEED_PROPS_REGEX =
  /\[\[TASK_FEED_PROPS\]\]([\s\S]*?)\[\[END_TASK_FEED_PROPS\]\]/;
const TASK_FEED_REGEX = /\[\[TASK_FEED\]\]([\s\S]*?)\[\[END_TASK_FEED\]\]/;

/**
 * Strip embedded props block from content (in case LLM duplicates it).
 */
function stripEmbeddedPropsBlock(
  content: string,
  openTag: string,
  closeTag: string,
): string {
  const re = new RegExp(
    `\\[\\[${openTag}\\][\\s\\S]*?\\[\\[${closeTag}\\]\\]\\s*`,
    'g',
  );
  return content.replace(re, '').trim();
}

/**
 * Parse [[DAILY_NOTE_PROPS]] key/value lines into DailyNoteProps.
 * Expects: Name:, Date:, Notes Summary:, Tags: (comma-separated).
 * @throws Error if required keys are missing
 */
export function parseDailyNoteProps(raw: string): DailyNoteProps {
  const lines = raw.trim().split('\n');
  const get = (key: string): string => {
    const prefix = key + ':';
    const line = lines.find((l) => l.trim().startsWith(prefix));
    if (!line) throw new Error(`Missing required daily note prop: ${key}`);
    return line.trim().slice(prefix.length).trim();
  };

  const tagsStr = get('Tags');
  const tags = tagsStr
    ? tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return {
    name: get('Name'),
    date: get('Date'),
    summary: get('Notes Summary'),
    tags,
  };
}

/**
 * Parse [[TASK_FEED_PROPS]] markdown table into TaskFeedPropRow[].
 * Header: |name|project|description|priority|status|tags|due|
 */
export function parseTaskFeedProps(raw: string): TaskFeedPropRow[] {
  const lines = raw
    .trim()
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header: normalize to lowercase, strip pipes and spaces
  const headerLine = lines[0];
  const headers = headerLine
    .split('|')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  const rows: TaskFeedPropRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('|').map((c) => c.trim());
    // Markdown table rows often have leading empty cell (before first |).
    const cellByHeader: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const val = cells[idx + 1] ?? cells[idx] ?? '';
      if (val && val !== '—' && val !== '-') cellByHeader[h] = val;
    });

    const get = (key: string): string => cellByHeader[key] ?? '';
    const name = get('name') || '';
    // Skip markdown table separator row (e.g. |----|-------|).
    if (/^-+$/.test(name.trim())) continue;

    const tagsStr = get('tags');
    const tags = tagsStr
      ? tagsStr
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    rows.push({
      name,
      project: get('project') || undefined,
      description: get('description') || undefined,
      priority: get('priority') || 'Medium',
      status: get('status') || 'TODO',
      tags,
      due: get('due') || undefined,
    });
  }

  return rows.filter((r) => r.name.length > 0);
}

/**
 * Parse raw Gemini output into daily note and task feed with structured props.
 * Requires all four blocks: DAILY_NOTE_PROPS, DAILY_NOTE, TASK_FEED_PROPS, TASK_FEED.
 * Content is returned with any embedded props blocks stripped.
 * @param raw - Full model output containing fenced blocks
 * @returns ParsedOutput with content, props, and task count
 * @throws Error if required blocks are missing
 */
export function parseGenerationOutput(raw: string): ParsedOutput {
  const dailyNotePropsMatch = raw.match(DAILY_NOTE_PROPS_REGEX);
  const dailyNoteMatch = raw.match(DAILY_NOTE_REGEX);
  const taskFeedPropsMatch = raw.match(TASK_FEED_PROPS_REGEX);
  const taskFeedMatch = raw.match(TASK_FEED_REGEX);

  if (!dailyNotePropsMatch) {
    throw new Error(
      'Missing required output block: [[DAILY_NOTE_PROPS]]/[[END_DAILY_NOTE_PROPS]]',
    );
  }
  if (!dailyNoteMatch) {
    throw new Error(
      'Missing required output block: [[DAILY_NOTE]]/[[END_DAILY_NOTE]]',
    );
  }
  if (!taskFeedPropsMatch) {
    throw new Error(
      'Missing required output block: [[TASK_FEED_PROPS]]/[[END_TASK_FEED_PROPS]]',
    );
  }
  if (!taskFeedMatch) {
    throw new Error(
      'Missing required output block: [[TASK_FEED]]/[[END_TASK_FEED]]',
    );
  }

  const dailyNoteProps = parseDailyNoteProps(dailyNotePropsMatch[1].trim());
  let dailyNoteContent = dailyNoteMatch[1].trim();
  dailyNoteContent = stripEmbeddedPropsBlock(
    dailyNoteContent,
    'DAILY_NOTE_PROPS',
    'END_DAILY_NOTE_PROPS',
  );

  const taskFeedProps = parseTaskFeedProps(taskFeedPropsMatch[1].trim());
  let taskFeedContent = taskFeedMatch[1].trim();
  taskFeedContent = stripEmbeddedPropsBlock(
    taskFeedContent,
    'TASK_FEED_PROPS',
    'END_TASK_FEED_PROPS',
  );

  // Task count from props rows (table body); keep in sync with content sections.
  const taskCount = taskFeedProps.length;

  return {
    dailyNote: {
      content: dailyNoteContent,
      props: dailyNoteProps,
    },
    taskFeed: {
      content: taskFeedContent,
      taskCount,
      props: taskFeedProps,
    },
  };
}
