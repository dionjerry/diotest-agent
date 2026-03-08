# Security

- Secrets (API keys/tokens) are handled by background worker only.
- Content scripts do not read stored secrets.
- Safe Mode disables UI recording, GitHub API fallback, and telemetry.
