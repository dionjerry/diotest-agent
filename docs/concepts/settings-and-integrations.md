# Settings And Integrations

This page explains the user-facing settings and integration concepts that appear across DioTest onboarding, project settings, and the browser extension.

It is written for:

- users who need to understand what each setting means before saving it
- open-source contributors who want to understand the product semantics behind the UI
- future maintainers who will document additional settings, connection states, and workflow logic

This page explains settings in two layers:

- plain-language meaning: what the user is configuring and why it matters
- technical meaning: what DioTest stores, how secrets differ from config, and what behavior the setting changes

For credentials and local setup, see [Environment Setup](../ENV_SETUP.md).
For repository onboarding concepts, see [Repository Onboarding](./repository-onboarding.md).

## What This Area Is For

DioTest uses settings and integrations to connect a project to the systems around it.

In plain language, these controls answer questions like:

- which external tools should receive DioTest output
- which AI provider should DioTest use
- which credentials are secrets and which values are normal configuration
- whether the browser extension is merely installed or actually connected to a specific DioTest project

Technically, these settings are split across:

- plain configuration stored in project or organization settings
- encrypted secrets stored separately
- connection health or status values that describe whether a provider or extension is actually working

## What The User Sees

These concepts currently appear in three main places:

- onboarding Step 3: integrations
- onboarding Step 5: extension connection
- project settings and extension settings panels

The rest of this page explains the main groups.

## Web App Integrations

### What integrations are for

Integrations let DioTest push results or operational output into tools the team already uses.

Current onboarding integrations:

- Jira
- Trello
- Google Sheets

Each integration has two kinds of values:

- config values: normal identifiers and behavior choices such as base URL, project key, board ID, or sheet name
- secret values: credentials such as API tokens, service account JSON, or provider keys

This separation matters because DioTest treats them differently.

### Saved config vs saved secret

Plain-language meaning:
- config is normal setup data that identifies where output should go
- secret is credential data that proves DioTest is allowed to send that output

Technical meaning:
- config is stored on the integration connection as JSON
- secret material is stored encrypted and retrieved only when DioTest needs to talk to the provider

What DioTest stores:
- config in integration connection records
- secret material in encrypted secret storage

What behavior it affects:
- config decides the destination or behavior
- secret decides whether DioTest can authenticate to the provider at all

What “stored encrypted and never logged” means:
- DioTest encrypts secret payloads before writing them to the database
- DioTest should not write the raw secret value to logs or UI previews
- stored credentials may be represented later by previews or placeholders, not the original raw value

### Jira

What the user sees:
- Jira base URL
- project key
- issue type
- account email
- API token
- test connection

Plain-language meaning:
- this tells DioTest which Jira site and project should receive testing output

Technical meaning:
- base URL, project key, and issue type are saved as config
- email and API token are treated as secret credentials
- test connection verifies that DioTest can reach Jira and authenticate with the supplied values

What behavior it affects:
- where DioTest creates or updates Jira work items
- whether sample verification can succeed

Required vs optional:
- base URL, project key, email, and API token are required for a real Jira connection
- issue type is optional in the sense that it can default, but it still changes provider behavior if supplied

### Trello

What the user sees:
- board ID
- default list ID
- API key
- token
- test connection

Plain-language meaning:
- this tells DioTest which Trello board should receive test-related cards

Technical meaning:
- board ID and default list ID are config values
- API key and token are secret credentials
- test connection verifies that DioTest can access the board and optionally create a sample record

What behavior it affects:
- which board DioTest targets
- which list or column cards should go into when a list is provided

Required vs optional:
- board ID, API key, and token are required
- default list ID is optional and only affects where new cards are created

### Google Sheets

What the user sees:
- spreadsheet ID
- sheet name
- service account JSON
- test connection

Plain-language meaning:
- this tells DioTest which spreadsheet should receive exported rows or logs

Technical meaning:
- spreadsheet ID and sheet name are config values
- service account JSON is a secret credential blob
- test connection verifies that DioTest can authenticate and write to the target sheet

