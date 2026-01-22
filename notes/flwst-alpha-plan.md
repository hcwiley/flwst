# Diagrams

## App Flow

```mermaid
flowchart TB
  %% =========================
  %% App Entry
  %% =========================
  A[Launch Electron App] --> B{Connected to Notion?}

  %% =========================
  %% First-Time User Path
  %% =========================
  subgraph Onboarding["Onboarding Flow"]
    direction TB

    W0[Welcome Screen<br/>What FlowState is<br/>Preview of Inbox + Kanban] --> C[Choose To-Do System]
    C --> D{System Selected}

    D -- Notion --> N0[Pre-OAuth Explanation<br/>We will create:<br/>• Flow State page<br/>• Daily Notes DB<br/>• To-Dos DB<br/>Visual preview shown]

    D -- JIRA --> F[Request JIRA Integration CTA]
    F --> F1[Collect Input<br/>Use case, team size, urgency]
    F1 --> F2[Submit Feature Request]

    D -- Other --> G[Other System Input<br/>Freeform system name + notes]
    G --> G1[Submit Feature Request]
  end

  %% =========================
  %% Notion Authorization
  %% =========================
  subgraph NotionSetup["Notion Authorization and Setup"]
    direction TB

    N0 --> E[Notion OAuth]
    E --> H[Select Parent Notion Page]
    H --> I[Confirm Location<br/>Create Flow State here?]
    I --> J{User Confirms?}
    J -- No --> H
    J -- Yes --> K[Create Flow State Page]
    K --> L[Create Databases<br/>Daily Notes + To-Dos]
    L --> M[Store Tokens + IDs<br/>Encrypted Local Storage]
  end

  %% =========================
  %% LLM Infrastructure (Firebase + Gemini)
  %% =========================
  subgraph LLMInfra["LLM Call Path (Firebase)"]
    direction TB
    FB0[Firebase Hosting<br/>API base URL]
    FB1[Firebase Functions<br/>FlowState API Server<br/>Auth, rate limits, logging]
    GM1[Gemini API<br/>Model inference]
  end

  %% =========================
  %% Main Application
  %% =========================
  subgraph MainApp["Main Application UI"]
    direction TB

    M --> N[Main UI Loaded]

    N --> O[Side Menu]
    O --> P[Connections<br/>Notion status + DB links]
    O --> Q[Config<br/>Cleanup, Ignore List,<br/>Prompt Templates]
    Q --> R[Save Config<br/>Encrypted Local Storage]

    N --> S[Inbox Pane<br/>Drop transcript or file]
    S --> T[Ingest<br/>Name, timestamp, idempotent]
    T --> U[Cleanup Pass Optional<br/>Spelling, Dictionary, Ignore List]

    U --> V[Build API Request<br/>Resolved prompt + transcript]
    V --> FB0 --> FB1 --> GM1 --> FB1 --> V1[Receive Model Output]

    V1 --> V2[Validate Output<br/>Schema or template checks]
    V2 --> Y[Review Daily Note and Tasks<br/>View resolved prompts]

    Y --> AA[Publish to Notion]
    AA --> AB[Notion API Write]
    AB --> AC[Sync Refresh]
    AC --> AD[Kanban Pane<br/>Render Tasks + Columns]

    AD --> AE[Filter Row<br/>Column Toggles]
    AD --> AF[Sort<br/>Priority then Updated]
    AD --> AG[Task Card<br/>Title, Priority,<br/>View in Notion]
  end

  %% =========================
  %% Returning User Path
  %% =========================
  B -- Yes --> N
  B -- No --> W0

  %% =========================
  %% Telemetry
  %% =========================
  subgraph Telemetry["Telemetry"]
    direction TB
    T1[Amplitude<br/>Onboarding, Feature Requests,<br/>Run Status, Config Metadata]
    T2[Sentry<br/>Crashes + Unhandled Rejections]
  end

  W0 -.-> T1
  C -.-> T1
  F2 -.-> T1
  G1 -.-> T1
  V -.-> T1
  AA -.-> T1

  A -.-> T2
  N -.-> T2
  FB1 -.-> T2
```

## Data flow

