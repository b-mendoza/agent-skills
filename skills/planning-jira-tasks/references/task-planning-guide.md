# Task Planning Guide

Read this file when `task-planner` is turning a Jira ticket snapshot into the
stage 1 detailed plan.

## Problem Framing

Before decomposing work, identify the problem the ticket is trying to solve, not
only the solution it prescribes. Be explicit about what the ticket states versus
what you infer. Gaps are useful because Phase 3 can turn them into critique or
clarification prompts.

Include these subsections under `## Problem Framing`:

| Subsection | What to capture |
| ---------- | --------------- |
| `### End User` | Who directly experiences the outcome |
| `### Underlying Need` | The problem in user terms |
| `### Proposed Solution` | What the ticket asks to build or change |
| `### Solution-Problem Fit` | How directly the proposed solution addresses the need |
| `### Alternative Approaches Not Explored` | Plausible options the ticket does not discuss |
| `### Evidence Basis` | Evidence cited for why this solution is correct |

Use `Not stated in ticket` when the snapshot does not provide an answer.

## Decomposition

Identify discrete units of work required to resolve the ticket. Use these
categories when relevant: requirements, infrastructure, data changes, core
logic, integration, UI/UX, testing, documentation, and cleanup.

A task is a self-contained unit of work with one clear objective, one likely
owner, and a verifiable definition of done. Split unrelated concerns into
separate tasks.

Target 4-15 tasks. If the ticket clearly justifies fewer or more, keep the plan
accurate and explain the exception in `## Notes`.

## Existing Subtasks and Linked Issues

When `## Subtasks` lists concrete work items, map them to tasks or explain any
consolidation in `## Notes`. This prevents duplicate planning.

Use `## Linked Issues` for dependency and context. Reflect hard ordering or
blocking relationships in task decomposition when the snapshot makes them clear.

## Current-Subtask Detection

If `## Metadata` indicates the current work item is a Jira subtask, or the
snapshot otherwise shows it is already child work, record that in both
`## Assumptions and Constraints` and `## Notes`.

Use this wording in `## Notes` when applicable:

```markdown
Subtask scope: This ticket is already a Jira subtask. Downstream Jira subtask
creation should be skipped; implementation should stay on one branch/PR for the
current subtask.
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
  criteria, comments, subtasks, or linked issues.
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
