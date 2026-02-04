/**
 * Parser for Gemini output: extracts fenced [[DAILY_NOTE]] and [[TASK_FEED]] blocks.
 */

/**
 * Parsed structure matching GenerateResponse dailyNote and taskFeed shape.
 */
export interface ParsedOutput {
  dailyNote: {
    content: string;
    summary?: string;
    tags?: string[];
  };
  taskFeed: {
    content: string;
    taskCount: number;
  };
}

const DAILY_NOTE_REGEX = /\[\[DAILY_NOTE\]\]([\s\S]*?)\[\[END_DAILY_NOTE\]\]/;
const TASK_FEED_REGEX = /\[\[TASK_FEED\]\]([\s\S]*?)\[\[END_TASK_FEED\]\]/;

/**
 * Extract summary from Daily Overview section (first 200 chars of that section).
 */
function extractSummary(content: string): string | undefined {
  const match = content.match(/##\s*Daily Overview\s*([\s\S]*?)(?=\n##|$)/i);
  if (!match) return undefined;
  return match[1].trim().slice(0, 200) || undefined;
}

/**
 * Parse raw Gemini output into daily note and task feed.
 * @param raw - Full model output containing fenced blocks
 * @returns ParsedOutput with content and task count
 * @throws Error if required blocks are missing
 */
export function parseGenerationOutput(raw: string): ParsedOutput {
  const dailyNoteMatch = raw.match(DAILY_NOTE_REGEX);
  const taskFeedMatch = raw.match(TASK_FEED_REGEX);

  if (!dailyNoteMatch || !taskFeedMatch) {
    throw new Error(
      'Missing required output blocks: [[DAILY_NOTE]]/[[END_DAILY_NOTE]] or [[TASK_FEED]]/[[END_TASK_FEED]]',
    );
  }

  const dailyNoteContent = dailyNoteMatch[1].trim();
  const taskFeedContent = taskFeedMatch[1].trim();

  // Count task rows: table rows after header (skip header line).
  const tableRows = taskFeedContent.match(/^\|[^|]+\|/gm) ?? [];
  const taskCount = Math.max(0, tableRows.length - 1);

  return {
    dailyNote: {
      content: dailyNoteContent,
      summary: extractSummary(dailyNoteContent),
      tags: undefined,
    },
    taskFeed: {
      content: taskFeedContent,
      taskCount,
    },
  };
}