```mermaid
flowchart TB
  %% FlowState (flwst) Alpha — Data Flow (Firebase + Gemini)

  %% Inputs
  subgraph Inputs
    direction TB
    IN1[Transcript File<br/>Dropped into Inbox]
    IN2[Audio File<br/>Future]
    CFG[User Config<br/>Prompts, Ignore List, Dictionary, Cleanup Toggle]
  end

  %% Local Persistence (Encrypted)
  subgraph LocalStore
    direction TB
    LS1[Tokens and IDs<br/>Notion OAuth token, Notion page and DB IDs]
    LS2[Config Store<br/>Prompt templates and settings]
    LS3[Artifacts<br/>Raw transcript, Clean transcript, Daily note, Task list, Logs]
  end

  %% UI
  subgraph UI
    direction TB
    UI1[Inbox Pane<br/>Inputs and run status]
    UI2[Config UI<br/>Edit prompts and settings]
    UI3[Review UI<br/>Preview and edit note and tasks<br/>View resolved prompts]
    UI4[Kanban Pane<br/>Render synced tasks]
  end

  %% Pipeline (Client)
  subgraph Pipeline
    direction TB
    P0[Ingest<br/>Normalize name and timestamp<br/>Idempotent run id]
    P1[Cleanup Pass<br/>Spell fix and dictionary<br/>Apply ignore list]
    P2[Resolve Prompts<br/>Merge templates with config vars]
    P3[API Request Build<br/>Package clean transcript + resolved prompts]
    P4[Client Validation<br/>Schema or template checks]
  end

  %% Firebase Server Layer
  subgraph Firebase
    direction TB
    FB0[Firebase Hosting<br/>API base URL]
    FB1[Firebase Functions<br/>FlowState API Server<br/>Auth, rate limits, request logging]
    FB2[Gemini API<br/>Model inference]
  end

  %% Notion
  subgraph NotionCloud
    direction TB
    N0[Notion OAuth]
    N1[Notion API Read<br/>Tasks and notes]
    N2[Notion API Write<br/>Create or update notes and tasks]
    N3[MCP Notion Tools<br/>AI search and overlap detection]
  end

  %% Telemetry
  subgraph Telemetry
    direction TB
    A1[Amplitude<br/>Funnel, feature requests, run metadata]
    S1[Sentry<br/>Crashes and errors, redacted]
  end

  %% Config edits
  UI2 --> LS2
  LS2 --> CFG

  %% Tokens
  N0 --> LS1

  %% Inputs to ingest
  IN1 --> UI1 --> P0
  IN2 -.-> UI1 -.-> P0

  %% Config used by pipeline
  CFG --> P1
  CFG --> P2

  %% Pipeline sequence
  P0 --> P1 --> P2 --> P3

  %% Persist artifacts locally
  P0 --> LS3
  P1 --> LS3
  P4 --> LS3

  %% App -> Firebase -> Gemini -> Firebase -> App
  P3 --> FB0 --> FB1 --> FB2 --> FB1 --> P4

  %% Review + publish
  P4 --> UI3
  UI3 --> N2 --> N1 --> UI4

  %% MCP (AI-only)
  UI3 -.-> N3

  %% Telemetry (metadata only)
  P0 -.-> A1
  P1 -.-> A1
  P3 -.-> A1
  P4 -.-> A1
  UI2 -.-> A1
  UI3 -.-> A1

  %% Crash tracking
  UI1 -.-> S1
  UI3 -.-> S1
  P0 -.-> S1
  P1 -.-> S1
  FB1 -.-> S1
```

# **Alpha Definition**

## **Goal**

Ship a reliable, dogfoodable alpha that replaces the current Cursor flow and can be used daily with minimal babysitting. Optimize for determinism, transparency, fast feedback, **and secure LLM access via a server-managed architecture**.

## **MVP Scope (Alpha) — Server & LLM Architecture**

### **LLM Access Model**

- Client applications **do not call an LLM provider directly**
- All LLM requests are routed through a **FlowState-managed API server**
- The server:
  - Owns and protects all LLM API keys
  - Handles basic auth, rate limiting, and request validation
  - Logs request metadata only (no raw transcripts or prompts by default)
  - Provides a stable contract between client apps and the LLM provider

### **Hosting & Infrastructure**

- **Firebase Hosting + Firebase Functions** used for:
  - FlowState API server endpoints
  - LLM request orchestration
  - Secure environment variable and secret management
