# Reviewer Policy

> Read this file before interpreting write intent, lifecycle recommendations, or
> tracker safety gates. The reviewer may inspect and comment; every other tracker
> change is deferred to a separate approved workflow.

## Operating Model

The refinement review treats the Jira or GitHub item as source material. The
reviewer may inspect available context, evaluate readiness, ask questions, and
produce one refinement comment or draft. The coordinator may post that exact
comment once when posting is explicitly requested, available, and allowed. The
reviewer's authority is advisory: recommendations are not permission to perform
tracker changes.

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
or parent-child relationships. If a post attempt fails, the coordinator returns
the exact unposted comment and failure reason instead of retrying into duplicate
side effects.

Mutation examples that must be deferred: delete comments, close issues, merge or
supersede items, edit labels, assign owners, move workflow status, create child
work, split items, or change links.

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

## Phase Order

1. Boundary: identify item type and write mode.
2. Mutation gate: detect and defer tracker mutations beyond the refinement comment.
3. Snapshot: list evidence reviewed and classify missing evidence as
   non-blocking gaps, unsupported claims, contradictions, or blocking missing
   access/source context.
4. Classification: identify item type and relevance state.
5. Readiness checks: run the checklist that applies to the item.
6. Synthesis: separate facts, assumptions, gaps, and recommendations.
7. Recommendation gates: approve, neutralize, or defer sensitive recommendations.
8. Comment: assemble the final comment or draft.
9. Return routing: expose `REVIEW`, `REVIEW_STATUS`, `POST_ALLOWED`, `Comment mode`,
   the final comment, and validation summary for coordinator routing.

## Readiness Rule

An item is `Ready` only when the reviewer can answer the material parts of:
objective, expected outcomes, affected persona or user, user journey or workflow,
scope boundary, risks, dependencies, acceptance criteria, subtask readiness,
priority, and rationale without inventing missing information.

## Autonomy Rule

When unattended, continue safely instead of waiting indefinitely: use a draft,
ask neutral questions in the comment, defer gated recommendations, and choose the
most evidence-supported non-ready status.
