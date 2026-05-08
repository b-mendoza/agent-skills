# Snapshot Verification Checklist

> Read this file only when `snapshot-verifier` is checking a draft report.
> Verify by comparing the report to `GIT_EVIDENCE`; do not perform a fresh
> full analysis. If a check needs source-backed background (general code
> review judgment, test pyramid framing, OWASP categories, twelve-factor
> config), open `./external-sources.md` and fetch the smallest relevant URL
> instead of inlining heuristics.

## Required Checks

| Check | Pass Criteria |
| ----- | ------------- |
| Grounding | Material claims are supported by `GIT_EVIDENCE`, narrow local context, or labeled as inference. |
| Format | The report follows the snapshot template or clearly omits irrelevant sections. |
| Risk quality | Each meaningful risk includes severity, area, finding, evidence, impact, confidence, and action. |
| Behavior | Confirmed, likely, and possible behavior changes are separated when applicable. |
| Scope | Test, dependency, config, tooling, and security notes appear only when changed or implicated. |
| Validation | Suggested commands are adapted to visible project scripts or conventions. |
| External sources | Fetched references are cited only next to the finding they support. |
| Handoff value | The final briefing tells a developer how to continue safely. |

## Failure Example

```text
SNAPSHOT_VERIFY: FAIL
Summary: The report is useful but overstates likely intent as fact.
Required fixes:
- In Theme 2, label the migration motivation as an inference and cite the commit/file evidence.
- Add confidence and recommended action for the Medium config risk.
Optional improvements:
- Shorten dependency notes because only the lockfile changed.
Grounding issues:
- "This was done to improve performance" is not supported by the evidence handoff.
Format issues:
- Risk table is missing confidence for one row.
Actionability issues:
- The top next action does not name a concrete validation command or manual check.
Reason: Required fixes need writer repair.
Decision needed: Redispatch writer with required fixes.
```

## Fix Guidance

Return only targeted fixes. The orchestrator will redispatch
`state-snapshot-writer` with those issues and the original evidence handoff,
then re-run this checklist.
