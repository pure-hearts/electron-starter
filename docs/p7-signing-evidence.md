# Signing and identity prerequisites

The signed release must fail if placeholder maintainer email or provisional appId remains. Genuine Windows signing, Apple Developer ID and notarization credentials must be supplied through protected GitHub Secrets. Evidence must include installed signature verification and Gatekeeper/SmartScreen checks. This change is a fail-closed safeguard, not evidence of actual signing.
