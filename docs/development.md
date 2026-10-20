# Development

## Requirements

Node.js >= 24, pnpm 11, Vite+ via local `pnpm exec vp`.

```sh
corepack enable
pnpm install
pnpm exec vp dev
pnpm exec vp check
pnpm exec vp test --run
pnpm exec vp build
```

The repository currently does not include a generated pnpm lockfile; generate it by installing dependencies on an online machine, review dependency versions, then commit the lockfile.

Main and Preload are built by `vite-plugin-electron/simple`; Renderer is built by Vite+. Sources live in `src/main`, `src/preload`, `src/renderer`, `src/shared`.

Runtime settings in `resources/app-config.json` are bundled into the installer. The app will run with update services disabled unless HTTPS URLs are configured.

```sh
pnpm run dist:dir
pnpm run dist:win
pnpm run dist:mac
pnpm run dist:linux
```

Use native OS machines or CI runners for platform packaging.

## Why no Monorepo?

Only one desktop application is required. Shared IPC types are plain TypeScript files; no separate packages or build orchestration are needed.

## Sandbox-safe Preload

Renderer windows use `sandbox: true`. Electron does not support ESM imports in sandboxed preload contexts, so `src/preload/index.ts` builds to bundled CommonJS `dist-electron/preload.cjs`. The main process remains ESM at `dist-electron/main.js`.

## Autostart behavior

Windows/macOS use Electron login item settings. Linux uses the XDG autostart desktop entry `~/.config/autostart/electron-starter.desktop` (or `XDG_CONFIG_HOME/autostart`). Linux autostart registration requires the packaged application; the development build deliberately refuses system-wide login setup.

## Current verified CI

The Linux Check workflow performs `vp check`, `vue-tsc --noEmit`, `vp test --run`, `vp build`, dev Electron runtime smoke, packaged Linux smoke, and signed HTTPS ZIP resource installation / activation / failure-rollback integration. The separate Cross-platform Package Check generates unsigned installer artifacts on native Windows, macOS and Linux GitHub runners. See links from the root README.

## P1 settings, downloads, and Deep Links

- The Electron settings file is automatically migrated to schema version 1; malformed values and invalid window sizes are reset to safe defaults.
- The Renderer caches locale in localStorage for the initial frame only; successful `electron-store` writes are required for changing the persisted language.
- Downloads are FIFO with one active task at a time; failed tasks can be retried via `download:retry`. Queued tasks can be cancelled independently. HTTPS endpoints are checked again after redirects, but DNS rebinding and all OS-specific network routing risks require additional security review before handling untrusted downloads.
- A Deep Link received before Vue registers listeners is buffered; `protocol:pending` drains it on app initialization.
- Renderer diagnostic messages redact common credential patterns; this is best-effort sanitization, not an authorization mechanism.
