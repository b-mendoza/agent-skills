# Comment Template

> Read this file only when assembling the final tracker-facing comment or draft.
> Use `None` for empty sections when omission would be ambiguous.

## Status Definitions

| Status | Use When |
| ------ | -------- |
| `Ready` | No blocking gaps remain; scope is coherent; outcomes are testable; risks and dependencies are known or accepted. |
| `Needs refinement` | Clarifying questions, blockers, contradictions, invalid claims, or unresolved dependencies remain. |
| `Needs split` | Scope appears too broad or mixed, and split discussion is the primary next step. |
| `Needs spike` | Research is needed before implementation can be planned safely. |
| `Blocked` | Missing access, missing source context, permissions, or required owner input prevents meaningful review. |
| `Not actionable` | The item appears duplicate, obsolete, superseded, or otherwise not suitable for implementation as written. |

## Status Selection Notes

- Use `Needs split` when scope decomposition is the main blocker. Use `Needs
  refinement` when split discussion is only one of several ordinary gaps.
- Use `Needs spike` when a specific research question blocks planning. Include
  the proposed validation method and exit criteria in the comment.
- Use `Not actionable` only with evidence that the item is duplicate, obsolete,
  superseded, already completed, or outside the team's implementation path.
- Use `Blocked` when missing access, missing source context, or required owner
  authorization prevents a meaningful readiness review.

## Comment Shape

```text
Refinement status: Ready | Needs refinement | Needs split | Needs spike | Blocked | Not actionable

Summary:
- One short assessment of the item and why it is or is not ready.

Evidence reviewed:
- Ticket or issue sections, comments, subtasks, linked items, attachments, docs, codebase references, trusted documentation, or external sources used.

Blocking findings:
- Missing objective, unclear outcome, invalid technical claim, unresolved dependency, oversized scope, or other blockers. Use None when there are no blockers.

Questions for refinement:
- Questions the owner must answer before work starts or before a sensitive recommendation can be made. Use None when no questions remain.

Recommendations:
- Suggested split, subtask model, priority order, spike scope, or correction. These are recommendations only. Use None when no recommendation is supported or approved.

Non-blocking notes:
- Risks, assumptions, or follow-ups that should be tracked but do not block starting. Use None when there are no non-blocking notes.
```

## Writing Rules

- Keep the summary short and decision-oriented.
- Put owner decisions in `Questions for refinement`, not hidden in prose.
- Put sensitive lifecycle, split, or spike guidance in `Recommendations` only when approved or clearly framed as non-mutating advice.
- For epics and parent issues, describe child-work changes as questions or
  recommendations unless the user provided explicit approval to recommend them.
- Cite evidence compactly, such as `issue body`, `comment by @owner on 2026-05-21`, `linked issue #42`, `design doc section 3`, or `official API docs`.
- State `None` rather than deleting a section if deleting it could hide that the category was checked.

## Minimal Example

```text
Refinement status: Needs refinement

Summary:
- The item has a clear goal, but implementation should not start until the API version assumption and rollout dependency are resolved.

Evidence reviewed:
- Issue body, acceptance criteria, linked design doc, official API docs.

Blocking findings:
- The issue references API behavior that is contradicted by the official docs; owner needs to update the approach or version constraint.

Questions for refinement:
- Which API version should this target?
- Who owns rollout approval?

Recommendations:
- None

Non-blocking notes:
- Consider adding a rollback note before release planning.
```
