# NEST Project — Agent Rules

## Dependency Philosophy

**Keep the application self-contained and deployable with minimal runtime dependencies.**

- Do **not** use external third-party services that are called at runtime from the browser (e.g., external QR code rendering APIs, CDN-hosted fonts loaded from `fonts.googleapis.com`, etc.). The app must be fully functional in air-gapped, self-hosted, or offline environments.
- When a capability requires a library, prefer a **single, well-maintained npm package** installed at build time over a runtime network call to an external service.
- Do not add npm packages gratuitously — evaluate whether the feature can be implemented with browser-native APIs (Canvas, Web Crypto, Blob URLs, etc.) before reaching for a package.
- **Example decision (2026-08-14):** QR code rendering for 2FA enrollment uses the `qrcode` npm package (renders to `<canvas>` locally), not an external image API like `api.qrserver.com`.
