# QA Notes (Local Only)

## Policy

- Local validation only.
- Do not push any commits/branches until explicit approval.

## Environment

- Date:
- Tester:
- OS:
- Chrome version:
- Branch: `feat/pr-context-extractor`
- Extension load path: `/Users/dionjerry/Downloads/MY CODES/diotest-Agent/diotest-agent/extension`

## Build Verification

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `npm run build`
- [x] `extension/background/index.js` exists
- [x] `extension/content/pr-observer.js` exists
- [x] side panel compiled JS exists (`extension/sidepanel/main.js`, `extension/sidepanel/App.js`)

## Load Unpacked Extension (Manual)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select repo path containing `extension/manifest.json`.
5. Pin DioTest extension.
6. Open a GitHub PR page.
7. Open DioTest side panel.

## Manual Checklist

### PR page detection
- [ ] Badge shows `PR` on PR page.
- [ ] `Analyze PR` button is visible.

### PR extraction
- [ ] Repo renders correctly.
- [ ] PR number renders correctly.
- [ ] PR title renders correctly.
- [ ] Description renders correctly (or empty fallback).
- [ ] Changed files list renders.

### PJAX navigation
- [ ] Switch between PRs without full reload.
- [ ] `Analyze PR` still works after navigation.

### Error path
- [ ] On non-PR page, deterministic extraction error is shown.

### Settings gate
- [ ] Invalid settings prevent analysis.
- [ ] Validation messages are clear.

### Recorder safety
- [ ] Enable Safe Mode in Settings.
- [ ] `Start UI Recording` is disabled while Safe Mode is on.

## Bugs / Findings

| ID | Area | Severity | Steps to Reproduce | Expected | Actual | Screenshot |
|----|------|----------|--------------------|----------|--------|------------|
|    |      |          |                    |          |        |            |

## Local TODOs

- [ ]
- [ ]

## Summary

- Overall status:
- Ready for PR to `develop`:
