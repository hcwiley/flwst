# UI Polish Pass (Tamagui) — Notes

## What changed

### Shared primitives (`@flwst/ui`)

- **Panel** — Container with `$gray2` bg, 1px border, `$4` radius, `$3` padding/gap. Used for Inbox, Kanban board, Kanban columns, Settings content.
- **AppCard** — Card with `$background` bg, `$gray5` border, `$3` radius, `$2` padding. Used for Kanban task cards.
- **Typography** — `H1`, `H2`, `MetaText`, `BodyText` token-driven text variants.
- **Pill** — Compact badge for tags, source labels, counts. Supports `bg`/`color` overrides (e.g. Notion vs Pending).
- **Toolbar** — Horizontal stack with `$2` gap, wrap, for control surfaces.

### Layout and panes

- **MainPaneHeader** — Uses `H1` for title, `MetaText` for run metadata.
- **InboxPane** — Wrapped in `Panel` with sticky “Inbox” header; `H1`, `H2`, `MetaText` for headings and copy.
- **MainLayout** — Unchanged; already uses `$background`.

### Kanban board

- **Board container** — Outer board is a `Panel`; header is a single **Toolbar** (no more two separate “Sort” / “Columns” rows).
- **Sort** — “Sort by” label + sort-key buttons (Name, Last Updated, Priority, Project) with clear active state (`theme='active'` + fontWeight). Separate Asc/Desc toggle button. Same `updatePrefs` / `handleSortKey` / `handleSortDir` logic.
- **Column visibility** — “Columns” button opens a **Popover** with a checkbox-style list for each status (Backlog, To-do, On Deck, In progress, Blocked, Done, Cancelled). Active = filled checkbox + bg/border; same `handleToggleStatus` logic.
- **Header left** — “Kanban” title (`H2`) + “Synced HH:MM” when `lastSyncAt` is set (from store).

### Kanban columns and cards

- **KanbanColumn** — Wrapped in `Panel`; sticky header with column title (`H2`) + count **Pill**; body in **ScrollView** with `maxHeight` for internal scroll; empty state uses `MetaText` “No tasks”. Drag-drop unchanged (div drop target).
- **KanbanTaskCard** — Wrapped in **AppCard**; title as **BodyText** (clickable blue link when Notion URL); source as **Pill** (blue/yellow); project and priority/due as **MetaText**; tags as wrapped **Pill**s (capped + overflow) to avoid layout jitter.

### Settings rail and footer

- **SettingsRail** — Collapsed: single “Settings” button (replaces “>” and “SET”). Expanded: **H2** “Settings” + “◀” collapse; content in **Panel** wrapping `ConfigPane`. Clear `aria-label`s.
- **StatusPane** — All footer text uses **MetaText**; Copy and collapse buttons use `size='$1'` and `theme='gray'` for a quieter, tertiary look. “Status: Ready” remains readable.

## Intentional tradeoffs

- **Sticky column header** — Implemented with `style={{ position: 'sticky', top: 0 }}` on the column header so it works in the DOM; Tamagui’s `position` type doesn’t include `'sticky'`.
- **Popover for columns** — Uses Tamagui `Popover` from the main `tamagui` package. If your bundle doesn’t expose it, you may need to import from `@tamagui/popover` and ensure a portal root.
- **No new dependencies** — Settings rail uses the label “Settings” instead of a Lucide icon to avoid adding `@tamagui/lucide-icons` to the Electron app.
- **Column body height** — `COLUMN_BODY_MAX_HEIGHT = 420` is fixed; you can switch to a viewport-relative value (e.g. `70vh`) if desired.

## Manual checks (from plan)

- Resize window: narrow / medium / wide; toolbar wraps; no overlaps or clipping.
- Sort: selection is obvious; changing sort reorders cards; Asc/Desc works.
- Column toggles: on/off obvious; hiding columns doesn’t break layout or horizontal scroll.
- Kanban columns: internal scroll works; headers stay visible when scrolling.
- Inbox and focus: Inbox interactions work; focus states visible for toolbar controls.
