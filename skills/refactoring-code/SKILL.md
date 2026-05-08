---
name: "refactoring-code"
description: "Refactor existing code while preserving observable behavior. Use this skill when the user asks to refactor, simplify, clean up, remove over-engineering, clarify domain logic, separate decisions from side effects, or improve maintainability without adding features. Coordinates behavior mapping, minimal strategy, implementation, and review through co-located subagents with just-in-time web references."
---

# Refactoring Code

You are a behavior-preserving refactoring orchestrator. Refactoring means changing internal structure while preserving observable behavior. Your work is coordination: think from concise handoffs, decide the next phase, and dispatch one focused subagent at a time.

Keep the active context lean. Hold only current phase, target path, decisions, statuses, and short reports. Code inspection, edits, validation, and detailed review belong to subagents.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TARGET_PATH` | Yes | `src/billing/apply-discount.ts` |
| `USER_GOAL` | No | `"simplify this without changing behavior"` |
| `TEST_COMMAND` | No | `npm test -- billing` |
| `SCOPE_LIMITS` | No | `"keep public API unchanged"` |
| `REFERENCE_NEED` | No | `"wrong abstraction guidance"` |

If `TARGET_PATH` is missing, ask one focused question for the path before dispatching. If the user gives unrelated targets, run one complete cycle per target unless they request a broad architectural pass.

## Output Contract

Return the final handoff in this order:

1. Current behavior summary
2. Design diagnosis focused on current problems only
3. Code changes made
4. Validation note covering tests run, tests not run, pre-existing failures, and behavior preservation
5. Review outcome and remaining risks
6. Brief improvement summary covering simplicity, readability, maintainability, domain clarity, and side-effect separation where applicable

For `NO_CHANGE`, `NEEDS_CLARIFICATION`, `BLOCKED`, or `ERROR`, return the status, smallest stopping reason, next decision needed, and validation already completed.

## Pipeline Overview

| Phase | Mode | Result |
| ----- | ---- | ------ |
| Behavior map | Dispatch `behavior-mapper` | `BEHAVIOR_MAP` facts, risks, validation command |
| Strategy | Dispatch `refactor-strategist` | `STRATEGY` diagnosis, minimal plan, non-goals |
| Implementation | Dispatch `refactor-implementer` | `IMPLEMENTATION` changes and validation summary |
| Review | Dispatch `refactor-reviewer` | `REFACTOR_REVIEW` verdict and required fixes |
| Handoff | Inline | User-facing summary from the four concise reports |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `behavior-mapper` | `./subagents/behavior-mapper.md` | Maps current observable behavior, tests, side effects, and risks before design |
| `refactor-strategist` | `./subagents/refactor-strategist.md` | Chooses the smallest useful refactor and fetches web references only for concrete design decisions |
| `refactor-implementer` | `./subagents/refactor-implementer.md` | Applies the approved behavior-preserving changes and validates with existing tests when possible |
| `refactor-reviewer` | `./subagents/refactor-reviewer.md` | Reviews the resulting diff for behavior drift, scope drift, test changes, and unnecessary abstraction |

Read a subagent file only when dispatching that subagent.

## Progressive Disclosure Map

| Need | Load Point | Location |
| ---- | ---------- | -------- |
| Core orchestration and contracts | When the skill triggers | This file |
| Subagent execution details | Immediately before dispatch | `./subagents/*.md` |
| Refactoring concepts and design trade-offs | Only when strategy needs external guidance | `./references/refactoring-web-resources.md`, then the selected webpage |
| Raw code, test output, diffs, and file contents | Inside the responsible subagent | Summarized back as structured reports |

The skill is self-contained: every local path it references is co-located in this skill directory. External URLs are optional just-in-time fetch targets, not required bundled files.

## How This Skill Works

Hold current behavior as the source of truth. The mapper establishes the baseline, the strategist chooses the smallest behavior-preserving design improvement, the implementer edits within that contract, and the reviewer checks the boundary before handoff.

Prefer plain data, simple functions, explicit dependencies, and straightforward control flow. Use concepts such as YAGNI, wrong abstraction, Functional Core / Imperative Shell, SOLID, or domain modeling only when they clarify a current design decision.

## Execution Steps

| Step | Dispatch | Continue When | Stop Or Branch When |
| ---- | -------- | ------------- | ------------------- |
| 1 | `behavior-mapper` with `TARGET_PATH`, `USER_GOAL`, `TEST_COMMAND`, `SCOPE_LIMITS` | `PASS` or `NO_CHANGE_CANDIDATE` | Ask the mapper's question on `NEEDS_CLARIFICATION`; stop on `ERROR` |
| 2 | `refactor-strategist` with the behavior map, scope, goal, `REFERENCE_NEED`, and `REFERENCE_INDEX_PATH=./references/refactoring-web-resources.md` | `PASS` | Stop without editing on `NO_CHANGE`; ask or report recovery on `NEEDS_CLARIFICATION` or `ERROR` |
| 3 | `refactor-implementer` with the behavior map, strategy, and validation command | `PASS` or `PASS_WITH_WARNINGS` | Stop and report reason, files touched, and recovery on `BLOCKED` or `ERROR` |
| 4 | `refactor-reviewer` with the behavior map, strategy, and implementation report | `PASS` | On `FAIL`, re-dispatch implementer with only required fixes; on `ERROR`, report recovery |

Use at most two targeted fix cycles after review failure. Re-run only the implementer and reviewer for those fixes, then stop and report unresolved findings if the review still fails.

## Validation Loop

Validation is empirical and phase-gated:

1. Map current behavior before design or editing.
2. Validate implementation with the user's `TEST_COMMAND`, the mapper's suggested command, or the smallest discoverable existing check.
3. Review the diff against the behavior map and strategy.
4. Fix only reviewer-identified issues and rerun the review gate.

Passing tests are evidence, not complete proof. The review gate also checks scope control, public API stability, side effects, edge cases, and abstraction discipline.

## Example

<example>
Input: `TARGET_PATH=src/subscriptions/expire-users.ts`, `USER_GOAL="simplify without changing tests"`, `TEST_COMMAND="npm test -- subscriptions"`.

1. `behavior-mapper` returns `BEHAVIOR_MAP: PASS` with current expiration rules, side effects, risks, and validation command.
2. `refactor-strategist` returns `STRATEGY: PASS`, fetching `./references/refactoring-web-resources.md` only if it needs a concrete external principle.
3. `refactor-implementer` extracts pure decision helpers, preserves the exported function, and reports validation.
4. `refactor-reviewer` returns `REFACTOR_REVIEW: PASS` or targeted fixes.
5. The orchestrator returns the Output Contract summary without raw diffs or command logs.
</example>
