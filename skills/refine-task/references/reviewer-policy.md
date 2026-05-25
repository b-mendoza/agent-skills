# Reviewer Policy

> Read this file before interpreting write intent, lifecycle recommendations, or
> tracker safety gates. The reviewer may inspect and comment; every other tracker
> change is deferred to a separate approved workflow.

## Operating Model

The refinement review treats the Jira or GitHub item as source material. The
reviewer may inspect available context, evaluate readiness, ask questions, and
produce one refinement comment or draft. The reviewer's authority is advisory:
recommendations are not permission to perform tracker changes.

## State And Status Policy

Keep workflow state separate from item readiness:

- `REVIEW: PASS` means the review workflow produced a valid comment or draft.
  It may still report `Ready`, `Needs refinement`, `Needs split`, `Needs spike`,
  `Blocked`, or `Not actionable` as the item status.
- `REVIEW: BLOCKED` means required source, access, or authorization context is
  missing, so the review cannot proceed safely.
- `REVIEW: FAIL` means the review output failed its quality checklist after
  three targeted fix cycles.
- `REVIEW: ERROR` means an unexpected runtime, tool, fetch, or parsing failure
  interrupted the run.

Use `REVIEW_STATUS` and the tracker-facing comment to describe the item's
readiness. Use `REVIEW` to tell the coordinator how to route the run.

## Allowed Outcomes

| Outcome | Meaning |
| ------- | ------- |
| `Draft` | Return a comment body for the user to review or post manually. |
| `Ready to post` | The comment is safe to post exactly as returned; the coordinator may post it only when posting is explicitly requested and available, otherwise it returns this mode without mutating the tracker. |
| `Blocked` | Review cannot proceed safely because source context, access, or authorization is missing. |
| `Deferred` | User requested a tracker mutation that belongs in a separate approved workflow. |

## Write Boundary

The workflow may produce one new refinement comment. It keeps existing tracker
content unchanged: it does not edit title, body, fields, labels, status,
assignee, milestone, sprint, existing comments, links, subtasks, child issues,
or parent-child relationships.

Mutation examples that must be deferred: delete comments, close issues, merge or
supersede items, edit labels, assign owners, move workflow status, create child
work, split items, or change links.

Drafting a recommendation or neutral question about those actions is still
inside reviewer scope when it is evidence-backed and gated. Performing the
action, or presenting it as already approved, remains outside scope.

## Posting Boundary

The reviewer never posts. It only reports `POST_ALLOWED=yes` when the requested
action is exactly posting the returned refinement comment and no safety gate
prevents that action. The coordinator may attempt one post only when posting was
explicitly requested, authorization and tooling are available, and the reviewer
returned `REVIEW=PASS`. Permission, API, or runtime failure during posting
returns `Ready to post` or `Blocked` with the failure reason; it does not permit
retrying, editing, or performing any other tracker mutation.

## Human Gates

Gate before stating these as recommendations:

- Close, merge, delete, supersede, or otherwise change lifecycle state.
- Split an epic, parent issue, ticket, subtask model, or child issue set.
- Recommend a spike instead of implementation when it changes delivery approach.
- Recommend actions with security, data, permissions, migration, customer-impact,
  or operational risk.

If approval is unavailable, convert the recommendation into a neutral question
or concern. Example: `This appears duplicated by ISSUE-123. Should the owner
consider superseding this item?`

For parent-child work, recommending a shape is advisory. Creating Jira child
work, adding GitHub sub-issues, changing parent links, reprioritizing children,
or altering dependencies belongs to a separate approved workflow.

## Phase Order

1. Boundary: identify item type and write mode.
2. Mutation gate: detect and defer tracker mutations beyond the refinement comment.
3. Snapshot: list evidence reviewed and missing evidence.
4. Classification: identify item type and relevance state.
5. Readiness checks: run the checklist that applies to the item.
6. Synthesis: separate facts, assumptions, gaps, and recommendations.
7. Recommendation gates: approve, neutralize, or defer sensitive recommendations.
8. Comment: assemble the final comment or draft.

## Readiness Rule

An item is `Ready` only when the reviewer can answer the material parts of:
objective, expected outcomes, affected persona or user, user journey or workflow,
scope boundary, risks, dependencies, acceptance criteria, subtask readiness,
priority, and rationale without inventing missing information.

## Autonomy Rule

When unattended, continue safely instead of waiting indefinitely: use a draft,
ask neutral questions in the comment, defer gated recommendations, and choose the
most evidence-supported non-ready status.
