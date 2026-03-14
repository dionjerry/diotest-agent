# DioTest Agents (Community Edition)

DioTest is a local-first AI testing assistant currently delivered as a Manifest V3 browser extension for GitHub PR/commit review workflows.

## Current MVP (Browser Extension)

What works today:

- PR/commit context extraction from GitHub pages.
- Deterministic fallback path: DOM extraction -> GitHub API deep scan -> explicit partial mode.
- AI-first test planning with deterministic + AI blended risk scoring.
- Structured outputs for risk areas, test plan, and manual test cases.
- Manual cases include explicit rationale (`why`) and evidence files, with strict anti-generic guardrails.
- Debug inspector with context coverage and risk-formula breakdown.
- Debug diagnostics include extraction source, analysis quality, dropped files, and normalization flags.
- Safe-mode and validated settings persisted in `chrome.storage.local`.

## Why DioTest

- Change-aware PR testing: recommendations are anchored to changed files and diffs.
- Explainable risk reasoning: deterministic scoring is blended with model output and exposed in Debug.
- Local-first trust posture: Community Edition runs extension-side with user-controlled keys/settings.

## Product Direction

- **Now:** Browser extension MVP for PR/commit testing intelligence.
- **Next:** IDE-focused Testing Agent workspace (code, risk, tests, and review context in one flow).
- **Later:** Optional cloud testing functions (hosted analysis jobs, org policies, and integration connectors).

## Stack

- React + TypeScript
- MV3 extension runtime (content script + service worker + side panel)
- Vitest + ESLint + TypeScript checks

## Scripts

- `pnpm dev` (or `npm run dev`)
- `pnpm build` (or `npm run build`)
- `pnpm test` (or `npm run test`)
- `pnpm lint` (or `npm run lint`)
- `pnpm typecheck` (or `npm run typecheck`)

## v0.1 Constraints

- Editable settings with hard ranges and validation
- Atomic settings save in `chrome.storage.local`
- Safe mode disables UI recording, API fallback, and telemetry
- Non-sensitive settings snapshot only in export metadata
- Export naming conventions:
  - `diotest_pr_<repo>_<pr>.json|md`
  - `diotest_ui_session_<domain>_<timestamp>.json|md`

## v0.1 Non-Goals

- No repo-wide scan
- No CI integration execution
- No Jira/Trello/Sheets integration
- No cloud storage/sync backend
- No auto test execution
- No autonomous UI crawling

## Learn More

- [Product Strategy](docs/PRODUCT_STRATEGY.md)
- [Market Fit](docs/MARKET_FIT.md)
- [MVP Spec](docs/MVP_SPEC.md)
- [Roadmap](docs/ROADMAP.md)
- [Non-Goals](docs/NON_GOALS.md)
- [Contributing](docs/CONTRIBUTING.md)

## UI Baseline

Current baseline screenshot notes are tracked in [docs/screenshots/README.md](docs/screenshots/README.md).
