# Execution Guide

Read this file when running the normal planning path or when continuing from a
re-plan decision. Load `./re-plan-cycle.md` first for `RE_PLAN=true`.

> Keep raw stage artifacts out of orchestrator context. Dispatch subagents and
> retain only verdicts, paths, issue lists, branch counts, and retry counts.
> Background on dispatch and isolation is in `./external-sources.md`
> (`claude-code-subagents`, `agent-skills-overview`).

## Normal Path

Run these gates in order:

1. `preflight`
2. Stage 1 plan
3. Stage 1 validation
4. Stage 2 prioritize and branch naming
5. Stage 2 validation
6. Stage 3 validation report
7. Stage 3 validation
8. `postpipeline`
9. Return handoff

## Gate Map

| Gate | Dispatch | Required output | On failure |
| ---- | -------- | --------------- | ---------- |
| `preflight` | `stage-validator` | Snapshot exists and satisfies `./output-contract.md` | Stop with `Failure category: PREFLIGHT` |
| Stage 1 | `task-planner`, then `stage-validator` | `PLAN: PASS` and `docs/<ISSUE_SLUG>-stage-1-detailed.md` passes Stage 1 | Retry Stage 1 only on validator `FAIL`; stop on subagent failure or validator `ERROR` |
| Stage 2 | `dependency-prioritizer`, then `stage-validator` | `PRIORITIZATION: PASS` and `docs/<ISSUE_SLUG>-stage-2-prioritized.md` passes Stage 2 | Retry Stage 2 only on validator `FAIL`; stop on subagent failure or validator `ERROR` |
| Stage 3 | `task-validator`, then `stage-validator` | `TASK_VALIDATION: PASS` and `docs/<ISSUE_SLUG>-tasks.md` passes Stage 3 | Retry Stage 3 only on validator `FAIL`; stop on subagent failure or validator `ERROR` |
| `postpipeline` | `stage-validator` | Final downstream contract is intact | Re-dispatch Stage 3 on validator `FAIL`; stop on validator `ERROR` |

## Dispatch Payloads

### Preflight

Dispatch `stage-validator` with:

```text
ISSUE_SLUG=<ISSUE_SLUG>
STAGE=preflight
FILE_PATH=docs/<ISSUE_SLUG>.md
```

### Stage 1 - Plan

Dispatch `task-planner` with:

```text
ISSUE_SLUG=<ISSUE_SLUG>
INPUT_PATH=docs/<ISSUE_SLUG>.md
OUTPUT_PATH=docs/<ISSUE_SLUG>-stage-1-detailed.md
DECISIONS=<DECISIONS> only when Stage 1 is part of a re-plan
VALIDATION_ISSUES=<issues list> only when retrying Stage 1
```

Then dispatch `stage-validator` with `STAGE=1` and
`FILE_PATH=docs/<ISSUE_SLUG>-stage-1-detailed.md`.

### Stage 2 - Prioritize and Name Branches

Dispatch `dependency-prioritizer` with:

```text
ISSUE_SLUG=<ISSUE_SLUG>
INPUT_PATH=docs/<ISSUE_SLUG>-stage-1-detailed.md
OUTPUT_PATH=docs/<ISSUE_SLUG>-stage-2-prioritized.md
DECISIONS=<DECISIONS> only when Stage 2 is part of a re-plan
VALIDATION_ISSUES=<issues list> only when retrying Stage 2
```

Then dispatch `stage-validator` with `STAGE=2` and
`FILE_PATH=docs/<ISSUE_SLUG>-stage-2-prioritized.md`.

### Stage 3 - Validate Final Plan

Dispatch `task-validator` with:

```text
ISSUE_SLUG=<ISSUE_SLUG>
SNAPSHOT_PATH=docs/<ISSUE_SLUG>.md
PLAN_PATH=docs/<ISSUE_SLUG>-stage-2-prioritized.md
OUTPUT_PATH=docs/<ISSUE_SLUG>-tasks.md
VALIDATION_ISSUES=<issues list> only when retrying Stage 3 or repairing postpipeline
```

Then dispatch `stage-validator` with `STAGE=3` and
`FILE_PATH=docs/<ISSUE_SLUG>-tasks.md`.

### Postpipeline

Dispatch `stage-validator` with:

```text
ISSUE_SLUG=<ISSUE_SLUG>
STAGE=postpipeline
FILE_PATH=docs/<ISSUE_SLUG>-tasks.md
```

## Targeted Retry Loop

This loop applies only to `STAGE_VALIDATION: FAIL` for Stage 1, Stage 2, Stage 3,
or `postpipeline`. Preflight failures and any `STAGE_VALIDATION: ERROR` are
terminal for the current run.

For a failing validator gate:

1. Collect only the validator's issues list.
2. Re-dispatch only the stage that produced that artifact.
3. Pass original inputs plus `VALIDATION_ISSUES=<issues list>`.
4. Re-run only the previously failing validator gate.
5. For `postpipeline`, re-dispatch Stage 3, then rerun `STAGE=3` and
   `STAGE=postpipeline`.
6. Stop after 3 failed cycles for the same gate.

## Example

```text
ISSUE_SLUG=acme-app-42

1. stage-validator preflight -> PASS
2. task-planner -> PLAN: PASS, writes docs/acme-app-42-stage-1-detailed.md
3. stage-validator STAGE=1 -> PASS
4. dependency-prioritizer -> PRIORITIZATION: PASS, writes branch names
5. stage-validator STAGE=2 -> PASS
6. task-validator -> TASK_VALIDATION: PASS, writes docs/acme-app-42-tasks.md
7. stage-validator STAGE=3 -> PASS
8. stage-validator postpipeline -> PASS
9. return PLANNING: PASS
```
