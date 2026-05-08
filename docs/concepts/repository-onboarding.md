# Repository Onboarding

This page explains Step 4 of the DioTest web onboarding flow: connecting a source repository.

It is written for:

- users going through onboarding
- open-source contributors trying to understand the product
- future maintainers documenting related settings, logic, and workflow behavior

This page explains the repository step in two layers:

- plain-language meaning: what the user is doing and why it matters
- technical meaning: what DioTest stores and how that selection affects behavior

For credentials and local provider setup, see [Environment Setup](../ENV_SETUP.md).

## What This Step Is For

DioTest asks for a source repository so the project can be tied to a real codebase.

In plain language, this step tells DioTest:

- which provider owns the code
- which repository or project belongs to this DioTest project
- which branch should be treated as the baseline branch
- how DioTest should receive repository events from the provider

Technically, this step creates a repository connection record for the current DioTest project. That record becomes the canonical source for provider identity, repository metadata, baseline branch selection, and webhook status.

This step comes after organization, project, and integrations because DioTest first needs to know:

- which workspace owns the configuration
- which project the repository belongs to
- which external systems may later use repository-aware output

## What The Workflow Does

Step 4 is a short workflow:

1. choose a repository provider
2. authorize DioTest with that provider
3. choose the repository or project DioTest should track
4. choose the default branch DioTest should treat as the baseline
5. let DioTest provision or reconcile the provider webhook
6. save the connection or skip the step for now

The user sees one step. Technically, DioTest is collecting the minimum provider metadata it needs to identify the repository and receive provider events later.

## What The User Sees In The UI

The repository onboarding screen currently includes these main controls and concepts:

- `GitHub`
- `GitLab`
- `Connect GitHub App`
- `Connect GitLab`
- repository or project selection list
- selected repository state
- `Default branch`
- branch dropdown options
- `Automatic Webhook Configuration`
- GitLab project/group token field
- `Back`
- `Skip for now`
- `Continue to Step 5`

The rest of this page explains each of them.

## Provider Selection

### `GitHub`

Plain-language meaning:
- the project’s source code lives in GitHub, and DioTest should connect using the GitHub App flow

Technical meaning:
- DioTest stores the repository provider as `GITHUB`
- repository listing and branch loading will use the GitHub provider implementation
- webhook provisioning will use the GitHub provider path

What DioTest stores:
- provider type

What behavior it affects:
- the authorization flow
- the repository list source
- the webhook creation logic
- the saved repository connection type

Required or optional:
- required if the user wants to connect a repository during onboarding
- skippable only by skipping the whole repository step

### `GitLab`

Plain-language meaning:
- the project’s source code lives in GitLab, and DioTest should connect using GitLab OAuth plus a token for webhook management

Technical meaning:
- DioTest stores the repository provider as `GITLAB`
- repository listing and branch loading will use the GitLab provider implementation
- webhook provisioning will use the GitLab provider path

What DioTest stores:
- provider type

What behavior it affects:
- the authorization flow
- the project list source
- the webhook creation logic
- the need for a GitLab project/group token

Required or optional:
- required if the user wants to connect a repository during onboarding
- skippable only by skipping the whole repository step

## Provider Authorization Controls

### `Connect GitHub App`

Plain-language meaning:
- this starts the GitHub App installation or authorization flow so DioTest can access the repositories the app is allowed to manage

Technical meaning:
- DioTest redirects the user to the GitHub App installation flow
- after install or authorization, DioTest receives enough context to request installation-scoped access tokens
- those tokens are used to list repositories, read branch information, and create provider webhooks without using a personal access token

What DioTest stores:
- provider session state during the flow
- repository connection details after the user saves the selection
- installation-related metadata such as installation ID when available

What behavior it affects:
- whether DioTest can list GitHub repositories
- whether DioTest can create or reconcile a GitHub webhook

Required or optional:
- required for GitHub-based repository connection
- not relevant if the user chooses GitLab

