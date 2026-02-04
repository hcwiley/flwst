# Firebase Server for FlowState

Firebase Functions and Hosting scaffold for the server-mediated API layer.

## Architecture

See `ARCH.md` for the data flow and planned integrations.


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
