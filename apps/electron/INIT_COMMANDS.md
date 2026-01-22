# Electron App Initialization Commands

## Required: Run these commands manually

From the repo root, run:

```bash
cd apps/electron
npx electron-vite@latest init
```

When prompted:

- Choose a template (recommend: `vanilla` or `react`)
- Confirm the project structure

## Extra pnpm setup (required before running `electron-vite`)

1. From the repo root, install all workspaces so Electron becomes available:

```bash
pnpm install
```

2. pnpm may block Electron's build script; allow it manually:

```bash
pnpm approve-builds electron
```

Select the `electron` package (press `space` to toggle, then `enter`) and answer `y` when prompted to approve.

3. Reinstall to ensure `electron/package.json` lives under `apps/electron/node_modules`:

```bash
pnpm install
```

## Run the init

The generator that actually worked is `@quick-start/electron`. From the repo root:

```bash
pnpm create @quick-start/electron tmp/flwst-electron -- --template react-ts
```

When it finishes, copy the generated contents into `apps/electron`:

```bash
rm -rf apps/electron/*
cp -R tmp/flwst-electron/* apps/electron/
```

Then install and build the workspace so Electron/native dependencies land properly:

```bash
pnpm install
pnpm exec electron-vite init
```

## Post-init

After initialization, you may need to:

1. Update `electron-vite.config.ts` to resolve workspace dependencies
2. Ensure Vite's `optimizeDeps` includes `@flwst/*` packages if needed

## Notes

- Main process: CommonJS (can migrate to ESM later)
- Renderer: ESM via Vite
- Workspace dependencies: `@flwst/types`, `@flwst/core`, `@flwst/ui`, `@flwst/state`, `@flwst/integrations`
