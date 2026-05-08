# Task Planning Guide

Read this file when `task-planner` is turning a GitHub issue snapshot into the
stage 1 detailed plan.

> **Reminder:** Apply the operational sections below first. Fetch a URL from
> `./external-sources.md` only when you need background on a method or a
> definition (for example `five-whys`, `requirements-traceability`,
> `definition-of-done`, `invest-criteria`, or `yagni`).

## Optional Source Lookups

The local rules below are enough for normal execution. Use these source keys
only when a planning judgment needs method background or a cited rationale:

| Need | Source key in `./external-sources.md` |
| ---- | ------------------------------------- |
| Underlying-need analysis | `five-whys` |
| Traceability expectations | `requirements-traceability` |
| Concrete completion criteria | `definition-of-done` |
| Task-quality sanity check | `invest-criteria` |
| Avoiding speculative scope | `yagni` |
| GitHub parent / sub-issue behavior | `github-sub-issues` |

## Problem Framing

Capture the problem the issue is trying to solve, not just the solution it
prescribes. Mark inferred content as inference; gaps become Phase 3 critique
fuel.

Required subsections under `## Problem Framing`:

| Subsection | What to capture |
| ---------- | --------------- |
| `### End User` | Who directly experiences the outcome |
| `### Underlying Need` | The problem in user terms |
| `### Proposed Solution` | What the issue asks to build or change |
| `### Solution-Problem Fit` | How directly the proposed solution addresses the need |
| `### Alternative Approaches Not Explored` | Plausible options the issue does not discuss |
| `### Evidence Basis` | Evidence cited for why this solution is correct |

Use `Not stated in issue` when the snapshot does not provide an answer.

## Decomposition

Split the work into self-contained units, each with one clear objective, one
likely owner, and a verifiable definition of done. Useful categories when
relevant: requirements, infrastructure, data changes, core logic, integration,
UI/UX, testing, documentation, cleanup.

Target 4-15 tasks. If the issue clearly justifies fewer or more, keep the plan
accurate and explain the exception in `## Notes`.

## Existing Child Issues and Linked Issues

When `## Child Issues` lists concrete work items, map them to tasks or explain
any consolidation in `## Notes` to prevent duplicate planning. Use `## Linked
Issues` for dependency and context; reflect hard ordering or blocking
relationships in task decomposition when the snapshot makes them clear.

## Current-Child-Issue Detection

If `## Metadata` indicates the current work item is a GitHub child issue or
sub-issue, or the snapshot otherwise shows it is already child work, record
that in both `## Assumptions and Constraints` and `## Notes`.

Use this wording in `## Notes` when applicable:

```markdown
Child-issue scope: This issue is already a GitHub child issue or sub-issue.
Downstream child-issue creation should be skipped; implementation should stay on
one branch/PR for the current issue.
```

Stage 2 will turn that note into a single repeated branch name across all tasks.

## Per-Task Detail

For each stage 1 task, write all six subsections:

- `**Objective:**`
- `**Relevant requirements and context:**`
- `**Questions to answer before starting:**`
- `**Implementation notes:**`
- `**Definition of done:**`
- `**Likely files / artifacts affected:**`

Use letter labels (`Task A`, `Task B`, `Task C`). Stage 2 assigns final task
numbers, dependencies, priorities, and branch names.

## Quality Self-Check

Before writing the file, verify:

- `## Problem Framing` has all six subsections.
- Inferred content is marked as inference.
- Every requirement in `## Description` has at least one task or an explicit
  deferral in `## Notes`.
- Every acceptance criterion maps to at least one task's definition of done.
- Every task has all six required subsections.
- Every task has a `Traces to` reference back to description, acceptance
  criteria, comments, child issues, or linked issues.
- Open questions are separated into cross-cutting versus per-task questions.
- The task count is appropriate for scope, with exceptions explained in
  `## Notes`.

## Common Mistakes

- Merging UI and backend work into one task because they serve the same feature.
- Ignoring comments that add scope, decisions, or clarifications.
- Creating a vague miscellaneous task instead of a clear unit of work.
- Copying the full description into implementation notes instead of extracting
  task-local context.
- Writing vague done criteria such as `works correctly`.
- Assuming shared context across tasks instead of repeating key local details.
