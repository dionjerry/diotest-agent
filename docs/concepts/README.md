# DioTest Concepts

This section explains how DioTest works in product and technical terms.

Use these pages when you need to understand:

- what a user-facing onboarding step or setting means
- what DioTest stores when a user selects an option
- what behavior a setting affects
- what is optional, required, or skippable
- how DioTest uses connected providers, saved configuration, and workflow state
- how current logic works and which behaviors are intended to support future workflows

This section is intentionally separate from:

- [Environment Setup](../ENV_SETUP.md), which explains credentials, `.env` values, and local setup
- operational docs such as branch protection, governance, or contribution process

## How to Read These Pages

Each concepts page should follow the same pattern:

1. what the section is for
2. what the user sees in the UI
3. what it means in product terms
4. what it means technically inside DioTest
5. what DioTest stores
6. what behavior it affects
7. what happens if the section is skipped, changed, or revisited later
8. examples and edge cases when they help clarify behavior

This structure is meant to scale as DioTest grows. It should work for onboarding steps, settings pages, provider behaviors, and future algorithm or logic explainers.

## Current Pages

- [Repository Onboarding](./repository-onboarding.md)
- [Settings And Integrations](./settings-and-integrations.md)

## Planned Future Pages

The concepts layer is intended to expand over time to cover pages such as:

- onboarding stage semantics and persistence
- webhook health and reconciliation behavior
- repository-aware workflow concepts
- future logic or algorithm explainers where product behavior needs public documentation