- Firebase chosen to:
  - Avoid distributing secrets in client apps
  - Minimize operational overhead during alpha
  - Align with analytics, crash reporting, and future auth needs

### **LLM Provider**

- **Gemini (via Firebase)** is the default LLM provider for alpha
- Model choice is abstracted behind the server and is not client-coupled
- Client sends to server:
  - Cleaned transcript
  - Resolved prompt(s)
  - Minimal run metadata
- Server returns:
  - Structured Daily Note output
  - Structured Task List output

## **Core Workflow (Golden Path) — Updated**

1. **Ingest**
   - Transcript or file dropped into Inbox
   - Deterministic naming + timestamps
   - Idempotent run ID
2. **Cleanup Pass (Client-Side, Configurable)**
   - Second-pass transcript cleanup
   - Fix common mistranscriptions
   - Apply ignore / blacklist phrases
   - Produce clean_transcript
3. **LLM Generation (Server-Mediated)**
   - Client resolves prompts locally (after user config)
   - Client sends clean_transcript + resolved prompts to FlowState API server
   - Server forwards request to Gemini
   - Server returns model outputs
4. **Validation**
   - Client validates outputs against schemas/templates
   - Fail loudly on invalid output
5. **Review**
   - User can view/edit generated notes and tasks
   - User can view the exact resolved prompts used for generation
6. **Publish**
   - Write Daily Notes + Tasks to Notion databases

## **Security & Trust Guarantees (Alpha)**

- LLM API keys **never ship to client applications**
- All sensitive local data stored **encrypted at rest**:
  - OAuth tokens
  - Notion database and page IDs
  - Prompt edits
  - Config state
- Server-side logging is limited to:
  - Timing
  - Success/failure
  - Model identifiers
- Raw transcripts and prompts are **not persisted server-side by default**

## **Explicit Non-Goals (Alpha) — Server & Infra**

- Multi-tenant user auth beyond basic API protection
- User-level billing, quotas, or rate plans
- Multiple user-selectable LLM providers
- Fine-grained per-user server configuration

## **Definition of Done (Alpha)**

- Installable Electron app
- Deterministic, replayable pipeline
- Prompt transparency + editable config
- Server-mediated LLM access via Firebase + Gemini
- Notion sync working end-to-end
- Encrypted local storage for all sensitive data
- Analytics + crash reporting live
- Usable daily without manual intervention

# Development Plan

## **Phase 0 — Prerequisites and Human Setup (Manual)**

**Owner:** Human

**Goal:** Unblock development by setting up external services and credentials that cannot be automated.

- Create Firebase project
  - Enable Firebase Hosting
  - Enable Firebase Functions
  - Set up project environments (dev initially)
- Enable Gemini access via Firebase
- Create and store environment variables in Firebase
  - Gemini API credentials
  - Any server-side secrets
- Create Notion integration
  - Register Notion OAuth app
  - Capture client ID / secret
  - Define required scopes
- Decide initial Notion database schemas
  - Daily Notes properties
  - To-Dos properties (status, priority, timestamps)
- Create Sentry project
- Create Amplitude project
- Decide naming conventions for:
  - Flow State page
  - Databases
  - Status values
  - Priority scale

Deliverable:

- All credentials available
- Schemas decided
- Firebase project live

## **Phase 1 — Repo + Architecture Scaffolding**

**Owner:** Cursor

**Goal:** Establish the monorepo and shared foundations.

- Initialize monorepo structure
  - apps/electron
- apps/mobile (stub only)
  - types
  - libs/core
  - libs/ui
  - libs/integrations
  - config
- Set up TypeScript project references
- Add Zod and define:
  - Core data models
  - Config schema
  - Artifact schema
- Add Tamagui base configuration
- Add Zustand store scaffolding
- Add shared utilities for:
  - File paths
  - Run IDs
  - Logging
- Add placeholder README for repo structure

Deliverable:

- Buildable monorepo
- Shared types compiling
- No app logic yet

## **Phase 2 — Electron App Shell + Local Storage**

**Owner:** Cursor

**Goal:** Get a real app running with secure local persistence.

- Create Electron app shell
  - Window management
  - App lifecycle
- Implement encrypted local storage
  - App cache directory
  - Encryption helper utilities
