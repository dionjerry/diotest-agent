# DioTest Agent v1.0 - MVP

PR intelligence plus local-first UI session intelligence for testing.

## What's Included

### Browser Extension

- GitHub PR and commit review from supported GitHub pages
- Deterministic fallback when page extraction is incomplete
- Structured outputs for:
  - risk areas
  - test plans
  - manual test cases
- UI session recorder for exploratory browser testing
- Sidepanel review flow with:
  - `Overview`
  - `Steps`
  - `Results`
- Manual test case and Playwright-oriented scenario generation from reviewed sessions
- Local persistence for settings, analysis sessions, and recorder sessions in `chrome.storage.local`

## Important MVP Boundaries

- Sessions and generated review history are stored locally in `chrome.storage.local`
- The extension sidepanel is the primary session review surface in this MVP
- No cloud sync backend is included in this release
- No web dashboard session library is included in this release

## Quick Start

### Install from the release zip

1. Download `diotest-extension-v1.0.zip` from the `v1.0` release assets
2. Extract the zip to a local folder
3. Open `chrome://extensions`
4. Enable Developer Mode
5. Click `Load unpacked`
6. Select the extracted extension folder

### Build from source instead

1. Clone the repo and install dependencies
2. Run `npm install`
3. Run `npm run build`
4. Open `chrome://extensions`
5. Enable Developer Mode
6. Load the unpacked extension from `apps/extension`

## Screenshots

Recommended screenshots for the public `v1.0` release page:

- Review tab
  - Shows the PR/commit analysis entrypoint with `Analyze PR / Commit`
  - Shows the `UI Recorder` section with `Start Recording`
- Sessions tab
  - Shows saved local analysis runs in the extension sidepanel

Add the screenshots directly to the GitHub release page so the release body visually matches the shipped extension UI.

## Known MVP Limitations

- Session storage is local-only in Community Edition
- The extension is optimized first for GitHub PR and commit workflows
- Cloud collaboration, sharing, and sync are not part of this release

## Best Fit

- Developers reviewing GitHub PRs and commits
- QA engineers turning exploratory browser sessions into reusable test artifacts
- Teams that want a local-first workflow before adopting any future hosted features