What behavior it affects:
- which spreadsheet DioTest writes to
- which tab inside that spreadsheet receives rows

Required vs optional:
- all three values are required for a working connection

### Test connection behavior

Plain-language meaning:
- test connection checks whether DioTest can actually use the values the user entered

Technical meaning:
- DioTest makes a live provider request using the current config and secret values
- success means the provider accepted the request
- failure means the values are incomplete, invalid, or the provider could not be reached

What it does not mean:
- it does not automatically save every value forever
- it does not guarantee a provider will never fail later
- it only verifies that the current configuration works at test time

## Web App Settings Meanings

### AI provider selection

What the user sees:
- preferred provider such as OpenAI or OpenRouter

Plain-language meaning:
- this chooses which AI service DioTest should use for analysis and generation workflows

Technical meaning:
- DioTest stores a provider preference as normal settings metadata
- provider secrets are stored separately from the preference itself

What behavior it affects:
- which provider adapter DioTest will call
- which API key is required
- which models are valid for that provider

### Model selection

Plain-language meaning:
- this chooses the model DioTest should use within the selected provider

Technical meaning:
- the model name is stored as configuration
- it does not contain secret material

What behavior it affects:
- output quality, latency, and cost characteristics
- provider compatibility for analysis workflows

### OpenAI API key and similar provider secrets

Plain-language meaning:
- this is the credential DioTest uses to talk to the selected AI provider

Technical meaning:
- the API key is stored as encrypted secret material, not as plain settings metadata

What behavior it affects:
- whether DioTest can run provider-backed AI workflows at all

### OAuth settings

Plain-language meaning:
- these settings define how users can sign into the DioTest web app

Technical meaning:
- OAuth credentials belong to application setup and auth configuration, not to a project-level testing workflow itself

What behavior it affects:
- whether sign-in providers such as Google are available to end users

### Repository and webhook status in settings

Plain-language meaning:
- settings surfaces may show whether a repository is connected and whether webhook setup is healthy

Technical meaning:
- DioTest stores repository connection metadata and webhook status separately from integration settings
- these values represent connection health, not user preference

What behavior it affects:
- whether repository-aware workflows can rely on incoming provider events
- whether reconnect or recovery is needed

### How onboarding values relate to later settings

Plain-language meaning:
- onboarding is the first time a user provides values, but settings are where those values can be reviewed or changed later

Technical meaning:
- onboarding creates the initial saved state
- settings pages act as the long-term management surface for that state

What behavior it affects:
- a project can be partially configured during onboarding and refined later in settings
- saved configuration persists beyond the onboarding flow itself

## Extension Settings And Step 5 Connection

### What Step 5 is checking

Step 5 does not only ask whether the extension exists. It checks two different things:

1. whether the extension is installed and running on the page
2. whether the extension has successfully connected to this DioTest project

This is a two-phase model because extension presence alone is not enough. DioTest needs proof that the extension can call back into the correct web app with the correct project key.

### Extension installed vs extension connected

Plain-language meaning:
- installed means the browser has the DioTest extension and it can announce itself to the page
- connected means the extension has successfully authenticated to this DioTest project using the onboarding API key

Technical meaning:
- installed is detected via a page-level event from the content script bridge
- connected is confirmed only after the extension successfully posts its API key to the DioTest app and the app records a connection timestamp for the project

What behavior it affects:
- installed changes the Step 5 badge from waiting to detected
- connected enables the Step 5 Continue action and proves the extension is linked to the project

### DioTest Connection section in the extension

What the user sees:
- API Base URL
- API Key
- Test Connection

Plain-language meaning:
- these fields tell the extension which DioTest app it should call and which project-scoped key it should use

Technical meaning:
- the extension stores these values in local extension settings
- they are not stored in the web app through the extension settings form itself
- the extension later uses them to call the web app ping route
- the connection test is sent through the extension background worker, not directly from the settings component

### API Base URL

