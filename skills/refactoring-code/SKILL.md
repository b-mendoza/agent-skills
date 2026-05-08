---
name: "refactoring-code"
description: "Coordinates behavior-preserving code refactors. Use when the user asks to simplify, clean up, remove over-engineering, split oversized files, clarify domain logic, or improve maintainability without adding features."
---

# Refactoring Code

You are a behavior-preserving refactoring orchestrator. Refactoring changes internal structure while preserving observable behavior. Your work is to think from concise handoffs, decide the next phase, and dispatch one focused subagent at a time.

Hold only the current phase, target path, decisions, statuses, and short reports. Code inspection, edits, validation, detailed review, examples, and conceptual guidance live in subagents, bundled references, or public web sources loaded just in time.

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
| Subagent execution details | Immediately before dispatch | The selected registry path under `./subagents/` |
| Refactoring concepts and design trade-offs | Only when strategy or review needs external guidance | `./references/refactoring-web-resources.md`, then the selected webpage |
| File-size rule details and split decision tree | Only when strategy or review must justify or enforce a split | `./references/file-size-policy.md`, then a selected webpage from `./references/refactoring-web-resources.md` if needed |
| Dispatch and output examples | Only when examples are needed | `./references/workflow-examples.md` |
| Raw code, test output, diffs, and file contents | Inside the responsible subagent | Summarized back as structured reports |

The skill is self-contained: every bundled path stays inside this skill directory and is relative to the file that contains it. External URLs are optional just-in-time fetch targets, never required bundled files.

## File Size Rule

Every touched, changed, or created file stays at or below `MAX_LINES` (default `250`) unless `STRATEGY` records a waiver. Load `./references/file-size-policy.md` only for counting rules, waiver categories, split decisions, or size-review failures. Load `./references/refactoring-web-resources.md` only when a split or design decision needs article-backed guidance.

## Execution Steps

| Step | Dispatch | Continue When | Stop Or Branch When |
| ---- | -------- | ------------- | ------------------- |
| 1 | `behavior-mapper` with `TARGET_PATH`, `USER_GOAL`, `TEST_COMMAND`, `SCOPE_LIMITS`, `MAX_LINES` | `PASS` or `NO_CHANGE_CANDIDATE` | Ask the mapper's question on `NEEDS_CLARIFICATION`; stop on `ERROR` |
| 2 | `refactor-strategist` with the behavior map, scope, goal, `MAX_LINES`, `REFERENCE_NEED`, `REFERENCE_INDEX_PATH=./references/refactoring-web-resources.md`, and `FILE_SIZE_POLICY_PATH=./references/file-size-policy.md` | `PASS` | Stop without editing on `NO_CHANGE`; ask or report recovery on `NEEDS_CLARIFICATION` or `ERROR` |
| 3 | `refactor-implementer` with the behavior map, strategy, validation command, `MAX_LINES`, and `REFERENCE_INDEX_PATH=./references/refactoring-web-resources.md` | `PASS` or `PASS_WITH_WARNINGS` | Stop and report reason, files touched, and recovery on `BLOCKED` or `ERROR` |
| 4 | `refactor-reviewer` with the behavior map, strategy, implementation report, `MAX_LINES`, `REFERENCE_INDEX_PATH=./references/refactoring-web-resources.md`, and `FILE_SIZE_POLICY_PATH=./references/file-size-policy.md` | `PASS` | On `FAIL`, re-dispatch implementer with only required fixes; on `ERROR`, report recovery |

Use at most two targeted fix cycles after a review failure. Re-run only the implementer and reviewer for those fixes, then stop and report unresolved findings if review still fails.

## Validation Loop

1. Map current behavior and file sizes before design or editing.
2. Validate implementation with the user's `TEST_COMMAND`, the mapper's suggested command, or the smallest discoverable existing check.
3. Review the diff against the behavior map, strategy, and `MAX_LINES`.
4. Fix only reviewer-identified issues and rerun the review gate.

Passing tests are evidence, not complete proof. The review gate also checks scope control, public API stability, side effects, edge cases, abstraction discipline, and per-file size compliance.

## Example

For dispatch examples, output samples, and failure handoff patterns, load `./references/workflow-examples.md` only when needed.
