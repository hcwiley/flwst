# React Native (Expo) App Initialization Commands

## Required: Run these commands manually

From the repo root, run:

```bash
cd apps/mobile
npx create-expo-app@latest . --template blank-typescript
```

Or if the directory already has some files:

```bash
cd apps/mobile
npx expo init . --template blank-typescript
```

When prompted:

- Confirm overwrite if needed (backup first if you have custom files)
- Choose TypeScript template

After initialization:

1. Verify `package.json` includes workspace dependencies
2. Update `app.json` or `app.config.js` as needed
3. Test with `pnpm dev`

## Notes

- Uses Expo SDK ~52.0.0
- ESM module system
- Phase 1: Stub only, minimal implementation
