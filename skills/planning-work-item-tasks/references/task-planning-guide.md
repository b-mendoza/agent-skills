# Task Planning Guide

Read this file when `task-planner` is turning a work-item snapshot into the
stage 1 detailed plan. Platform vocabulary (work-item noun, child-item noun,
current-item mode name, task-plan summary heading) and the consumed snapshot
sections come from the active playbook (`PLAYBOOK_PATH`).

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
| Platform parent / child hierarchy behavior | the active playbook's `External-Source Routing` key |

## Problem Framing

Capture the problem the work item is trying to solve, not just the solution it
prescribes. Mark inferred content as inference; gaps become Phase 3 critique
fuel.

Required subsections under `## Problem Framing`:

| Subsection | What to capture |
| ---------- | --------------- |
| `### End User` | Who directly experiences the outcome |
| `### Underlying Need` | The problem in user terms |
| `### Proposed Solution` | What the work item asks to build or change |
| `### Solution-Problem Fit` | How directly the proposed solution addresses the need |
| `### Alternative Approaches Not Explored` | Plausible options the work item does not discuss |
| `### Evidence Basis` | Evidence cited for why this solution is correct |

Use `Not stated in work item` when the snapshot does not provide an answer.

## Decomposition

Split the work into self-contained units, each with one clear objective, one
likely owner, and a verifiable definition of done. Useful categories when
relevant: requirements, infrastructure, data changes, core logic, integration,
UI/UX, testing, documentation, cleanup.

Target 4-15 tasks. If the work item clearly justifies fewer or more, keep the
plan accurate and explain the exception in `## Notes`. Current-Child-Item Mode
has one internal workflow exception: a single execution task is allowed when
additional task splitting would invent child items of the current child item
rather than clarify execution. Record that reasoning in `## Notes`; this is
this skill's workflow rule, not a platform rule.

## Existing Child Items and Linked Issues

When the active playbook's child-work snapshot section lists concrete work
items, map them to tasks or explain any consolidation in `## Notes` to prevent
duplicate planning. Use `## Linked Issues` for dependency and context; reflect
hard ordering or blocking relationships in task decomposition when the snapshot
makes them clear.

## Current-Item Detection

If `## Metadata` indicates the current work item is already child work (per the
active playbook's `Current-Item Detection` cue), or the snapshot otherwise
shows it is already child work, record that in both `## Assumptions and
Constraints` and `## Notes`.

Use this wording in `## Notes` when applicable, substituting the playbook's
child-item noun:

```markdown
Child-item scope: This work item is already a <child-item noun>. Downstream
<child-item noun> creation should be skipped; implementation should stay on one
branch/PR for the current work item.
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
  criteria, comments, child items, or linked issues.
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
