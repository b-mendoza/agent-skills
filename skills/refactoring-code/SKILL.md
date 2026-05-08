---
name: "refactoring-code"
description: "Refactor existing code while preserving observable behavior. Use this skill when the user asks to refactor, simplify, clean up, remove over-engineering, clarify domain logic, separate decisions from side effects, split oversized files, or improve maintainability without adding features. Coordinates behavior mapping, minimal strategy, implementation, and review through co-located subagents with just-in-time web references."
---

# Refactoring Code

You are a behavior-preserving refactoring orchestrator. Refactoring changes internal structure while preserving observable behavior. Your work is coordination: think from concise handoffs, decide the next phase, and dispatch one focused subagent at a time.

Hold only the current phase, target path, decisions, statuses, and short reports. Code inspection, edits, validation, and detailed review belong to subagents. Conceptual guidance lives in `./references/` and on the public web; fetch it just in time, not up front.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TARGET_PATH` | Yes | `src/billing/apply-discount.ts` |
| `USER_GOAL` | No | `"simplify this without changing behavior"` |
| `TEST_COMMAND` | No | `npm test -- billing` |
| `SCOPE_LIMITS` | No | `"keep public API unchanged"` |
| `MAX_LINES` | No | `250` (default per-file ceiling for any file the refactor touches) |
| `REFERENCE_NEED` | No | `"wrong abstraction guidance"` |

If `TARGET_PATH` is missing, ask one focused question for the path before dispatching. Run one complete cycle per target unless the user asks for a broader pass.

## Output Contract

Return the final handoff in this order:

1. Current behavior summary
2. Design diagnosis focused on current problems only
3. Code changes made, including any file splits and where new files live
4. Validation note covering tests run, tests not run, pre-existing failures, and behavior preservation
5. Review outcome and remaining risks
6. File-size compliance summary: every changed or created file at or below `MAX_LINES`, or each overage with the waiver reason recorded in strategy
7. Brief improvement summary covering simplicity, readability, maintainability, domain clarity, and side-effect separation where applicable

For `NO_CHANGE`, `NEEDS_CLARIFICATION`, `BLOCKED`, or `ERROR`, return the status, smallest stopping reason, next decision needed, and validation already completed.

## Pipeline Overview

| Phase | Mode | Result |
| ----- | ---- | ------ |
| Behavior map | Dispatch `behavior-mapper` | `BEHAVIOR_MAP` facts, risks, file sizes, validation command |
| Strategy | Dispatch `refactor-strategist` | `STRATEGY` diagnosis, minimal plan, split decision, non-goals |
| Implementation | Dispatch `refactor-implementer` | `IMPLEMENTATION` changes, new files, validation summary |
| Review | Dispatch `refactor-reviewer` | `REFACTOR_REVIEW` verdict including the size check |
| Handoff | Inline | User-facing summary built from the four concise reports |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `behavior-mapper` | `./subagents/behavior-mapper.md` | Maps observable behavior, tests, side effects, and file sizes before design |
| `refactor-strategist` | `./subagents/refactor-strategist.md` | Chooses the smallest useful refactor and any required split, fetching web references only for concrete decisions |
| `refactor-implementer` | `./subagents/refactor-implementer.md` | Applies the approved behavior-preserving changes (including splits) and validates with existing tests when possible |
| `refactor-reviewer` | `./subagents/refactor-reviewer.md` | Reviews the resulting diff for behavior drift, scope drift, test changes, file-size compliance, and unnecessary abstraction |

Read a subagent file only when dispatching that subagent.

## Progressive Disclosure Map

| Need | Load Point | Location |
| ---- | ---------- | -------- |
| Core orchestration, contracts, file-size rule | When the skill triggers | This file |
| Subagent execution details | Immediately before dispatch | `./subagents/*.md` |
| Refactoring concepts and design trade-offs | Only when strategy or review needs external guidance | `./references/refactoring-web-resources.md`, then the selected webpage |
| File-size rule details, split decision tree, splitting patterns | Only when strategy or review must justify or enforce a split | `./references/file-size-policy.md`, then any linked webpage |
| Raw code, test output, diffs, and file contents | Inside the responsible subagent | Summarized back as structured reports |

The skill is self-contained: every local path it references is co-located in this skill directory. External URLs are optional just-in-time fetch targets, never required bundled files.

## File Size Rule

Every file the refactor touches stays at or below `MAX_LINES` (default `250`). The rule applies to the target file and to any new or modified files the refactor produces. A file above the ceiling indicates that the module is doing more than one job and must be split into smaller files that follow the project's architecture. When the project has no clear architecture, prefer splits along these seams: pure decision helpers, side-effect adapters, types, and orchestration.

Waivers are allowed for generated code, large data fixtures, framework-required single files, and similar cases. Each waiver is recorded explicitly in `STRATEGY` with the reason. The full counting policy, decision tree, and pattern URLs live in `./references/file-size-policy.md`.

## How This Skill Works

The mapper establishes the current behavior baseline and per-file line counts. The strategist chooses the smallest behavior-preserving design improvement and plans any required split. The implementer edits within that contract, performs the planned splits, and validates. The reviewer checks behavior, scope, abstraction discipline, file-size compliance, and test integrity before handoff.

Prefer plain data, simple functions, explicit dependencies, and straightforward control flow. Reach for design concepts only when they clarify a current decision; the resource index in `./references/refactoring-web-resources.md` maps each decision to a single web source.

## Execution Steps

| Step | Dispatch | Continue When | Stop Or Branch When |
| ---- | -------- | ------------- | ------------------- |
| 1 | `behavior-mapper` with `TARGET_PATH`, `USER_GOAL`, `TEST_COMMAND`, `SCOPE_LIMITS`, `MAX_LINES` | `PASS` or `NO_CHANGE_CANDIDATE` | Ask the mapper's question on `NEEDS_CLARIFICATION`; stop on `ERROR` |
| 2 | `refactor-strategist` with the behavior map, scope, goal, `MAX_LINES`, `REFERENCE_NEED`, `REFERENCE_INDEX_PATH=./references/refactoring-web-resources.md`, and `FILE_SIZE_POLICY_PATH=./references/file-size-policy.md` | `PASS` | Stop without editing on `NO_CHANGE`; ask or report recovery on `NEEDS_CLARIFICATION` or `ERROR` |
| 3 | `refactor-implementer` with the behavior map, strategy, validation command, and `MAX_LINES` | `PASS` or `PASS_WITH_WARNINGS` | Stop and report reason, files touched, and recovery on `BLOCKED` or `ERROR` |
| 4 | `refactor-reviewer` with the behavior map, strategy, implementation report, and `MAX_LINES` | `PASS` | On `FAIL`, re-dispatch implementer with only required fixes; on `ERROR`, report recovery |

Use at most two targeted fix cycles after a review failure. Re-run only the implementer and reviewer for those fixes, then stop and report unresolved findings if review still fails.

## Validation Loop

1. Map current behavior and file sizes before design or editing.
2. Validate implementation with the user's `TEST_COMMAND`, the mapper's suggested command, or the smallest discoverable existing check.
3. Review the diff against the behavior map, strategy, and `MAX_LINES`.
4. Fix only reviewer-identified issues and rerun the review gate.

Passing tests are evidence, not complete proof. The review gate also checks scope control, public API stability, side effects, edge cases, abstraction discipline, and per-file size compliance.

## Example

<example>
Input: `TARGET_PATH=src/subscriptions/expire-users.ts` (310 lines), `USER_GOAL="simplify without changing tests"`, `TEST_COMMAND="npm test -- subscriptions"`.

1. `behavior-mapper` returns `BEHAVIOR_MAP: PASS` with current expiration rules, side effects, risks, line counts, and the validation command. The target is flagged `OVERSIZED`.
2. `refactor-strategist` returns `STRATEGY: PASS` after consulting `./references/file-size-policy.md` for splitting guidance, and plans to extract pure decision helpers and side-effect senders into two new files while keeping the exported function in the original file. References fetched: one URL from `./references/refactoring-web-resources.md` for Functional Core / Imperative Shell.
3. `refactor-implementer` extracts the helpers, ensures every changed and created file is at or below 250 lines, and reports validation.
4. `refactor-reviewer` returns `REFACTOR_REVIEW: PASS` after confirming behavior preservation, scope control, and per-file size compliance.
5. The orchestrator returns the Output Contract summary without raw diffs or command logs.
</example>
