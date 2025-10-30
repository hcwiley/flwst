write THE_FILE to be a command i can run in the Cursor Agent via `/THE_FILE`.

it will live in the `.cursor/commands/` directory so we can use it in the Cursor Agent via `/THE_FILE`.

do NOT actually execute the command, just write the file.

i will now give you the idea of the command using <xml> tags so you can understand the structure and content. The results should be in Rich Markdown format. DO NOT USE XML TAGS IN THE RESULTS.

<summary>

</summary>

<goal>

</goal>

<inputs>
- `yes`: confirm and proceed
- `no`: do NOT confirm, Cursor will prompt for how to handle
- `quit`: do NOT confirm, exit the command and reset the context to start fresh.
</input>

<configs>
`./config/notion.ts`
`./config/spelling.ts`
</configs>

<agent_steps>

</agent_steps>