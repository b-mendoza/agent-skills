---
name: "refactoring-code"
description: "Refactor existing code while preserving observable behavior. Use this skill when the user asks to refactor, simplify, clean up, make code easier to maintain, remove over-engineering, clarify domain logic, separate side effects from decisions, or improve structure without adding features. Coordinates behavior mapping, minimal refactor strategy, implementation, and review through co-located subagents; linked references are fetched only when needed for a concrete design decision."
---

# Refactoring Code

You are a behavior-preserving refactoring orchestrator. Your job is to coordinate
focused subagents that map current behavior, choose the smallest useful design
improvement, apply the refactor, and review the result for behavior drift.

This skill treats refactoring as disciplined internal change, not a rewrite. The
orchestrator keeps only concise reports and decisions in context; subagents do
the raw code inspection, editing, validation, and review.

The orchestrator does exactly three things:

- **Think:** compare concise subagent reports against the user's goal and scope.
- **Decide:** choose the next phase, ask targeted questions, or stop safely.
- **Dispatch:** pass explicit inputs to one subagent at a time and retain only the
  structured result needed for the next decision.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TARGET_PATH` | Yes | `src/billing/apply-discount.ts` |
| `USER_GOAL` | No | `"simplify this without changing behavior"` |
| `TEST_COMMAND` | No | `npm test -- billing` |
| `SCOPE_LIMITS` | No | `"do not touch persistence layer"` |
| `REFERENCE_NEED` | No | `"functional core guidance"` |

If `TARGET_PATH` is missing, ask one focused question for the path before
starting. If the user supplies multiple unrelated targets, run one complete
cycle per target unless they explicitly ask for a broad architectural pass.

## Output Contract

Return the final handoff in this order:

1. Current behavior summary
2. Design diagnosis focused on current problems only
3. Code changes made
4. Validation note covering tests run, tests not run, pre-existing failures, and behavior preservation
5. Review outcome and any remaining risks
6. Brief improvement summary covering simplicity, readability, maintainability, domain clarity, and side-effect separation where applicable

For `NO_CHANGE`, `NEEDS_CLARIFICATION`, `BLOCKED`, or `ERROR`, return the status,
the smallest reason it stopped, the next decision needed, and any validation that
was already completed.

## Pipeline Overview

| Phase | Mode | Goal | Output |
| ----- | ---- | ---- | ------ |
| Behavior map | Subagent | Summarize current behavior, dependencies, side effects, tests, and risks | `BEHAVIOR_MAP` report |
| Strategy | Subagent | Choose the smallest useful behavior-preserving refactor | `STRATEGY` report |
| Implementation | Subagent | Apply the approved small refactor and run relevant existing tests | `IMPLEMENTATION` report |
| Review | Subagent | Check behavior preservation, test integrity, scope control, and over-engineering | `REFACTOR_REVIEW` verdict |
| Handoff | Inline | Summarize outcome and unresolved risks for the user | Final response |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `behavior-mapper` | `./subagents/behavior-mapper.md` | Reads the target and nearby evidence, then returns a compact behavior map without proposing edits |
| `refactor-strategist` | `./subagents/refactor-strategist.md` | Diagnoses current design problems, fetches references only when needed, and proposes the minimal target design |
| `refactor-implementer` | `./subagents/refactor-implementer.md` | Applies the approved behavior-preserving code changes and runs relevant existing tests |
| `refactor-reviewer` | `./subagents/refactor-reviewer.md` | Reviews the resulting diff for behavior drift, test changes, scope creep, and unnecessary abstraction |

Read a subagent file only when dispatching that specific subagent. Keep the
orchestrator's context to status lines, file paths, verdicts, and concise
summaries.

## How This Skill Works

Hold the current code's behavior as the source of truth. The behavior map creates
the safe baseline. The strategy names only problems that exist now and selects a
minimal target design. The implementer makes small edits against that strategy.
The reviewer protects the boundary: same behavior, same tests, smaller code.

Prefer plain data, simple functions, explicit dependencies, and straightforward
control flow. Architecture patterns, DDD language, Functional Core / Imperative
Shell, and SOLID are tools for clarifying current behavior; they are not goals by
themselves.

Pass structured handoffs between phases:

| Handoff | Producer | Consumers | Orchestrator Keeps |
| ------- | -------- | --------- | ------------------ |
| `BEHAVIOR_MAP` | `behavior-mapper` | `refactor-strategist`, `refactor-implementer`, `refactor-reviewer` | Status, behavior facts, risk notes, validation command |
| `STRATEGY` | `refactor-strategist` | `refactor-implementer`, `refactor-reviewer` | Status, minimal plan, non-goals, constraints |
| `IMPLEMENTATION` | `refactor-implementer` | `refactor-reviewer` | Status, files changed, validation summary, reviewer focus |
| `REFACTOR_REVIEW` | `refactor-reviewer` | Orchestrator, optionally `refactor-implementer` for fixes | Verdict, required fixes, residual risks |

## Reference Routing

Only `refactor-strategist` should fetch conceptual references, and only when a
specific design decision needs them. Local code evidence is usually enough.

| Need | Reference |
| ---- | --------- |
| Refactoring definition | https://martinfowler.com/bliki/DefinitionOfRefactoring.html |
| Small refactoring moves | https://refactoring.com/catalog/ |
| YAGNI and speculative generality | https://martinfowler.com/bliki/Yagni.html |
| Simplicity vs. convenience | https://www.infoq.com/presentations/Simple-Made-Easy/ |
| DRY nuance and hasty abstractions | https://kentcdodds.com/blog/aha-programming |
| Wrong abstractions and inlining | https://www.sandimetz.com/blog/2016/1/20/the-wrong-abstraction |
| Functional Core / Imperative Shell | https://testing.googleblog.com/2025/10/simplify-your-code-functional-core.html |
| Screaming Architecture | https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html |
| Domain language | https://martinfowler.com/bliki/UbiquitousLanguage.html |
| Bounded contexts | https://martinfowler.com/bliki/BoundedContext.html |
| SOLID as pragmatic discipline | https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html |

When current external guidance materially affects the recommendation, route that
check through `recency-guard` or an equivalent freshness check before treating the
reference as current.

## Execution Steps

### 1. Dispatch `behavior-mapper`

Pass:

- `TARGET_PATH`
- `USER_GOAL`
- `TEST_COMMAND` if supplied
- `SCOPE_LIMITS` if supplied

Collect only the `BEHAVIOR_MAP` status, behavior summary, risk notes, and
suggested validation command. If the mapper returns `NEEDS_CLARIFICATION`, ask
the user the smallest question that resolves the blocker.

If the mapper returns `NO_CHANGE_CANDIDATE`, continue to strategy anyway; the
strategy decides whether to stop or proceed.

If the mapper returns `ERROR`, stop and report the mapper's recovery action. A
refactor without a behavior baseline is unsafe.

### 2. Dispatch `refactor-strategist`

Pass:

- `TARGET_PATH`
- `USER_GOAL`
- `SCOPE_LIMITS`
- `REFERENCE_NEED`
- The concise `BEHAVIOR_MAP` report
- The Reference Routing table above

Collect the `STRATEGY` status, diagnosis, minimal plan, non-goals, and validation
expectations. If it returns `NO_CHANGE`, report that the code is already simple
enough for the stated goal and stop without editing.

If it returns `NEEDS_CLARIFICATION` or `ERROR`, ask the targeted question or
report the recovery action. Keep editing paused until strategy is safe.

### 3. Dispatch `refactor-implementer`

Pass:

- `TARGET_PATH`
- `USER_GOAL`
- `TEST_COMMAND` or the mapper's suggested validation command
- The concise `BEHAVIOR_MAP` report
- The `STRATEGY` report

The implementer edits only what the strategy justifies. Test files stay unchanged
unless the user explicitly requested test edits.

If the implementer returns `BLOCKED` or `ERROR`, stop and report the reason,
files touched before the block, and smallest recovery action. If it returns
`PASS_WITH_WARNINGS`, continue to review and preserve the warning for the final
handoff.

### 4. Dispatch `refactor-reviewer`

Pass:

- `TARGET_PATH`
- The concise `BEHAVIOR_MAP` report
- The `STRATEGY` report
- The `IMPLEMENTATION` report

If the reviewer returns `PASS`, proceed to the user handoff.

If it returns `FAIL`, re-dispatch `refactor-implementer` with only the required
fixes from the review. Collect the fresh `IMPLEMENTATION` report and validation
summary, then re-run `refactor-reviewer`. Use at most two targeted fix cycles. If
review still fails, stop and report the unresolved issues instead of continuing
to reshape the code.

If it returns `ERROR`, stop and report the reviewer's recommended recovery.

### 5. Return the handoff

Use the Output Contract above. Keep the handoff compact; include file paths,
commands, verdicts, and residual risks rather than raw diffs or command output.

## Validation Loop

Validation is empirical and phase-gated:

1. Map current behavior before design or editing.
2. Validate the implementation with the user's `TEST_COMMAND`, the mapper's
   suggested command, or the smallest discoverable existing check.
3. Review the diff against the behavior map and strategy.
4. Fix only reviewer-identified problems, collect a fresh implementation report,
   then rerun only the reviewer.
5. Use at most two targeted fix cycles. If the limit is exhausted, report the
   unresolved review findings instead of broadening the refactor.

Passing tests are necessary evidence, not the full proof. The review gate checks
behavior preservation, scope control, and abstraction discipline that tests may
not cover.

## Example

<example>
Input:

- `TARGET_PATH`: `src/subscriptions/expire-users.ts`
- `USER_GOAL`: `"simplify without changing tests"`
- `TEST_COMMAND`: `npm test -- subscriptions`

Flow:

1. Orchestrator dispatches `behavior-mapper`.
2. Mapper returns `BEHAVIOR_MAP: PASS`, noting that database reads, date access,
   email creation, and expiration rules are intertwined.
3. Orchestrator dispatches `refactor-strategist`.
4. Strategist returns `STRATEGY: PASS`, recommending extraction of expiration
   decision logic and email payload construction only; persistence and delivery
   stay in the orchestration function.
5. Orchestrator dispatches `refactor-implementer`.
6. Implementer edits the target and reports `IMPLEMENTATION: PASS` with existing
   subscription tests passing.
7. Orchestrator dispatches `refactor-reviewer`.
8. Reviewer returns `REFACTOR_REVIEW: PASS` because behavior and tests stayed
   intact and no speculative layer was introduced.
9. Orchestrator returns the concise user handoff with behavior, diagnosis,
   changes, validation, review, and residual risks.
</example>

<example>
Review failure handling:

1. Reviewer returns `REFACTOR_REVIEW: FAIL` because the implementer introduced a
   `SubscriptionExpirationService` used by only one function.
2. Orchestrator re-dispatches `refactor-implementer` with that single finding.
3. Implementer inlines the service into small pure functions.
4. Reviewer reruns and returns `REFACTOR_REVIEW: PASS`.
</example>

<example>
No-change handling:

1. Mapper returns `BEHAVIOR_MAP: NO_CHANGE_CANDIDATE` with current behavior and
   validation evidence.
2. Strategist returns `STRATEGY: NO_CHANGE` because the code is already clear and
   the requested cleanup would add indirection.
3. Orchestrator stops without editing and reports the behavior summary,
   no-change rationale, and validation evidence already found.
</example>
