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

## Maintainer and protocol registration

The `package.json` author email `replace-before-release@example.com` is an illustrative placeholder needed for deb packaging. Replace it with your own maintainer email before public release. The installer registers `electron-starter://` via the `electron-builder.yml` protocols field. If you rename your app, update the scheme in both Builder config and `src/main/modules/protocol.ts`.

## Built-in GitHub updater

`electron-builder.yml` publishes update metadata for `pure-hearts/electron-starter`. A `vX.Y.Z` tag (matching `package.json.version`) triggers the Release workflow, which uploads the generated installers, update metadata and block maps. Stable tags create stable releases; hyphenated prerelease tags are marked prerelease. Do not push a release tag without passing checks and verifying required code-signing credentials. `resources/app-config.json` may override the updater with a custom HTTPS feed.

## Production signing gate

`.github/workflows/release.yml` requires the exact version tag and these configured repository secrets before publishing: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. The signing certificate values accepted by electron-builder may be file URLs or base64-encoded P12 content as documented by electron-builder. CI package checks still build **unsigned** artifacts for development. Stable public releases are blocked until signing and macOS notarization are configured and verified. The release workflow never pushes a tag itself.
