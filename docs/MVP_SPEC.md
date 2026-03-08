# MVP Spec (Community Edition)

## Scope

DioTest v0.1 focuses on browser-extension workflow quality for GitHub PR/commit review.

Core capabilities:

- extract change context from PR/commit pages
- produce risk areas and blended risk score
- generate unit/integration/e2e suggestions
- generate manual test cases
- show debug inspector for traceability

## Output Artifacts

Primary output sections:

- Risk (score + risk areas + evidence)
- Test Plan (unit/integration/e2e)
- Manual Cases
- Debug (coverage, files sent, token estimate, risk formula)

Planned export modes (phased):

- Markdown (PR-comment ready)
- JSON (automation-friendly)

## Acceptance Criteria (MVP)

- Works on supported GitHub PR and commit URLs.
- Uses schema-constrained AI response shape.
- Applies deterministic + AI blended risk scoring.
- Avoids contradictory risk statements through post-processing guards.
- Preserves local settings and safe-mode behavior.

## Phase Progression

- **MVP (now):** browser extension with local-first analysis workflow.
- **Phase 2:** deeper profiles, richer exports, stronger workflow integration.
- **Phase 3:** IDE-focused Testing Agent workflow.
- **Phase 4:** optional cloud testing functions for teams/org workflows.

## Non-Goal Boundaries (v0.1)

- No repo-wide autonomous scanning/execution
- No CI orchestration/execution pipeline ownership
- No mandatory backend/cloud sync
- No autonomous UI crawling
