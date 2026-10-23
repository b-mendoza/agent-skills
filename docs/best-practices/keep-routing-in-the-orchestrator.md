# keep-routing-in-the-orchestrator

📝 Keep dispatch decisions in the orchestrator's `Execution` as status-keyed routes (given X, dispatch Y; on status Z, do W) when a skill dispatches two or more subagents.

Tier: mandatory transitions; recommended routing layout.

The orchestrator is the workflow's routing layer; subagents are its contracted backends. Write `Execution` so each step reads "given X, dispatch Y; on Y's status Z, do W": check the step's preconditions before a dispatch, its postconditions after, and route on the returned status. A subagent that consumes a raw ticket, file, payload, or page normalises it into the fields of its output contract; the orchestrator routes on those bounded fields and renders the user-facing handoff (decision, evidence summary, artifact paths, next steps) from them. A subagent may return a recommendation for the next step; the orchestrator makes the dispatch decision. Central routing is the portable default — whether a runtime supports nested dispatch is a fact recorded in [runtime-portability-matrix](./runtime-portability-matrix.md), not a workflow assumption. Every name a route dispatches has its referent in the skill's registry table ([list-subagents-in-a-registry](./list-subagents-in-a-registry.md)).

When `state-machine.md` exists, it is the single normative transition source and `Execution` is a compact overview that defers to it ([one-normative-state-machine](./one-normative-state-machine.md)). Status vocabulary, loop caps, and terminal statuses are owned by [keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md#transitions); each contract's shape by [declare-input-output-contracts](./declare-input-output-contracts.md); checking routed fields by [validate-routed-fields-with-a-script](./validate-routed-fields-with-a-script.md).

## Transitions

Every skill and subagent declares a closed UPPER_SNAKE status set and the condition for each value. Subagents declare success plus the reachable values from `BLOCKED | FAIL | ERROR | PARTIAL | TOOLS_MISSING | RATE_LIMIT`; they emit nothing outside that set. Status lines are `<TOKEN>: <VALUE>`. A skill ends with `<SKILL_TOKEN>: PASS | GAPS_FOUND | BLOCKED | ERROR` and the evidence for that one terminal outcome, not a stop-for-review after every phase.

Route every declared value and missing, malformed, or unknown output explicitly; never infer a status from prose. A `PARTIAL` result lists successes and failures so the remainder can be routed. A needed but unavailable capability returns `TOOLS_MISSING`, never a remembered substitute. [Validate received fields before routing](./validate-routed-fields-with-a-script.md). Approval answers are `APPROVED | REVISE | ABORT`; missing or unusable answers route to `BLOCKED` under the [approval rule](./checkpoint-irreversible-actions.md).

Every repair, retry, and re-ask loop has a named counter, a cap, and an at-cap route. State its initialization and increment. Every active or wait state advances, waits for a named event, or terminates. Declare competing-guard precedence once, as first-match order or explicit priority. Name each parallel join and its all-success, partial, blocked, error, and missing-result routes; outcomes must not depend on completion order.

## Examples

```markdown
<!-- ❌ routing hidden inside a subagent; registry rows with no referent -->

## Subagent Registry

| Group    | Subagents                   | Path         |
| -------- | --------------------------- | ------------ |
| Pipeline | fetcher, validator, planner | (see folder) |

## Execution

1. Dispatch `workflow-runner` with the work-item URL; it launches the others, retries them internally, and returns `done`.
2. Return whatever `workflow-runner` reports.

<!-- ✅ one row per subagent; Execution routes on enumerated statuses and renders the handoff -->

## Subagent Registry

| Subagent            | Path                               | Purpose                                                                                                                                  |
| ------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `work-item-fetcher` | `./subagents/work-item-fetcher.md` | Normalises a Jira or GitHub item into `REPORT_PATH`; returns `FETCH: PASS \| BLOCKED \| ERROR` (`BLOCKED`: item not found or unreadable) |
| `plan-validator`    | `./subagents/plan-validator.md`    | Checks the report against the plan contract; returns `VALIDATE: PASS \| FAIL \| ERROR`                                                   |

## Execution

1. Require `WORK_ITEM_URL`; missing → `ORCHESTRATE_WORKFLOW: BLOCKED`. Dispatch `work-item-fetcher`.
2. On `FETCH: PASS` → dispatch `plan-validator` with `REPORT_PATH`. On `FETCH: BLOCKED` (item not found) → `ORCHESTRATE_WORKFLOW: BLOCKED`.
   On `ERROR` → redispatch while `fetch_retries < 1`, then `ORCHESTRATE_WORKFLOW: ERROR`.
3. On `VALIDATE: PASS` → render the handoff: `DECISION`, `EVIDENCE_SUMMARY`, `ARTIFACT_PATHS`, `NEXT_STEPS`, then `ORCHESTRATE_WORKFLOW: PASS`.
   On `FAIL` → `ORCHESTRATE_WORKFLOW: GAPS_FOUND` with the validator's findings. On `ERROR` → same retry rule as step 2.
```

## Related rules

- [delegate-by-default](./delegate-by-default.md)
- [list-subagents-in-a-registry](./list-subagents-in-a-registry.md)
- [one-normative-state-machine](./one-normative-state-machine.md)
- [keep-routing-in-the-orchestrator](./keep-routing-in-the-orchestrator.md#transitions)
