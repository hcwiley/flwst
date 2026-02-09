# Alpha smoke test checklist

Use this checklist to validate a built alpha (e.g. DMG) on a clean machine before
handing builds to alpha users.

## Prerequisites

- A Mac that has **not** had the app installed before (or clear app data / uninstall first).
- Built artifact: e.g. `flwst-1.0.0.dmg` from `apps/electron/dist/` after running
  `pnpm --filter @flwst/electron build:mac`.

## Steps

- [ ] **Install**  
      Open the DMG, drag the app to Applications (or desired location). Launch the app.

- [ ] **First launch**  
      Confirm the app opens without crashing. Grant any requested permissions (e.g. keychain)
      if prompted. You should see the onboarding flow (Welcome / system selection).

- [ ] **Onboarding (Notion path)**  
      Complete the full Notion onboarding: choose Notion, complete OAuth (authorize in
      browser, return to app), select parent page, confirm create, wait for resources
      creation, complete status conversion. Confirm the app reaches the main layout
      (Inbox, main pane, settings rail, status pane).

- [ ] **Inbox + run**  
      In the Inbox pane, paste a short transcript (or drop a small `.txt` / `.md` file)
      and run ingest. Confirm success: status shows success, and the main pane shows
      the daily note preview and task list (Kanban).

- [ ] **Sync**  
      Click Sync in the top bar. Confirm the Kanban board updates (tasks from Notion
      appear if any exist).

- [ ] **Publish (if applicable)**  
      If the last run produced draft tasks, use “Publish to Notion” and confirm
      tasks appear in Notion (or the success message is shown).

- [ ] **Error path (optional)**  
      Disconnect network or revoke Notion access, then trigger sync or an action that
      depends on network. Confirm the app does not crash and shows a clear, user-friendly
      error message (no raw stack traces).

## Sign-off

- [ ] All steps above passed. Build is ready for alpha distribution.
