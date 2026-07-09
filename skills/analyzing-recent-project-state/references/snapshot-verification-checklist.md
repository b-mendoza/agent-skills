# Snapshot Verification Checklist

Use this checklist before allowing a project state snapshot to reach the user.

## Checks

| Check | Pass condition |
| ----- | -------------- |
| Grounding | Every material claim traces to `GIT_EVIDENCE`, an `Inspected:` entry, a cited source, or an inference label |
| Format | The report follows the 10-section template or declares the quiet-state short form |
| Focus | Non-`full` focus visibly changes emphasis without dropping off-focus blockers |
| Risk quality | Each risk has severity, area, finding, evidence, why it matters, confidence, and action |
| Behavior labels | Confirmed, likely, possible, and unverified impacts are separated |
| Scope | Untouched areas are omitted unless evidence clearly implicates them |
| Validation | Recommended commands match visible repo conventions; unobserved commands are not claimed as run |
| Evidence boundary | No raw diffs, full command output, secrets, large file bodies, or performed-change claims |
| Citations | External sources are cited beside the supported finding |
| Handoff value | The final briefing tells the next developer how to continue safely |

Spot-check at most 3 material claims by direct read when the `Inspected:` log
is the only support. Do not repeat the writer's whole inspection.

## Verdict Coherence

- `SNAPSHOT_VERIFY: PASS` requires `Required fixes: none`.
- `SNAPSHOT_VERIFY: FAIL` requires at least one targeted required fix.
- A needed user decision is `SNAPSHOT_VERIFY: NEEDS_CONTEXT`, never `FAIL`.
- If the available information cannot support a coherent verdict, use
  `SNAPSHOT_VERIFY: ERROR` with a clear reason.

## Targeted Fixes

Required fixes should name the section and the defect, for example:

- `Section 5 Risks: add confidence and action to each row.`
- `Section 6 Test And Validation Review: remove claim that tests ran; evidence only recommends npm test.`
- `Section 2 Git State: include repo state and evidence window from GIT_EVIDENCE.`

Do not ask for a full rewrite unless the report is structurally unusable.
