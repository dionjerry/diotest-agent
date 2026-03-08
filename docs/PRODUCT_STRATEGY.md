# Product Strategy

## Executive Summary

DioTest’s entry wedge is a testing-first PR intelligence extension, not a generic AI code reviewer. The current MVP focuses on high-signal change analysis and test planning where developers already work: GitHub PR/commit pages.

## Who It Serves First

Primary users:

- QA engineers (manual + automation)
- Developers responsible for regression safety
- Tech leads enforcing review quality and release readiness

Secondary users:

- Release coordinators needing consistent, human-readable test artifacts

## Core Pain Points

- PR-by-PR test planning is inconsistent and repetitive.
- Ticket-only AI test generation misses change-specific risks.
- Teams need faster test coverage decisions per code change.
- Extension trust requires minimal permissions and clear local-first behavior.

## Wedge Thesis

Best first product: **PR Test Planner + Test Case Generator** in a browser extension.

Why this wedge:

- Fastest adoption path (no infrastructure onboarding required)
- Clear incremental value in existing PR workflow
- Strong path to future IDE and cloud offerings

## Differentiation

Compared with generic AI PR reviewers, DioTest emphasizes:

- change-aware test planning over code commentary
- structured testing outputs (risk + tests + manual cases)
- transparent risk logic (deterministic + AI blend)
- local-first controls in Community Edition

## Long-Term Direction

- IDE-focused Testing Agent workflow for developers and QA
- Optional cloud testing functions for teams that need scale, policy, and integrations
