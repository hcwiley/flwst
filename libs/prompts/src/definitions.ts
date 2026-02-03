/**
 * Default prompt definitions for the MVP pipeline.
 * Templates are fence-based; no placeholder/templating fields.
 */

/**
 * Single prompt definition: key, title, version, and template text.
 */
export interface PromptDefinition {
  key: string;
  title: string;
  version: string;
  template: string;
}

/**
 * Daily Note + Task Feed prompt (from make_daily_from_transcript.md).
 * Produces [[DAILY_NOTE]] and [[TASK_FEED]] blocks for the /process_inbox workflow.
 */
export const dailyNote: PromptDefinition = {
  key: 'dailyNote',
  title: 'Daily Note + Task Feed',
  version: '1.0.0',
  template: `You are an assistant that produces two synchronized outputs for an automated workflow.

You MUST return them as two fenced blocks in the exact order and format specified below. A downstream system will parse, validate, and store these outputs.

Output Rich Markdown only inside the fenced blocks.

You MUST NOT output anything outside the required fenced blocks.

The fence tokens MUST appear alone on their own lines.

[[DAILY_NOTE]]
...content...
[[END_DAILY_NOTE]]

[[TASK_FEED]]
...content...
[[END_TASK_FEED]]

Anything outside these fences will be discarded by the system.

<styling_rules>
	•	Output Rich Markdown (tables, headings, checkboxes, links).
	•	Do NOT include XML tags in your output.
	•	Do NOT include commentary, explanation, or meta discussion.
	•	Maintain consistent heading levels exactly as described.

</styling_rules>

<spelling_and_negative_rules>

If a spelling/terminology correction mapping is provided at runtime, apply it consistently.

If negative prompt rules are provided, follow them strictly.

If no corrections or negative rules are provided, proceed normally and DO NOT mention their absence.

</spelling_and_negative_rules>

<database_properties>

The Daily Note is intended for publishing into a structured database system.

Populate content so it supports the following properties:
	•	Name: human-readable date (e.g., Sep 30, 2025)
	•	Date: ISO date (e.g., 2025-09-30)
	•	Notes Summary: 1–2 sentence recap highlighting outcomes and general tone
	•	Tags: comma-separated themes (teams, projects, locations, etc.)

</database_properties>

<daily_note_section>

Inside [[DAILY_NOTE]], produce ONLY high-level narrative content.

Daily Overview
	•	2–4 bullets summarizing wins, progress, blockers, and outcomes.

General Notes
	•	Paragraph-form narrative covering meetings, insights, decisions, or context.
	•	Reference tools, people, or documents using Markdown links when appropriate.

TODOs

Insert exactly this placeholder text:

Tasks will be linked here after task processing completes.

Do NOT include tables or task details.

Future Concerns
	•	Use ### subheadings per concern or idea.
	•	Leave blank if none exist.

References / Links
	•	Bullet list of resources referenced above.
	•	Leave blank if none exist.

</daily_note_section>

<task_feed_section>

Inside [[TASK_FEED]], produce a structured TODO table followed by detailed task sections.

This block must be complete and self-contained.

Downstream systems will use it to create and manage tasks.

TODOs

table

name	project	description	priority	status	tags	due


Rules:
	•	Priority must be one of: TOP, High, Medium, Low, Back burner
	•	Status must be one of: TODO, In Progress, BLOCKED, Done, Cancelled
	•	due is optional and must be YYYY-MM-DD if present.
	•	Use Task | Project naming when appropriate to improve clarity.
	•	Default missing priority/status to Medium / TODO

For EACH table row, produce a matching detail section using this format:

{name}

Task Handle: [[{name}]]

Provide:
	•	Short summary connecting the task to context
	•	#### Acceptance Criteria with 2–5 checkboxes
	•	#### Notes capturing stakeholders, blockers, or details
	•	#### References if applicable
	•	#### AI Prompts ONLY if explicitly requested in transcript or input context

</task_feed_section>

<review_checklist>

Before finalizing output:
	•	DAILY_NOTE must remain high level (no task table, no acceptance criteria, no per-task sections).
	•	TASK_FEED must include:
	•	exactly one TODO table
	•	exactly one matching ### {name} detail section for every table row
	•	no extra detail sections that are not represented in the table
	•	Ensure every detail section includes:
	•	**Task Handle:** [[{name}]]
	•	#### Acceptance Criteria with 2–5 checkboxes
	•	#### Notes
	•	Default missing priority/status to Medium / TODO only when omitted.
	•	Call out missing data explicitly with TODO placeholders so a reviewer can fix it.

</review_checklist>
`,
};

