# Market Fit

## Demand Signals (Snapshot)

- Browser testing extensions have sustained adoption.
- Generic PR-review extensions show weaker traction than testing tools.
- PR automation demand is proven, but often via bots/CI apps rather than browser UX.
- Playwright-centric E2E workflows remain strong in modern stacks.

## Interpretation

The strongest initial fit is a **testing-first PR assistant**:

- actionable test planning from real code changes
- structured outputs usable by QA/dev teams immediately
- low-friction extension workflow before heavier platform investments

## Competitive Positioning

DioTest is positioned against three categories:

1. Browser recorders/capture tools: high utility but usually not change-aware.
2. AI PR reviewers: broad review comments, weaker testing artifacts.
3. CI/bot reviewers: powerful but often heavier permissions/onboarding.

DioTest advantage: **PR diff to risk + test artifacts in one local-first extension flow**.

## Risks and Mitigations

- Trust risk for extensions:
  - Mitigation: minimal permissions, explicit privacy behavior, safe mode.
- DOM extraction fragility:
  - Mitigation: GitHub API fallback where applicable.
- AI inconsistency/hallucination:
  - Mitigation: schema-constrained outputs, deterministic scoring blend, post-processing guards.
- Scope creep:
  - Mitigation: strict MVP boundaries and phased roadmap.

## What Success Looks Like (Early)

- Strong install-to-first-analysis activation
- Repeated weekly analysis usage
- High export/hand-off usage for generated test outputs
- Reduced false-positive issue rate over successive iterations
