# Firebase Server for FlowState

Firebase Functions and Hosting scaffold for the server-mediated API layer.

## Architecture

See `ARCH.md` for the data flow and planned integrations.

## Manual Setup Steps (Phase 0)

These steps must be completed manually in the Firebase Console:

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "Example Project")
4. Follow the setup wizard
5. Note your project ID

### 2. Enable Firebase Functions

1. In Firebase Console, go to "Functions"
2. Click "Get started" if prompted
3. Enable billing (required for Functions)
4. Note: Functions will be deployed from this directory

### 3. Enable Firebase Hosting

1. In Firebase Console, go to "Hosting"
2. Click "Get started"
3. Follow the initial setup (you can skip the initial deploy)

### 4. Set Environment Variables

1. In Firebase Console, go to "Functions" > "Configuration"
2. Add the following environment variables:
   - `GEMINI_API_KEY`: Your Gemini API key (from Google Cloud Console)
   - `FLOWSTATE_API_KEY`: API key for basic auth (generate a secure random
     string)

### 5. Configure Firebase CLI

1. Install Firebase CLI globally: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize (if not done): `firebase init functions` and
   `firebase init hosting`
4. Copy `.firebaserc.example` to `.firebaserc` and update with your project IDs

### 6. Deploy

After Phase 6 implementation:

```bash
cd servers/firebase
firebase deploy --only functions,hosting
```

## Structure

```
servers/firebase/
├── functions/          # Firebase Functions source
│   └── src/
│       ├── genkit-sample.ts # Sample Genkit flow + callable export
│       └── index.ts   # Functions entry point
├── hosting/            # Static hosting files (if needed)
├── firebase.json       # Firebase configuration
├── .firebaserc.example # Project ID template (copy to .firebaserc)
└── README.md           # This file
```

## Status

- ✅ Project structure scaffolded
- ✅ TypeScript configuration
- ✅ Placeholder function
- ⏳ Firebase Console setup (manual)
- ⏳ Environment variables (manual)
- ⏳ API implementation (Phase 6)

## Scripts

Run from `servers/firebase`:

- `pnpm build` - build Firebase Functions
- `pnpm typecheck` - type check Firebase Functions
- `pnpm lint` - lint Firebase Functions
- `pnpm deploy` - deploy Functions and Hosting
- `cd functions && npm run genkit:start` - start the Genkit dev UI

## Notes

- All credentials are stored in Firebase environment variables, not in code
- `.firebaserc` should not be committed (add to `.gitignore`)
- Functions use CommonJS module system
- API endpoint will be available at: `https://your-project-id.web.app/api/*`