Plain-language meaning:
- this is the web app origin the extension should talk to

Technical meaning:
- the extension uses this as the base for requests such as `POST /api/extension/ping`
- it must point at the same DioTest app the user is onboarding against

What behavior it affects:
- whether the extension can reach the correct app
- whether the connection test reaches the intended project environment

If changed later:
- the extension may appear installed on one page while actually pinging a different DioTest deployment if the URL is wrong

### API Key

Plain-language meaning:
- this is the project-scoped key Step 5 gives the user to paste into the extension

Technical meaning:
- the web app generates the key server-side and stores it encrypted for the project
- the extension sends the raw key back to the ping route during connection testing
- the web app validates the submitted key against the encrypted stored version

What behavior it affects:
- whether the extension can prove it belongs to the current DioTest project

If rotated later:
- the old key should stop validating once the saved project key changes
- the extension must be updated with the new key before it can reconnect successfully

### Why Step 5 uses both event detection and API ping

Event detection solves one problem:
- is the extension present on this page at all?

API ping solves a different problem:
- has the extension been configured to call the correct DioTest app with the correct project key?

DioTest needs both because an installed extension can still be:
- pointed at the wrong app URL
- missing the API key
- carrying an invalid or stale key
- not yet configured for this project

### What DioTest stores in the web app vs in the extension

Stored in the web app:
- encrypted project API key
- extension connection timestamp or status marker

Stored in the extension:
- API Base URL
- API Key
- the rest of the extension’s local runtime settings

This split matters because the web app needs a server-side source of truth for project identity, while the extension needs local values it can use without a browser session.

### What happens when values are missing or invalid

If API Base URL is missing:
- the extension does not know which DioTest app to contact
- connection test should fail with an actionable error

If API Key is missing:
- the extension cannot identify the project
- Step 5 should remain in detected-but-not-connected state

If the key is invalid:
- the ping route rejects it
- the project should not be marked connected

If the app URL changes:
- the extension must be updated to point at the new app origin
- otherwise connection tests may fail or reach the wrong deployment

### Extension connection API routes

The Step 5 extension connection currently uses these web app routes:

- `POST /api/extension/ping`
  - called by the extension
  - does not depend on the browser session
  - validates the submitted project API key
  - records that the extension has successfully connected to the project

- `GET /api/extension/status`
  - called by the authenticated web app
  - checks whether the project has a successful extension connection timestamp
  - powers the Step 5 badge and Continue button state

- `POST /api/extension/key`
  - authenticated helper route for project-scoped key retrieval or generation
  - not the primary Step 5 onboarding path, because Step 5 already receives the key from server-rendered onboarding state

What this means in practice:
- extension detection alone is not enough to complete Step 5
- only a successful `POST /api/extension/ping` makes the project count as extension-connected

## Examples

### Example 1: Trello with optional list targeting

A user wants DioTest to create Trello cards on a known board but does not care which list receives them first.

Recommended setup:
- supply board ID
- supply API key and token
- leave default list ID blank if list placement is not important yet

Meaning:
- the board is still identified correctly
- DioTest has credentials to talk to Trello
- list placement remains less specific until configured later

### Example 2: AI provider preference without valid secret

A user selects OpenAI as the preferred AI provider but never stores a valid key.

Meaning:
- the preference exists as configuration
- DioTest still cannot run provider-backed AI requests until the secret is valid

### Example 3: Extension installed but not connected

A user has the extension installed, so Step 5 detects it on the page.

But the user has not yet pasted the API Base URL and API Key into the extension.

Meaning:
- Step 5 can say the extension is installed
- Step 5 should not say the extension is connected
- Continue should stay gated until the connection ping succeeds

### Example 4: Extension connected to the wrong app URL

A user pastes a valid API key but points the extension at the wrong DioTest app origin.

Meaning:
- local extension settings contain values
- the web app for the current onboarding session never receives a valid ping
- Step 5 remains incomplete until the extension is pointed at the correct app and tested again
