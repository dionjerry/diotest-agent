# DioTest Agent v1.0

## Summary

`v1.0` is the first public MVP release of the Community Edition on `main`.

This release is centered on two working extension-native workflows:

- GitHub PR and commit review
- local-first UI session recording with reviewed test artifact generation

It also includes the first repository onboarding platform surface for connecting GitHub or GitLab repositories and verifying the browser extension against a DioTest project.

## What v1.0 Actually Includes

### Browser extension

- GitHub PR and commit context extraction from supported GitHub pages
- deterministic fallback when extraction is incomplete
- structured analysis outputs for:
  - risk areas
  - test plans
  - manual test cases
- UI recorder for exploratory browser sessions
- recorder review flow in the sidepanel with:
  - `Overview`
  - `Steps`
  - `Results`
- artifact generation from reviewed sessions:
  - manual cases
  - Playwright-oriented scenario output
- local persistence for settings, analysis sessions, and recorder sessions in `chrome.storage.local`

### Web app

- authentication and onboarding flow
- organization and project setup
- third-party integration setup scaffolding
- GitHub and GitLab repository connection flow
- browser extension connection and verification flow
- settings and project surfaces for the current workspace

### Backend/API

- bootstrap and settings endpoints for the web app
- GitHub App install flow support
- GitLab OAuth support
- repository webhook provisioning during onboarding
- encrypted storage for app/provider secrets and project connection secrets

## What v1.0 Does Not Include

These were overstated or implied in the original release notes, but they are not shipped as completed product capabilities in this release:

- no cloud-backed session storage
- no web dashboard session library equivalent to the extension sidepanel review flow
- no hosted live session viewer in the web app
- no cloud session sync backend
- no fully mature webhook event processing pipeline yet
- no CI/CD execution pipeline ownership
- no collaboration or sharing layer for sessions

Recorded sessions are stored locally in browser storage for Community Edition.

## Release Notes You Can Publish

Use this text instead of the overstated release copy.

### DioTest Agent v1.0 - MVP

PR intelligence plus local-first UI session intelligence for testing.

#### Included in this release

- Browser extension for GitHub PR and commit review
- Local UI session recorder with reviewed test artifact generation
- Extension sidepanel review workspace for session cleanup and output generation
- Web onboarding for organizations, projects, integrations, repositories, and extension connection
- GitHub App and GitLab repository connection flow
- Automatic repository webhook provisioning during repository setup
- Encrypted storage for provider and project secrets

#### Important product boundaries

- Recorder sessions and generated review history are stored locally in `chrome.storage.local`
- The extension sidepanel is the primary session review surface in this MVP
- The web app currently focuses on onboarding, repository connection, extension connection, and settings
- Webhook provisioning is included, but downstream webhook event handling is still being hardened

#### Best fit for v1.0

- developers reviewing GitHub PRs and commits
- QA engineers turning exploratory browser sessions into reusable test artifacts
- teams that want a local-first workflow before adopting cloud collaboration features

## Recommended Installation Notes

### Extension

1. Clone the repo and install dependencies
2. Build the extension with `npm run build`
3. Open `chrome://extensions`
4. Enable Developer Mode
5. Load the unpacked extension from `apps/extension`

### Web platform

1. Configure `.env`
2. Start the API and web app
3. Complete onboarding
4. Connect the extension in Step 5

## Known MVP Limitations

- GitHub reauthorization and reconnect UX still has edge cases around expired install-session cookies
- repository webhook repair flows are still being polished
- ngrok/public-origin setup must be configured correctly for callback and webhook URLs
- session storage is local-only in Community Edition

## Source of Truth

For current shipped behavior, use these documents as primary references:

- [README.md](../README.md)
- [MVP Spec](./MVP_SPEC.md)
- [Non-Goals](./NON_GOALS.md)
- [Product Strategy](./PRODUCT_STRATEGY.md)
