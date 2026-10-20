# Update configuration and safety

## Full installer updates

Full-package updates use **GitHub Releases** by default. `electron-builder.yml` configures the `pure-hearts/electron-starter` provider, and a tagged release workflow uploads the updater metadata together with the installable assets. To use your own HTTPS feed instead, set `appUpdateUrl` in `resources/app-config.json`; it overrides the built-in GitHub feed.

The repository must have a **stable, signed GitHub Release** containing a higher version before a client can find an update. Test updates from a previous installed version using actual signing credentials. Do not rely on unsigned pre-release artifacts for production.

## Renderer-only ZIP updates

A ZIP update contains only `dist/renderer` assets. Main, Preload, Electron and native dependencies can only change via a full installer update.

1. Generate an Ed25519 signing key outside the repository. Keep the private PEM offline or in a protected CI secret.
2. Copy its **public** PEM to `resources/hot-update-public-key.pem` before building the installer.
3. Set `hotUpdateUrl` in `resources/app-config.json` to an HTTPS URL for `manifest.json`.
4. Build assets: `pnpm exec vp build`.
5. Run `HOT_UPDATE_PRIVATE_KEY_PEM_PATH=/secure/private.pem HOT_UPDATE_REVISION=1 HOT_UPDATE_ASSET_BASE_URL=https://your-cdn/updates pnpm run hot:pack`.
6. Publish `release/hot/manifest.json` and its ZIP to the specified HTTPS host. Increasing integer revision publishes the next update.
7. The client checks manifest signature and app version compatibility, checks ZIP hash, extracts under userData and activates the update on the next app startup.

Updates are disabled without an installed public key and configured HTTPS URL. Testing must cover interruption, ZIP attacks, signature failure, disk full, startup failure and rollback before production use.

The public key is allowed in the installed app, but the private signing key must never be committed or included in a release.

## Known limitations

- Generic electron-updater behavior varies by package platform.
- No differential patching: the hot update ZIP contains the entire renderer asset build.
- The hot updater code has not been exercised on packaged apps yet.
