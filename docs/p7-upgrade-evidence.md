# P7 signed full installer upgrade E2E

Required: produce independently signed A/B installers, publish update metadata to a controlled feed, install A, persist settings, download B, upgrade, verify running version and data preservation, repeat on Windows/macOS with interrupted downloads, wrong signing identity and recovery. This branch adds update-state regressions only; full native installation remains unverified.
