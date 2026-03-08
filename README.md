# DioTest Agents (Community Edition)

DioTest is a Manifest V3 Chrome extension with two modes:

- PR Review Mode: GitHub pull request risk + test planning
- UI Review Recorder Mode: session capture to manual test cases

## Stack

- Vite + React + TypeScript
- Tailwind/shadcn-style component structure for side panel UI
- Vitest for tests

## Scripts

- `pnpm dev` (or `npm run dev`)
- `pnpm build` (or `npm run build`)
- `pnpm test` (or `npm run test`)
- `pnpm lint` (or `npm run lint`)

## Locked v0.1 Constraints

- Editable settings with hard ranges and validation
- Atomic settings save in `chrome.storage.local`
- Safe mode disables UI recording, API fallback, and telemetry
- Non-sensitive settings snapshot only in export metadata
- Export naming conventions:
  - `diotest_pr_<repo>_<pr>.json|md`
  - `diotest_ui_session_<domain>_<timestamp>.json|md`

## v0.1 Non-goals

- No repo-wide analysis
- No CI integration
- No Jira/Trello/Sheets integration
- No cloud sync backend
- No auto test execution
- No autonomous UI crawling