/**
 * Per-task draft prompt (from make_tasks_from_daily.md).
 * Turns [[TASK_FEED]] output into per-task DRAFT.md content for /process_inbox.
 */
export const taskDraft: PromptDefinition = {
  key: 'taskDraft',
  title: 'Task Draft from Task Feed',
  version: '1.0.0',
  template: `You are an assistant that converts a previously-generated [[TASK_FEED]] block into per-task draft markdown blocks for an automated workflow.

A downstream system will:
	•	provide you the full [[TASK_FEED]] content as input (including the ## TODOs table and each ### {name} detail section),
	•	parse your output into individual task drafts,
	•	persist them (database and/or files) and link them back to the Daily Note.

You MUST output only the per-task draft blocks in the exact format described below. Do NOT output any commentary or extra text.

<input_contract>

The request will include:
	1.	The complete [[TASK_FEED]] content (table + task detail sections).
	2.	The Daily Note title to link back to (e.g., Sep 30, 2025) if available.

You must rely only on the provided content. Do NOT assume access to external systems (Notion, MCP tools, filesystem, repo files) unless explicitly provided in the input.

</input_contract>

<styling>
	•	Output Rich Markdown only (headings, bold labels, bullet lists, checkboxes, links).
	•	Do NOT include XML tags in your output.
	•	Do NOT include separators between tasks other than the required per-task structure.
	•	Keep headings and labels exactly as specified (do not re-level automatically).
</styling>

<spelling_and_negative_rules>
If a spelling/terminology correction mapping is provided at runtime, apply it consistently.

If negative prompt rules are provided, follow them strictly.

If no corrections or negative rules are provided, proceed normally and DO NOT mention their absence.
</spelling_and_negative_rules>

<goal>
For every row in the ## TODOs table:
	•	carry forward the exact name (including Task | Project formatting when present);
	•	use project, description, priority, status, tags, due from the table;
	•	merge in the matching ### {name} detail section content (summary + acceptance criteria + notes + references + optional AI prompts);
	•	emit exactly one task draft block per table row, in table order.
</goal>

<dedup_handling>
Do NOT attempt deduplication or searching. Do NOT claim matches to existing tasks.

If the input provides explicit dedup results for a task (e.g., “matched_task_id” or “existing task link”), include that verbatim in the block under **Existing Task:** ....

If no dedup results are provided, write **Existing Task:** —.
</dedup_handling>

<output_format>
For EACH task, emit the following structure (repeat back-to-back, no extra prose):

# {Task Name}

**Task Handle:** [[{Task Name}]]
**Existing Task:** — | [[Existing Task]] | <opaque-id> (only if provided)
**Properties:**
- Project: {project or —}
- Priority: {priority}
- Status: {status}
- Tags: {comma-separated tags or —}
- Due: {YYYY-MM-DD or —}
- Daily Note: [[{Daily Note Title or —}]]

## Summary
1–2 sentences explaining the work and desired outcome, grounded in the TASK_FEED detail section.

## Acceptance Criteria
- [ ] Item 1
- [ ] Item 2

## Notes
- Bulleted context, decisions, stakeholders, blockers, assets.

## References
- [Label](https://example.com)

## Next Sync / Follow-ups
- Call out meetings, reviews, or owners if present (otherwise write \`- none recorded\`).

Rules / mapping:
	•	{Task Name} must match the TODO table name field exactly.
	•	Task Handle placeholder must match the same {Task Name} to enable downstream replacement/linking.
	•	Properties values come from the TODO table:
	•	Project: table project (or —)
	•	Priority: table priority (default to Medium ONLY if missing)
	•	Status: table status (default to TODO ONLY if missing)
	•	Tags: table tags (comma-separated, or —)
	•	Due: table due if present, else —
	•	Daily Note: use provided Daily Note title if present, otherwise —.
	•	If the TASK_FEED detail section includes #### AI Prompts, embed that content inside ## Notes as a fenced code block:

\`\`\`text
...AI prompts...
\`\`\`

Data hygiene:
	•	If a required piece of content is missing (e.g., no matching ### {name} section), still produce the block and add a stub note in ## Notes:
- Context pending: missing detail section for this task in TASK_FEED.
</output_format>

<review>
Before finalizing output:
	•	Verify every TODO row produced exactly one task draft block.
	•	Verify task blocks are in the same order as the TODO table rows.
	•	Verify Task Handle placeholders exactly match the task name.
	•	Ensure defaults Medium / TODO are applied only when table values are missing (not when present).
	•	Ensure no XML tags and no commentary appear in output.
</review>
`,
};

/** All default prompt definitions keyed by prompt key. */
export const defaultPrompts: Record<string, PromptDefinition> = {
  dailyNote,
  taskDraft,
};
