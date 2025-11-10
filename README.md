# flwst

flow state: AI workflow to get your mind in order so you flow through your day.

Neat. What does it do?

`flwst` is grouping of prompts, how-tos, and scripts to go from thinking to process management to execution without you having to do a lot of time consuming PM work (make tickets, update statuses, etc.)

The initial integration targets:
- Input from Voice Notes transcript
- Processing of raw input via canned prompts
- Generating and updating of tasks in Notion via MCP

## structure

- `inbox/`: all your incoming tasks, voice notes, images, etc.
- `prompts/`: all your the canned prompts for the AI to process the inbox.
- `config/`: all your the configuration for the AI to use.
  - Note: Not tracked by git (except the `config/examples/` directory).
- `tmp/`: all your the temporary files for the AI to use.
  - Note: Not tracked by git.
- `archive/`: all your the archived files for the AI to use.
  - Note: Not tracked by git.

## setup

Install Notion MCP:
- https://developers.notion.com/docs/get-started-with-mcp

Install Cursor:
- https://www.cursor.com/

### Notion Databases

Get the database IDs from the Notion database settings and paste them into the `config/notion.ts` file. Optional but highly recommended as it will cut down on the number of API calls and improve performance.

![Copy Notion Database ID](./docs/copy-database-id.gif)


#### Daily Notes
- `Name`: The name of the daily note.
- `Date`: The date of the daily note.
- `Summary`: A high level summary of the daily note.
- `Tags`: A list of tags to group daily notes.
- `Tasks`: Relation to the Tasks Page that task is from or referenced in (Many to Many relationship)

#### Tasks
- `Name`: The name of the task.
- `Project`: The project the task is associated with (optional)
- `Description`: The description of the task.
- `Priority`: The priority of the task.
- `Status`: The status of the task.
- `Tags`: A list of tags to group tasks (optional)
- `Due Date`: The due date of the task (optional)
- `Assignee`: The assignee of the task (optional)
- `Daily Notes`: Relation to the Daily Notes Page that task is from or referenced in (Many to Many relationship)

### configs

Copy the `config/examples/` directory to `config/` and edit the files as needed.

- `config/notion.ts`: Update the names of various Notion databases and properties.
- `config/spelling.ts`: Update the spelling of various words and phrases.

## Usage

- Use a voice recording tool to record your daily notes.
- Get a transcript of the recording and drop it in the `inbox/` directory.
- Run the `/import_daily` command to import the transcript into the Daily Notes database.
- Run the `/update_tasks` command to update the tasks in the Tasks database from the Daily Notes entry.
- Run the `/list_daily` command to list all daily notes in the Daily Notes database.