Why GitHub does not need a personal access token here:
- the flow uses a GitHub App, not user-scoped PAT credentials
- the GitHub App can request installation-scoped access for repositories the user authorized
- this is narrower and more operationally controlled than asking every user for a PAT

### `Connect GitLab`

Plain-language meaning:
- this starts the GitLab authorization flow so DioTest can see the projects available to the user

Technical meaning:
- DioTest uses GitLab OAuth to identify the accessible GitLab account context
- DioTest still asks for a project/group token because GitLab webhook management is handled with token-based API access in this flow

What DioTest stores:
- provider session state during the flow
- repository connection details after the user saves the selection
- the GitLab token separately as encrypted secret material

What behavior it affects:
- whether DioTest can list GitLab projects
- whether DioTest can create or reconcile a GitLab webhook

Required or optional:
- required for GitLab-based repository connection
- not relevant if the user chooses GitHub

Why GitLab needs a project/group token:
- the DioTest GitLab flow does not rely only on OAuth identity
- DioTest needs a token with enough API access to manage project webhook configuration
- the token is stored as secret material, not as plain project configuration

## Repository Or Project Selection

### Repository or project list

Plain-language meaning:
- this list shows the codebase options DioTest can connect for the selected provider

Technical meaning:
- for GitHub, the list contains repositories visible to the GitHub App installation
- for GitLab, the list contains projects available through the authorized GitLab account context
- selecting one option determines the canonical repository identity for the current DioTest project

What DioTest stores:
- provider
- external ID
- owner
- namespace when applicable
- repository or project name
- full display name
- repository URL
- installation ID when applicable

What behavior it affects:
- which repository DioTest treats as the project’s source of truth
- which provider webhook target DioTest creates or reconciles
- which branch list DioTest loads

Required or optional:
- required if the step is being completed
- bypassed only if the step is skipped entirely

### Selected repository state

Plain-language meaning:
- this is the repository or project the user has currently chosen for the DioTest project

Technical meaning:
- the selected repository becomes the persisted repository connection once the user saves the step
- all later repository-aware behavior for this project resolves through this saved connection

What behavior it affects:
- displayed project source of truth
- branch selection source
- webhook destination
- future reconnect behavior in settings

## Default Branch

### `Default branch`

Plain-language meaning:
- this is the branch DioTest should treat as the main baseline branch for this connected project

Technical meaning:
- DioTest stores the selected branch as the `defaultBranch` on the repository connection
- DioTest does not change the provider’s own default branch setting
- this saved branch becomes DioTest’s baseline reference branch for repository-aware behavior

What DioTest stores:
- the selected branch name, such as `main` or `develop`

What behavior it affects:
- the branch DioTest treats as the default baseline for the project connection
- the default reference branch for current and future repository-aware workflows
- branch-dependent comparisons or sync logic where no more specific branch is provided

Required or optional:
- required if the repository step is completed

What this does not do:
- it does not rename any branch in GitHub or GitLab
- it does not force the provider to change its own repository default
- it only changes what DioTest stores as the project’s baseline branch

How to choose it:
- choose `main` if the repository’s stable or release baseline is `main`
- choose `develop` if your team merges and validates work primarily against `develop`

Examples:
- if pull requests are merged into `main` and releases are cut from `main`, choose `main`
- if pull requests are merged into `develop` first and `main` is only updated later for releases, choose `develop`

### Branch dropdown options

Plain-language meaning:
- these are the branches DioTest found on the selected repository or project

Technical meaning:
- DioTest loads live branch data from the provider for the selected repository when possible
- if branch loading fails, DioTest falls back to the repository’s existing default branch so the user can still continue

What behavior it affects:
- which branch can be saved as the DioTest baseline branch

## Automatic Webhook Configuration

### `Automatic Webhook Configuration`

Plain-language meaning:
- DioTest will try to set up the provider webhook for the selected repository automatically instead of asking the user to create it manually

