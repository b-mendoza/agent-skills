# Re-Plan Cycle and Recovery

Read this file only when Phase 3 critique re-dispatches Phase 2 with
`RE_PLAN=true`, or when recovering from a failed validator gate with preserved
stage artifacts.

> Recovery rule: preserve existing stage artifacts, restart from the earliest
> affected stage, rerun downstream stages whose inputs changed, and rerun only
> the validator gates for regenerated artifacts.

> **Reminder:** The recovery rules below are operational. For background on
> staged loading and just-in-time retrieval rationale, see
> `./external-sources.md` (`progressive-disclosure-skill`,
> `progressive-disclosure-ux`).

## Re-Plan Inputs

The orchestrator re-dispatches this skill with the same `ISSUE_SLUG`, plus:

| Input | Meaning |
| ----- | ------- |
| `RE_PLAN=true` | Signals this is a critique-driven re-dispatch |
| `DECISIONS` | Phase 3 decisions that require plan changes |

## Earliest Affected Stage

| Start at | When decisions affect |
| -------- | --------------------- |
| Stage 1 | Issue interpretation, scope, assumptions, task decomposition, or current-child-issue detection |
| Stage 2 | Ordering, dependencies, priority, branch names, or child-issue-vs-single-branch mode while task content remains valid |
| Stage 3 | Final validation report, mechanical structure, or downstream contract wording only |

After rerunning the earliest affected stage, rerun every downstream stage and
finish with post-pipeline validation. Skip preflight unless
`docs/<ISSUE_SLUG>.md` changed or must be revalidated.

## Branch Preservation

Preserve branch names for unchanged tasks when those names may already have been
shared with downstream child-issue creation or implementation. Regenerate branch
names only for tasks whose number, title, or current-child-issue mode changed.

If the issue is itself a GitHub child issue or sub-issue, keep every task on the
same single branch during re-plan. Do not introduce child-issue branch names.

## Targeted Fix Budget

Re-plan iterations and validator retries are tracked separately:

| Loop | Limit | Counts |
| ---- | ----- | ------ |
| Re-plan | 3 iterations | Critique-driven planning revisions |
| Targeted validator fix | 3 cycles per gate | Repeated failures at the same structural gate |

If the limit is exhausted, stop and return `PLANNING: FAIL` with the relevant
failure category and a one-line reason.

## Error Handling

- If a stage subagent returns `FAIL`, `BLOCKED`, or `ERROR`, stop the pipeline
  and report that stage as the failure category.
- If `stage-validator` returns `FAIL`, re-dispatch only the stage that produced
  the failing artifact and pass the validator's issues as `VALIDATION_ISSUES`.
- If `stage-validator` returns `ERROR`, stop at that gate and report that the
  validator errored.
- Preserve intermediate files regardless of success or failure.
