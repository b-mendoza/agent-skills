# Snapshot Verification Checklist

> Load this file only when `snapshot-verifier` checks a draft report. Compare
> the report to `GIT_EVIDENCE`; perform source fetching only for a concrete
> static-background question.

## Required Checks

| Check | Pass criteria |
| ----- | ------------- |
| Grounding | Material claims are supported by `GIT_EVIDENCE`, narrow local context, or labeled inference. |
| Format | The report follows the snapshot template or clearly omits irrelevant sections. |
| Status handling | The draft report body is separable from `SNAPSHOT_WRITE: PASS`, and final-facing content contains no subagent wrapper. |
| Risk quality | Each meaningful risk includes severity, area, evidence, impact, confidence, and action. |
| Behavior | Confirmed, likely, and possible behavior changes are separated when applicable. |
| Scope | Test, dependency, config, tooling, security, and performance notes appear only when touched or implicated. |
| Validation | Suggested commands match visible project scripts, CI files, docs, or conventions. |
| Evidence boundary | The report avoids raw diffs, full command dumps, secrets, and claims that repository changes were performed. |
| External sources | Fetched references are cited only beside supported findings. |
| Handoff value | The final briefing tells a developer how to continue safely. |

## Failure Example

```text
SNAPSHOT_VERIFY: FAIL
Summary: The report is useful but overstates likely intent as fact.
Required fixes:
- In Theme 2, label the migration motivation as inference and cite file evidence.
- Add confidence and a recommended action for the Medium config risk.
Optional improvements:
- Shorten dependency notes because only the lockfile changed.
Grounding issues:
- "This was done to improve performance" is unsupported.
Format issues:
- Risk table is missing confidence for one row.
Actionability issues:
- The top next action does not name a concrete command or manual check.
Reason: Required fixes need writer repair.
Decision needed: Redispatch writer with required fixes.
```

## Fix Guidance

Return only targeted fixes. The orchestrator redispatches
`state-snapshot-writer` with those issues and the original evidence handoff,
then re-runs this checklist.
