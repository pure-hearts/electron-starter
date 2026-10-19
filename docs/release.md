# Build and release

```sh
pnpm exec vp build
pnpm run dist:dir
```

Tag pushes matching `v*` trigger GitHub Actions multi-platform packaging. Before public distribution configure:
- Windows code signing credentials
- macOS Developer ID signing and notarization
- HTTPS release/update server and artifact publishing
- `resources/app-config.json` URLs
- release ZIP public key and private CI key (if using ZIP hot updates)
- icon files in `resources/icons`

GitHub Actions workflows provided here are **starting points**. An unsigned CI artifact is not the same as a verified signed production installer. No release tag is pushed by this template setup.