Technical meaning:
- after the repository connection is saved, DioTest reconciles the provider webhook configuration for that repository
- for GitHub, DioTest uses two webhook layers:
  - a static GitHub App webhook URL configured once at the app level
  - a per-project repository webhook URL created during Step 4
- DioTest stores webhook health information on the repository connection, including current status and last known error when available

What DioTest stores:
- webhook status
- webhook last error when applicable
- provider-specific webhook metadata when available through the connection flow

What behavior it affects:
- whether repository events can be delivered back to DioTest automatically
- whether future repository-aware workflows can react to provider-side changes without manual refresh

Required or optional:
- part of the repository connection flow when the user completes the step
- not something the user toggles off in the current onboarding UI

What webhook provisioning means:
- a webhook is a provider-to-DioTest notification channel
- when repository events happen, the provider sends event payloads to DioTest
- DioTest can use those events to keep repository state and future workflows synchronized

### App-level webhook URL vs per-project webhook URL

For GitHub, these are different things.

App-level webhook URL:
- configured once in the GitHub App settings
- static for the whole GitHub App
- example:
  - `/api/repositories/webhooks/github`
- used as a generic app-level receiver or compatibility endpoint

Per-project repository webhook URL:
- created automatically when Step 4 saves the repository connection
- unique to one DioTest project
- example:
  - `/{orgSlug}/{projectId}/webhooks/github`
- used to give DioTest direct project context in the webhook URL itself

Why the split exists:
- GitHub App settings only allow one global webhook URL
- DioTest projects need project-specific context for repository events
- Step 4 solves that by creating repository-specific webhooks with a URL that includes the organization slug and project ID

What the user should do:
- configure the GitHub App settings with the static app-level webhook URL
- let DioTest create the per-project repository webhook automatically during Step 4
- reconnect or resave the repository step for older connections if the repository webhook URL format changed

What webhook health or status means:
- webhook health describes whether DioTest believes the provider webhook is configured correctly
- a healthy status means the provider webhook was created or reconciled successfully
- a warning or failed status means DioTest could not finish configuration or later detected a problem

## GitLab Token Field

### GitLab project/group token

Plain-language meaning:
- this is the extra token DioTest needs in the GitLab flow to manage the repository webhook

Technical meaning:
- DioTest stores this token as secret configuration rather than plain project metadata
- it is used for GitLab API operations that require project or group token access during webhook provisioning and management

What DioTest stores:
- encrypted secret material for the GitLab provider connection

What behavior it affects:
- whether DioTest can create or maintain the GitLab webhook automatically

Required or optional:
- required for a full GitLab repository connection in the current flow
- not used in the GitHub flow

## Navigation And Step Controls

### `Back`

Plain-language meaning:
- return to the previous onboarding step

Technical meaning:
- this is navigation only
- it does not clear the existing repository connection unless the user explicitly changes or removes it later

Required or optional:
- optional navigation control

### `Skip for now`

Plain-language meaning:
- do not finish repository connection during onboarding right now

Technical meaning:
- DioTest marks this optional onboarding step as skipped instead of completed
- the project can continue through onboarding without a saved repository connection
- the user can return later from onboarding or settings to complete or reconnect the repository step

What behavior it affects:
- the project will not yet have a persisted repository connection
- repository-aware features that depend on a saved repository connection will remain unavailable or incomplete until the connection is added later

Required or optional:
- optional
- this is the explicit bypass for the repository step

### `Continue to Step 5`

Plain-language meaning:
- save the repository step and move to the extension step

Technical meaning:
- DioTest persists the selected repository connection and associated baseline branch
- DioTest advances the onboarding flow to the next stage
- webhook reconciliation is included in the repository connection behavior the step is designed to support

Required or optional:
- only relevant if the user chooses to complete this step instead of skipping it

## Technical Concepts Behind This Step

### Provider selection

This determines which repository provider implementation DioTest uses for:

