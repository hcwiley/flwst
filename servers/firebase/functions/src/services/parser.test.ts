/**
 * Unit tests for LLM output parser: props extraction and content stripping.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseDailyNoteProps,
  parseTaskFeedProps,
  parseGenerationOutput,
} from './parser';

describe('parseDailyNoteProps', () => {
  it('parses key/value lines into DailyNoteProps', () => {
    const raw = `Name: Sep 30, 2025
Date: 2025-09-30
Notes Summary: Product sync and roadmap review.
Tags: eng, product, roadmap`;
    const props = parseDailyNoteProps(raw);
    assert.strictEqual(props.name, 'Sep 30, 2025');
    assert.strictEqual(props.date, '2025-09-30');
    assert.strictEqual(props.summary, 'Product sync and roadmap review.');
    assert.deepStrictEqual(props.tags, ['eng', 'product', 'roadmap']);
  });

  it('parses empty Tags as empty array', () => {
    const raw = `Name: Oct 1, 2025
Date: 2025-10-01
Notes Summary: Quick standup.
Tags:`;
    const props = parseDailyNoteProps(raw);
    assert.strictEqual(props.name, 'Oct 1, 2025');
    assert.deepStrictEqual(props.tags, []);
  });

  it('throws if required key is missing', () => {
    const raw = `Name: Sep 30, 2025
Date: 2025-09-30`;
    assert.throws(
      () => parseDailyNoteProps(raw),
      /Missing required daily note prop:/,
    );
  });
});

describe('parseTaskFeedProps', () => {
  it('parses markdown table into task rows', () => {
    const raw = `|name |project |description |priority |status |tags |due |
|---- |------- |----------- |-------- |------ |---- |--- |
|Ship auth |Acme |OAuth2 flow |High |TODO |auth, security |2025-10-15 |
|Review PRs |Acme | |Medium |In Progress | | |`;
    const rows = parseTaskFeedProps(raw);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].name, 'Ship auth');
    assert.strictEqual(rows[0].project, 'Acme');
    assert.strictEqual(rows[0].priority, 'High');
    assert.strictEqual(rows[0].status, 'TODO');
    assert.deepStrictEqual(rows[0].tags, ['auth', 'security']);
    assert.strictEqual(rows[0].due, '2025-10-15');
    assert.strictEqual(rows[1].name, 'Review PRs');
    assert.strictEqual(rows[1].description, undefined);
    assert.strictEqual(rows[1].tags?.length, 0);
  });

  it('returns empty array for empty or header-only table', () => {
    assert.deepStrictEqual(parseTaskFeedProps(''), []);
    const headerOnly = `|name |project |priority |status |
|---- |------- |-------- |------ |`;
    assert.strictEqual(parseTaskFeedProps(headerOnly).length, 0);
  });
});

describe('parseGenerationOutput', () => {
  const sampleRaw = `[[DAILY_NOTE_PROPS]]
Name: Sep 30, 2025
Date: 2025-09-30
Notes Summary: A productive day.
Tags: eng, standup

[[END_DAILY_NOTE_PROPS]]

[[DAILY_NOTE]]
## Daily Overview
- Shipped auth flow.
- Reviewed PRs.

## General Notes
Quick standup and focus time.
[[END_DAILY_NOTE]]

[[TASK_FEED_PROPS]]
|name |project |priority |status |
|---- |------- |-------- |------ |
|Ship auth |Acme |High |TODO |
[[END_TASK_FEED_PROPS]]

[[TASK_FEED]]
### Ship auth
Task Handle: [[Ship auth]]
Summary and criteria here.
[[END_TASK_FEED]]`;

  it('extracts all four blocks and returns props-stripped content', () => {
    const parsed = parseGenerationOutput(sampleRaw);
    assert.strictEqual(parsed.dailyNote.props.name, 'Sep 30, 2025');
    assert.strictEqual(parsed.dailyNote.props.date, '2025-09-30');
    assert.deepStrictEqual(parsed.dailyNote.props.tags, ['eng', 'standup']);
    assert.ok(parsed.dailyNote.content.includes('## Daily Overview'));
    assert.ok(!parsed.dailyNote.content.includes('DAILY_NOTE_PROPS'));

    assert.strictEqual(parsed.taskFeed.props.length, 1);
    assert.strictEqual(parsed.taskFeed.props[0].name, 'Ship auth');
    assert.strictEqual(parsed.taskFeed.taskCount, 1);
    assert.ok(parsed.taskFeed.content.includes('### Ship auth'));
    assert.ok(!parsed.taskFeed.content.includes('TASK_FEED_PROPS'));
  });

  it('strips embedded props block from content when LLM duplicates', () => {
    const rawWithEmbedded = `[[DAILY_NOTE_PROPS]]
Name: X
Date: 2025-01-01
Notes Summary: Y
Tags: a
[[END_DAILY_NOTE_PROPS]]

[[DAILY_NOTE]]
[[DAILY_NOTE_PROPS]]
Name: Dupe
Date: 2025-01-01
Notes Summary: Dupe
Tags: x
[[END_DAILY_NOTE_PROPS]]

## Real content
[[END_DAILY_NOTE]]

[[TASK_FEED_PROPS]]
|name |
|---- |
[[END_TASK_FEED_PROPS]]

[[TASK_FEED]]
Detail section.
[[END_TASK_FEED]]`;
    const parsed = parseGenerationOutput(rawWithEmbedded);
    assert.ok(!parsed.dailyNote.content.includes('DAILY_NOTE_PROPS'));
    assert.ok(parsed.dailyNote.content.includes('## Real content'));
  });

  it('throws if DAILY_NOTE_PROPS is missing', () => {
    const missing = `[[DAILY_NOTE]]
x
[[END_DAILY_NOTE]]

[[TASK_FEED_PROPS]]|name||----|[[END_TASK_FEED_PROPS]]

[[TASK_FEED]]y[[END_TASK_FEED]]`;
    assert.throws(
      () => parseGenerationOutput(missing),
      /Missing required output block: \[\[DAILY_NOTE_PROPS\]\]/,
    );
  });

  it('throws if TASK_FEED is missing', () => {
    const missing = `[[DAILY_NOTE_PROPS]]
Name: a
Date: 2025-01-01
Notes Summary: b
Tags:
[[END_DAILY_NOTE_PROPS]]

[[DAILY_NOTE]]x[[END_DAILY_NOTE]]

[[TASK_FEED_PROPS]]|name||----|[[END_TASK_FEED_PROPS]]`;
    assert.throws(
      () => parseGenerationOutput(missing),
      /Missing required output block: \[\[TASK_FEED\]\]/,
    );
  });
});
