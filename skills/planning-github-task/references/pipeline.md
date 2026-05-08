# Planning Pipeline

> Read this file when running the standard planning flow or a
> critique-triggered re-plan.
>
> Reminder: dispatch one subagent at a time, keep only summaries, and rerun
> only the steps invalidated by critique.

## Shared Reference Paths

Pass these paths with each subagent dispatch unless a caller already
provided a more specific bundled path:

```text
DATA_CONTRACTS_PATH: ./data-contracts.md
ARTIFACT_TEMPLATES_PATH: ./artifact-templates.md
HANDOFF_FORMATS_PATH: ./handoff-formats.md
EXTERNAL_SOURCES_PATH: ./external-sources.md
```

The orchestrator does not fetch external methodology sources in advance. A
subagent reads `EXTERNAL_SOURCES_PATH` only when a public source can change
its current artifact decision, then returns exact URLs in
`References fetched`. A subagent reads `HANDOFF_FORMATS_PATH` only when it
needs examples for its return summary.

## Standard Pipeline

| Stage | Subagent | Required inputs | Optional inputs | Result fields |
| ----- | -------- | --------------- | --------------- | ------------- |
| 1 | `execution-prepper` | `ISSUE_SLUG`, `TASK_NUMBER` | `RE_PLAN`, `DECISIONS_FILE` | `PREP`, brief path |
| 2 | `execution-planner` | `BRIEF_FILE` | `DECISIONS_FILE` | `PLAN`, plan path, recommended skills |
| 3 | `test-strategist` | `BRIEF_FILE`, `PLAN_FILE` | `DECISIONS_FILE` | `TEST_SPEC`, spec path, framework |
| 4 | `refactoring-advisor` | `BRIEF_FILE`, `PLAN_FILE`, `TEST_SPEC_FILE` | `DECISIONS_FILE` | `REFACTORING`, plan path, verdict |

Always pass the shared reference paths in addition to the inputs above.

### Stage outcomes

| Status returned | Coordinator action |
| --------------- | ------------------ |
| `*: PASS` | Continue with the returned artifact path |
| `*: FAIL` | Stop and surface the dependency, ambiguity, behavior gap, or planning risk |
| `*: BLOCKED` | Stop and surface the missing prerequisite or input artifact |
| `*: ERROR` | Stop and ask the user how to proceed |

### Stage 5. Report completion

Return a short summary containing:

- Task number and title
- The four artifact paths
- One or two sentences on the recommended approach
- The number or shape of tests specified
- The refactoring verdict
- Any exact `References fetched` URLs, or `none`

## Re-Plan Rules

Use targeted reruns instead of replaying the entire pipeline by default.

| Critique change | Rerun |
| --------------- | ----- |
| Task scope, definition of done, resolved questions, or brief context | `execution-prepper` and every downstream subagent |
| Implementation approach, file strategy, or recommended skills | `execution-planner`, `test-strategist`, `refactoring-advisor` |
| Test expectations only | `test-strategist`; rerun `refactoring-advisor` only if the change moves implementation sequencing, setup, or test impact |
| Refactoring guidance only | `refactoring-advisor` alone |

Whenever a subagent is re-run:

- Pass `DECISIONS_FILE` when the critique step produced it
- Pass `RE_PLAN=true` when re-dispatching `execution-prepper` after critique
- Let the subagent read its existing artifact for prior context
- Overwrite only that subagent's owned file
- Re-run any downstream subagent whose owned artifact now depends on the
  updated output

Maximum re-plan loops: 3. If critique still reports unresolved high-severity
issues after the third loop, escalate to the user with the remaining
concerns.

## Validation Loop

At each stage, confirm the required input artifact exists before dispatching
and confirm the expected output artifact exists after the subagent returns
`PASS`. When validation fails, re-dispatch only the owner of the failed
artifact with the specific issue and re-check only that failed condition.
Retry a failed artifact-validation repair at most 3 times per stage, then
escalate with the failed condition.
