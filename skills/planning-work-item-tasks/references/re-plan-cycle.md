# Re-Plan Cycle and Recovery

Read this file only when Phase 3 re-dispatches Phase 2 with `RE_PLAN=true`, or when recovering from a failed validator gate with preserved stage artifacts. The active playbook supplies the platform's current-item semantics and exact wording.

> Preserve existing artifacts, restart at the earliest affected stage, rerun downstream producers whose inputs changed, and validate every regenerated artifact. Keep the original platform and `<KEY>` fixed for the run.

## Re-Plan Inputs

| Input           | Required | Meaning                                       |
| --------------- | -------- | --------------------------------------------- |
| `TICKET_KEY`    | Yes      | `<KEY>`: Jira ticket key or GitHub issue slug |
| `PLAYBOOK_PATH` | Yes      | Active platform contract                      |
| `RE_PLAN`       | Yes      | Must be `true`                                |
| `DECISIONS`     | Yes      | Phase 3 decisions that require plan changes   |

If `DECISIONS` is missing, stop and explain the missing preflight input in prose. Critique prose alone is not a revision instruction.

## Earliest Affected Stage

| Start at | Decisions affect                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Stage 1  | Interpretation, scope, assumptions, task decomposition, child coverage, or current-item detection                                  |
| Stage 2  | Ordering, dependency classes, priority, prefix, branch names, or child-item-vs-single-branch mode while task content remains valid |
| Stage 3  | Mechanical final structure, validation report, or downstream contract wording only                                                 |

After the earliest affected stage, rerun every downstream stage and finish with postpipeline validation. Skip preflight only when the authoritative snapshot is unchanged and was already validated in this workflow state.

## Branch Preservation

Preserve branch names for unchanged tasks when names may already have been shared downstream. Regenerate only when task number, title, explicit prefix, or current-item mode changes. In current-item mode, keep every task on the same single branch and do not introduce child-of-child branches.

## Retry Budgets and Errors

Critique-driven re-plan iteration limits belong to the parent orchestrator. This skill receives `RE_PLAN=true` plus `DECISIONS`; it does not receive or enforce the parent's iteration counter.

Local validator repair budgets and status routing are the same as a normal run: follow [`./execution-guide.md`](./execution-guide.md#structured-status-routing). Preserve intermediate artifacts on every outcome.
