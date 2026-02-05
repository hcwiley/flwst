# Firebase Server for FlowState

Firebase Functions and Hosting for the server-mediated API layer. Provides a
POST `/generate` endpoint that accepts a preprocessed transcript and resolved
prompts, calls Vertex AI Gemini, and returns a daily note plus task feed.

## Architecture

See `ARCH.md` for the data flow and integrations.

## API (Phase 6)

- **POST `/generate`** – Accepts `GenerateRequest` (runId, timestamp,
  preprocessedTranscript, resolvedPrompts.dailyNote / taskDraft, optional
  metadata). Validates with `@flwst/types` schemas, calls Gemini with the daily
  note prompt and transcript, parses fenced output blocks, and returns
  `GenerateResponse` (runId, timestamp, dailyNote, taskFeed, metadata including
  model and tokenUsage).

## Deploy

Deploy the functions and hosting:

```bash
cd servers/firebase
pnpm deploy
# or just functions:
pnpm deploy:functions
# or just hosting:
pnpm deploy:hosting
```

## Structure

```
servers/firebase/
├── functions/              # Firebase Functions source
│   └── src/
│       ├── index.ts       # Entry point: generate, helloWorld, generatePoem
│       ├── genkit-sample.ts  # Sample Genkit flow + callable export
│       ├── services/
│       │   ├── gemini.ts  # Vertex AI Gemini client and generateContent
│       │   └── parser.ts  # Parse [[DAILY_NOTE*]] / [[TASK_FEED*]] blocks
│       └── utils/
│           ├── logger.ts  # Request/response logging
│           └── validation.ts  # GenerateRequestSchema validation
├── firebase.json
├── .firebaserc.example    # Project ID template (copy to .firebaserc)
└── README.md
```

## Environment

- **GOOGLE_CLOUD_PROJECT** (or GCLOUD_PROJECT / FIREBASE_CONFIG) – Project ID.
- **GOOGLE_CLOUD_LOCATION** – Optional; defaults to `global`.
- **GOOGLE_GENAI_USE_VERTEXAI** – Set to `true` for Vertex AI (recommended).

Secrets and credentials live in Firebase environment/config, not in code.

## Status

- ✅ Project structure and TypeScript
- ✅ Generate endpoint (Phase 6): validation, Gemini, parser, response
- ✅ Genkit sample flow and callable
- ✅ Health check and CORS
- ⏳ Firebase Console and env setup (manual per project)

## Scripts

Run from `servers/firebase`:

- `pnpm build` – build Firebase Functions
- `pnpm typecheck` – type check Firebase Functions
- `pnpm lint` – lint Firebase Functions
- `pnpm deploy` – deploy Functions and Hosting
- `cd functions && npm run genkit:start` – Genkit dev UI (optional)

## Integration

The Electron app (or any client) can POST to the deployed function URL (e.g.
`https://your-project-id.web.app/generate`) with a validated `GenerateRequest`
body. Responses follow `GenerateResponse` from `@flwst/types`.
