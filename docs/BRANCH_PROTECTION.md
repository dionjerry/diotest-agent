# Branch Protection Setup

Apply these settings in GitHub repository settings.

## Main branch (`main`)

- Require a pull request before merging: enabled
- Require approvals: 1+
- Require status checks to pass before merging: enabled
- Required checks:
  - `lint`
  - `typecheck`
  - `test`
  - `build`
- Require branches to be up to date before merging: enabled
- Restrict who can push to matching branches: enabled (maintainers only or nobody)
- Allow force pushes: disabled
- Allow deletions: disabled

## Develop branch (`develop`)

- Require a pull request before merging: enabled
- Require status checks to pass before merging: enabled
- Required checks:
  - `lint`
  - `typecheck`
  - `test`
  - `build`
- Require branches to be up to date before merging: enabled
- Allow force pushes: disabled
- Allow deletions: disabled

## Environments

Create two environments under `Settings > Environments`:

- `staging`
- `production`

Optionally add required reviewers for `production` deployments.