- Store and retrieve:
  - OAuth tokens
  - Notion IDs
  - User config
- Add basic navigation layout
  - Main window
  - Side menu placeholder
- Integrate Sentry (Electron main + renderer)

Deliverable:

- Installable Electron app
- Encrypted local storage working
- Crash reporting live

## **Phase 3 — Onboarding Flow + Notion Setup**

**Owner:** Cursor

**Goal:** Complete first-run experience end-to-end.

- Welcome screen
  - Explain FlowState
  - Preview Inbox + Kanban
- System selection screen
  - Notion
  - JIRA (CTA only)
  - Other system freeform input
- JIRA / Other system
  - Feature request submission
  - Amplitude tracking
- Notion pre-OAuth explanation screen
  - Visual representation of pages/databases to be created
- Notion OAuth flow
- Parent page selection
- Confirmation screen before mutation
- Create Flow State page
- Create Daily Notes and To-Dos databases
- Persist Notion IDs securely
- Post-onboarding redirect to main UI

Deliverable:

- Clean first-run flow
- Notion setup without surprises
- Feature request data flowing

---

## **Phase 4 — Config System + Prompt Management**

**Owner:** Cursor

**Goal:** Make prompts and cleanup fully transparent and editable.

- Build Config UI
  - Cleanup toggle
  - Ignore list editor
  - User dictionary editor
- Prompt editors
  - Daily Note prompt
  - Task List prompt
  - Cleanup prompt
- Show resolved prompts
- Enforce prompt validation
  - Required placeholders
  - Non-empty constraints
- Save config edits to encrypted local storage
- Restore defaults functionality

Deliverable:

- Fully user-editable prompt pipeline
- Deterministic config behavior

---

## **Phase 5 — Inbox Pane + Client Pipeline**

**Owner:** Cursor

**Goal:** Process transcripts deterministically on the client.

- Build Pane component
  - Title bar
  - Collapse behavior
  - Configurable scroll behavior
- Inbox pane
  - File drop
  - Transcript ingest
- Ingest logic
  - Naming
  - Timestamps
  - Idempotent run IDs
- Cleanup pass
  - Apply ignore list
  - Apply dictionary fixes
- Artifact persistence
  - Raw transcript
  - Clean transcript
  - Logs

Deliverable:

- Reliable transcript ingestion
- Debuggable artifact trail

---

## **Phase 6 — Firebase API Server + Gemini Integration**

**Owner:** Cursor (code) + Human (deploy/secrets)

**Goal:** Secure, server-mediated LLM calls.

- Create Firebase Functions project
- Implement FlowState API endpoint
  - Accept transcript + resolved prompts
  - Validate payload
- Integrate Gemini API
- Return structured outputs
- Implement server-side logging
  - Timing
  - Success/failure
- Ensure no raw content persistence
- Deploy to Firebase Hosting
- Configure app to call server endpoint

Deliverable:

- App → Server → Gemini → App loop working
- No LLM keys in client

---

## **Phase 7 — Validation, Review, and Publish**

**Owner:** Cursor

**Goal:** Turn model output into trusted user-facing data.

- Client-side validation
  - Zod schema checks
- Review UI
  - Preview Daily Note
  - Preview Tasks
  - Edit before publish
- Show resolved prompts used
- Publish to Notion
  - Create/update Daily Notes
  - Create/update To-Dos
- Sync refresh after publish

Deliverable:

- Safe write path into Notion
- User trust preserved

---

## **Phase 8 — Kanban Pane + Sync**

**Owner:** Cursor

**Goal:** Make FlowState usable day-to-day.

- Build Kanban Pane
- Fetch tasks via Notion API
- Render columns
- Column visibility toggles
- Horizontal scroll
- Sorting
  - Priority
  - Last updated
- “View in Notion” links

Deliverable:

- Functional task board
- Clear picture of work state

---

## **Phase 9 — Analytics, Polish, and Alpha Hardening**

**Owner:** Cursor + Human

**Goal:** Make alpha usable by others.

- Integrate Amplitude
  - Onboarding funnel
  - Feature requests
  - Run success/failure
- Redact sensitive data
- Error state UX
- Empty state UX
- Build DMG installer
- Smoke test on clean machine
- Select 3–5 alpha users

Deliverable:

- Shippable alpha
- Feedback loop established
