# DioTest Agents (Community Edition)

DioTest is a local-first AI testing assistant delivered as a Manifest V3 browser extension. It now supports two complementary workflows in one sidepanel:

- change-aware PR and commit review for GitHub
- exploratory UI recording that turns browser sessions into reviewed manual cases and automation-ready scenarios

## What DioTest Does Today

### PR and commit review
- Extracts GitHub PR and commit context directly from the page.
- Falls back deterministically when extraction is incomplete: DOM extraction -> GitHub API deep scan -> explicit partial mode.
- Produces structured outputs for risk areas, test plan, and manual test cases.
- Blends deterministic and AI reasoning, with debug visibility into evidence quality and scoring.

### UI recorder and review flow
- Records browser interactions into local recorder sessions.
- Normalizes noisy event streams into a cleaner reviewed timeline.
- Provides a dedicated recorder review workspace with `Overview`, `Steps`, and `Results` tabs.
- Lets you keep or remove reviewed steps before generating outputs.
- Generates both manual test cases and a Playwright-oriented scenario from the same reviewed session.

### Smarter recorder generation
- Uses reviewed kept steps as the primary evidence source.
- Optionally analyzes screenshot pixels during generation.
- Optionally includes lightweight page summaries captured from visited pages.
- Derives both:
  - flow-derived cases from the path the user actually took
  - page-derived cases from visible UI opportunities on visited pages
- Keeps the Playwright scenario focused on the main recorded flow instead of turning it into a catch-all list.

## Why DioTest

- Exploratory testing becomes reusable test knowledge instead of being lost after a session.
- One recording can produce reviewed manual cases and automation-ready scenarios.
- Page visits contribute additional test opportunity discovery beyond exact clicks.
- The workflow stays local-first and extension-native, with user-controlled settings and keys.
- Debug output remains explainable instead of hiding why a result was produced.

## Recorder Review Flow

1. Record a browser session.
2. Open the saved session in the sidepanel.
3. Review the normalized step timeline and remove noise if needed.
4. Inspect session context in `Overview`.
5. Generate outputs from the curated session in `Results`.
6. Optionally enable:
   - `Analyze screenshots`
   - `Include page summaries`

Generated outputs can include:
- `3-6` manual test cases
- a Playwright scenario focused on the primary recorded path
- a mix of `flow-derived` and `page-derived` manual cases when the visited pages expose distinct UI opportunities

## Current MVP Scope

What works today:

- PR/commit context extraction from GitHub pages.
- Deterministic fallback path: DOM extraction -> GitHub API deep scan -> explicit partial mode.
- AI-first test planning with deterministic + AI blended risk scoring.
- Structured outputs for risk areas, test plan, and manual test cases.
- Recorder session capture with local persistence in `chrome.storage.local`.
- Recorder step cleanup for repeated scrolls, incremental typing noise, and weak labels.
- Recorder result generation with reviewed steps, page transitions, screenshots, and lightweight page summaries.
- Recorder generation states in the UI, including save/generate in-flight feedback and duplicate-click protection.
- Debug diagnostics including extraction source, analysis quality, dropped files, and normalization flags.
- Safe-mode and validated settings persisted in `chrome.storage.local`.

## Product Direction

- **Now:** Browser extension for PR review plus exploratory UI session-to-test generation.
- **Next:** Cloud-backed DioTest platform with extension cloud mode, shared engine APIs, MCP support, and a web dashboard.
- **Later:** Hosted and self-hosted deployment options, organization policies, background jobs, and IDE-focused workflows.

## Stack

- React + TypeScript
- MV3 extension runtime (content script + service worker + side panel)
- OpenAI-backed structured generation with text and optional multimodal recorder inputs
- Vitest + ESLint + TypeScript checks
- `pnpm` workspace layout with shared packages for future SaaS, MCP, and web surfaces

## Workspace Layout

```text
packages/
  domain/
  engine/
  providers/
  renderers/
apps/
  extension/
  api/
  web/
  mcp-server/
```

The Chrome extension now lives under [`apps/extension`](apps/extension). Shared logic is extracted into `packages/*` so the same engine can later power the hosted cloud product, self-hosted deployments, MCP tools, and a web dashboard.

## Install The Extension

### Unpacked extension for development

1. Install dependencies:
   - `pnpm install`
   - or `npm install`
2. Build the extension:
   - `pnpm build`
   - or `npm run build`
3. Open `chrome://extensions`
4. Enable `Developer mode`
5. Click `Load unpacked`
6. Select [`apps/extension`](apps/extension)

Chrome will load the built manifest from [`apps/extension/manifest.json`](apps/extension/manifest.json).

### Packed extension

For internal distribution, you can also package the built contents of [`apps/extension`](apps/extension):

1. Build the extension
2. Open `chrome://extensions`
3. Click `Pack extension`
4. Choose [`apps/extension`](apps/extension) as the extension root

Notes:
- A packed `.crx` is reasonable for internal testing and controlled distribution.
- Public Chrome Web Store distribution is the cleaner path for broader release.
- The repo is set up first for unpacked development loading.

## Scripts

- `pnpm dev` or `npm run dev`
- `pnpm build` or `npm run build`
- `pnpm test` or `npm run test`
- `pnpm lint` or `npm run lint`
- `pnpm typecheck` or `npm run typecheck`

## v0.1 Constraints

- Editable settings with hard ranges and validation
- Atomic settings save in `chrome.storage.local`
- Safe mode disables recorder capture, API fallback, and telemetry-sensitive flows
- Non-sensitive settings snapshot only in export metadata
- Export naming conventions:
  - `diotest_pr_<repo>_<pr>.json|md`
  - `diotest_ui_session_<domain>_<timestamp>.json|md`

## v0.1 Non-Goals

- No repo-wide scan
- No CI integration execution
- No Jira/Trello/Sheets integration
- No cloud storage or sync backend
- No autonomous full-site crawling beyond pages the user actually visited
- No autonomous test execution

## Planned Next Features

Near-term platform work after the MVP extension:

- Extension cloud mode in addition to local mode
- Shared API surface on top of `@diotest/engine`
- MCP server for agent and IDE workflows
- Web dashboard for sessions, outputs, and team usage
- Hosted DioTest cloud deployment
- Self-hosted deployment path for teams that need local control
- Additional provider support such as Anthropic

## Learn More

- [Product Strategy](docs/PRODUCT_STRATEGY.md)
- [Market Fit](docs/MARKET_FIT.md)
- [MVP Spec](docs/MVP_SPEC.md)
- [Roadmap](docs/ROADMAP.md)
- [Non-Goals](docs/NON_GOALS.md)
- [Contributing](docs/CONTRIBUTING.md)

## UI Baseline

Current baseline screenshot notes are tracked in [docs/screenshots/README.md](docs/screenshots/README.md).
