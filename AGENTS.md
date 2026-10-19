# Rules for Codex

- This is a single-package application, **not** a monorepo.
- Keep the four source roots: `src/main`, `src/preload`, `src/renderer`, `src/shared`.
- Use Vite+ (`vp`) and the existing electron integration. Do not add extra build layers.
- Protect Electron's isolation, sandbox, CSP, sender validation and strict API exposure.
- Avoid broad Node/Electron APIs in the renderer; add typed methods in `src/shared/ipc.ts` instead.
- One system module per file. No dependency injection container, generic plugin platform or backend server.
- ZIP hot updates may replace *renderer assets only*, never main/preload/native dependencies.
- Keep private signing keys, certificates, and release credentials out of git.
- Do not claim CI/installers/auto-updates are verified without running them.
- Run build/check/tests when possible and document verified vs unverified work in `PLAN.md`.
- Do not create releases, tags, or modify unrelated repositories without authorization.