- authentication or authorization flow
- repository listing
- branch loading
- webhook reconciliation

### Repository identity

The connected repository is not just a label. DioTest stores stable provider-level identifiers so the project stays tied to the correct external codebase even if display names change later.

### External ID

The external ID is the provider’s unique identifier for the repository or project.

Why it matters:
- names can change
- URLs can change
- the external ID is the safest canonical reference when syncing with the provider later

### Owner / namespace

These fields describe where the repository lives inside the provider.

Examples:
- GitHub owner: user or organization account
- GitLab namespace: group or nested project path

Why they matter:
- they help DioTest reconstruct repository identity and API paths
- they improve clarity when multiple repositories have similar names

### Repository URL

This is the human-facing provider URL for the connected repository or project.

Why DioTest stores it:
- display and diagnostics
- settings pages and future navigation affordances
- human-readable confirmation of the selected source repository

### Installation or app authorization

For GitHub, DioTest uses GitHub App installation authorization instead of asking the user for a PAT.

Why it matters:
- access is tied to the app installation scope
- repository access can be limited to the selected installation context
- DioTest can request installation access tokens when it needs to interact with the provider

### OAuth vs GitHub App flow

GitHub and GitLab use different models in DioTest:

- GitHub: GitHub App installation flow with installation-scoped access, no PAT required in the onboarding UI
- GitLab: OAuth for account/project visibility plus a project/group token for webhook management

The difference is a provider design difference, not just a DioTest UI choice.

## What DioTest Uses This Information For

After the repository step is saved, DioTest can use the connection for several concrete purposes.

Used now:
- identify which repository belongs to the DioTest project
- store the project’s baseline branch
- track webhook status for the connection
- support repository reconnect and settings-based edits later
- create or reconcile a per-project repository webhook during Step 4

Used as a baseline for future repository-aware workflows:
- repository-aware analysis that needs a canonical source repository
- branch-aware comparisons where the project needs a default reference branch
- Studio workflows intended to operate against a known connected codebase

Intended to support:
- broader cloud-backed or shared project workflows where repository identity and provider events need to stay synchronized over time

This page is intentionally conservative. It explains what the current repository connection means without promising features that are not yet implemented.

## Skip, Resume, And Later Reconnection

The repository step is optional during onboarding.

If the user clicks `Skip for now`:
- onboarding can continue
- DioTest does not save a repository connection for the project yet
- repository-aware behavior remains incomplete until the project is connected later

If the user completes the step:
- the repository connection becomes part of the project’s saved configuration
- the user can return later from settings or onboarding re-entry flows to reconnect or change it

If onboarding is left incomplete:
- DioTest can resume the user at the earliest incomplete onboarding step, including the repository step when it has not been completed or explicitly skipped

## Practical Examples

### Example 1: GitHub project using `main`

A team merges pull requests directly into `main`.

Recommended choice:
- provider: `GitHub`
- default branch: `main`

Meaning:
- DioTest treats `main` as the project’s baseline branch
- the GitHub App handles repository access and webhook setup

### Example 2: GitHub project using `develop`

A team merges feature work into `develop` and only promotes to `main` later.

Recommended choice:
- provider: `GitHub`
- default branch: `develop`

Meaning:
- DioTest stores `develop` as the baseline branch for this project
- DioTest does not change GitHub’s own repository settings
- it only changes DioTest’s default reference branch for this project connection

### Example 3: GitLab project with token-based webhook management

A team uses GitLab and wants DioTest to manage webhooks automatically.

Recommended choice:
- provider: `GitLab`
- supply a valid GitLab project/group token
- choose the real team baseline branch

Meaning:
- GitLab OAuth identifies the account context
- the token supports webhook provisioning and maintenance

### Example 4: User skips repository setup

A user wants to finish onboarding quickly and return later.

Result:
- the user can continue onboarding
- DioTest does not yet know which repository belongs to the project
- the repository connection can be added later from onboarding or settings
