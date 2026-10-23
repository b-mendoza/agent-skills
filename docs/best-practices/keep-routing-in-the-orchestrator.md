# keep-routing-in-the-orchestrator

> Current-state authoring reference; update when these package conventions change.

Tier: mandatory delegation and transitions; recommended routing layout, registry, and job scoping.

Use when a skill dispatches work or has branches, retries, waits, approvals, or parallel joins.

## Dispatch

Delegate evidence work by default: reading files, parsing command output or API payloads, extracting web content, and producing artifacts. Return bounded statuses, paths, ids, and summaries; pass paths between steps, not raw contents. Retrieve later details only when needed. Run a step inline only when the orchestrator needs raw or conversational material for coordination or a later routing decision; split mixed steps into dispatched evidence and inline decisions. Dispatch cost shapes the job, not whether to delegate. Nesting and the no-subagent-tool fallback follow the [runtime matrix](./runtime-portability-matrix.md).

Recommended job scoping: combine adjacent jobs while small; split when combined context, mutation scope, or independence no longer fits one dispatch. A second subagent with the same consumer as an existing one is a smell. Shape checks are a [script's job](./declare-input-output-contracts.md), not a dispatch. Use a semantic reviewer only when the artifact is too large or numerous for the orchestrator to judge, and an adjudicator only when two or more parallel producers exist.

Recommended routing layout: for two or more subagents, keep status-keyed dispatch decisions in the orchestrator's `Execution`. Check preconditions before dispatch and postconditions after it. A subagent normalizes raw inputs into its contract and may recommend a next step; the orchestrator decides and renders the user-facing decision, evidence summary, artifact paths, and next steps.

## Registry

Recommended for two or more dispatched subagents, or one with expected growth or dynamic routing: place a registry after the overview and before `Execution`. Use `Subagent`, `Path`, and `Purpose` columns exactly once, with one subagent, one real skill-relative path, and one purpose per row. Add single-valued columns only when they affect routing. Every dispatched name has a row; apply the [frontmatter naming rule](./describe-when-to-use.md#name). Load the file only at dispatch.

## Transitions

Every skill and subagent declares a closed UPPER_SNAKE status set and the condition for each value. Subagents declare success plus the reachable values from `BLOCKED | FAIL | ERROR | PARTIAL | TOOLS_MISSING | RATE_LIMIT`; they emit nothing outside that set. Status lines are `<TOKEN>: <VALUE>`. A skill ends with `<SKILL_TOKEN>: PASS | GAPS_FOUND | BLOCKED | ERROR` and the evidence for that one terminal outcome, not a stop-for-review after every phase.

Route every declared value and missing, malformed, or unknown output explicitly; never infer a status from prose. A `PARTIAL` result lists successes and failures so the remainder can be routed. A needed but unavailable capability returns `TOOLS_MISSING`, never a remembered substitute. [Validate received fields before routing](./declare-input-output-contracts.md). Approval answers are `APPROVED | REVISE | ABORT`; missing or unusable answers route to `BLOCKED` under the [approval rule](./declare-mutation-limits.md#approval).

Every repair, retry, and re-ask loop has a named counter, a cap, and an at-cap route. State its initialization and increment. Every active or wait state advances, waits for a named event, or terminates. Declare competing-guard precedence once, as first-match order or explicit priority. Name each parallel join and its all-success, partial, blocked, error, and missing-result routes; outcomes must not depend on completion order.

Keep one normative transition source. Use `Execution` for a small linear flow with at most one retry; separate `state-machine.md` only when it removes ambiguity. When present, that file owns states, guards, events, joins, loops, and terminal outcomes. `Execution` links it as a non-normative overview; `flow-diagram.md` is illustrative. Update both with transition changes; neither overrides the normative source.

## Example

Bad: a `workflow-runner` secretly dispatches other agents, retries until "done," and returns prose that the orchestrator forwards unexamined.

Better, for a report large enough to need semantic review:

```markdown
## Subagent Registry

| Subagent | Path | Purpose |
| --- | --- | --- |
| work-item-fetcher | ./subagents/work-item-fetcher.md | Returns FETCH and REPORT_PATH |
| report-reviewer | ./subagents/report-reviewer.md | Returns REVIEW and semantic findings |

## Execution

Require WORK_ITEM_URL; missing → ORCHESTRATE_WORKFLOW: BLOCKED.
fetch_retries and review_retries start at 0; each has cap 1.
Validate every received payload with the bundled script before these routes.
Malformed, missing, or unknown status → ORCHESTRATE_WORKFLOW: ERROR.
FETCH: PASS → dispatch report-reviewer with REPORT_PATH.
FETCH: BLOCKED → ORCHESTRATE_WORKFLOW: BLOCKED.
FETCH: ERROR with fetch_retries < 1 → increment and redispatch; at cap → ERROR.
REVIEW: PASS → render decision, evidence, paths, next steps; terminal PASS.
REVIEW: FAIL → terminal GAPS_FOUND with findings.
REVIEW: ERROR with review_retries < 1 → increment and redispatch; at cap → ERROR.
All terminal lines use ORCHESTRATE_WORKFLOW and include supporting evidence.
```
